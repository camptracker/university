/**
 * Lesson page — URL: /:seriesKey/lesson/:sortOrder
 *
 * Two modes:
 * 1. Normal: loads existing lesson from API
 * 2. Streaming: if ?stream=true, opens SSE to generate-stream endpoint and
 *    renders content in real-time as it arrives. When done, loads saved lesson.
 */
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import StreamingText from '../components/StreamingText.js';
import ParableRenderer from '../components/ParableRenderer.js';
import api, { type APILesson, type APISeries, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const API_BASE = (api.defaults.baseURL || '').replace(/\/api$/, '');

export default function LessonPage() {
  const { seriesKey, sortOrder } = useParams<{ seriesKey: string; sortOrder: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [series, setSeries] = useState<APISeries | null>(null);
  const [lesson, setLesson] = useState<APILesson | null>(null);
  const [prevQuestion, setPrevQuestion] = useState<string | null>(null);
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(true);

  // Streaming state
  const isStreaming = searchParams.get('stream') === 'true';
  const [streamPhase, setStreamPhase] = useState<string>('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamStandard, setStreamStandard] = useState('');
  const [streamParable, setStreamParable] = useState('');
  const [streamImage, setStreamImage] = useState<string | null>(null);
  const [streamDone, setStreamDone] = useState(false);
  const [waitingForGen, setWaitingForGen] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [seriesKey, sortOrder]);

  // Load series info (needed for both modes)
  useEffect(() => {
    if (!seriesKey) return;
    api.get<APISeries[]>('/series')
      .then(r => {
        const found = r.data.find(s => s.key === seriesKey);
        if (found) setSeries(found);
      })
      .catch(console.error);
  }, [seriesKey]);

  // Normal mode: load existing lesson, or poll if still generating
  useEffect(() => {
    if (!seriesKey || !sortOrder || isStreaming) return;
    setLoading(true);

    let foundSeries: APISeries | null = null;

    api.get<APISeries[]>('/series')
      .then(r => {
        const found = r.data.find(s => s.key === seriesKey);
        if (!found) return;
        foundSeries = found;
        setSeries(found);
        return api.get<APILessonsResponse>(`/series/${found._id}/lessons?page=1`);
      })
      .then(r => {
        if (!r || !foundSeries) return;
        setTotalLessons(r.data.total);
        const found = r.data.lessons.find(l => l.sortOrder === Number(sortOrder));
        if (found) {
          // Lesson exists — load it
          return api.get<APILesson>(`/lessons/${found._id}`).then(lr => {
            setLesson(lr.data);
            if (user) api.post(`/lessons/${lr.data._id}/read`).catch(() => {});
          });
        } else {
          // Lesson doesn't exist yet — check if generation is in progress
          return api.get<{ generating: boolean }>(`/series/${foundSeries!._id}/generation-status`).then(gs => {
            if (gs.data.generating) {
              // Poll every 2s until lesson appears
              setWaitingForGen(true);
              setLoading(false);
              const sid = foundSeries!._id;
              pollRef.current = setInterval(async () => {
                try {
                  const lr = await api.get<APILessonsResponse>(`/series/${sid}/lessons?page=1`);
                  setTotalLessons(lr.data.total);
                  const l = lr.data.lessons.find(l => l.sortOrder === Number(sortOrder));
                  if (l) {
                    clearInterval(pollRef.current!);
                    pollRef.current = null;
                    const full = await api.get<APILesson>(`/lessons/${l._id}`);
                    setLesson(full.data);
                    setWaitingForGen(false);
                    if (user) api.post(`/lessons/${full.data._id}/read`).catch(() => {});
                  }
                } catch { /* ignore */ }
              }, 2000);
            }
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [seriesKey, sortOrder, user, isStreaming]);

  // Fetch previous lesson's follow-up question (for context)
  useEffect(() => {
    if (!series) return;

    const currentSort = lesson?.sortOrder || Number(sortOrder);
    if (currentSort === 1) {
      setPrevQuestion(null);
      return;
    }

    // Fetch previous lesson
    api.get<APILessonsResponse>(`/series/${series._id}/lessons?page=1`)
      .then(r => {
        const prevLesson = r.data.lessons.find(l => l.sortOrder === currentSort - 1);
        if (prevLesson) {
          setPrevQuestion(prevLesson.followUpQuestion);
        }
      })
      .catch(console.error);
  }, [lesson, series, sortOrder]);

  // Streaming mode: open SSE
  useEffect(() => {
    if (!isStreaming || !series) return;
    setLoading(false);

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const es = new EventSource(`${API_BASE}/api/series/${series._id}/generate-stream?token=${token}`);
    esRef.current = es;

    es.addEventListener('phase', (e) => {
      const { phase } = JSON.parse(e.data);
      setStreamPhase(phase);
    });

    es.addEventListener('delta', (e) => {
      const { section, text } = JSON.parse(e.data);
      if (section === 'title') setStreamTitle(prev => prev + text);
      if (section === 'standard') setStreamStandard(prev => prev + text);
      if (section === 'parable') setStreamParable(prev => prev + text);
    });

    es.addEventListener('done', (e) => {
      const { image, lessonId } = JSON.parse(e.data);
      if (image) setStreamImage(image);
      setStreamDone(true);
      es.close();
      esRef.current = null;

      // Remove ?stream param (no page reload)
      setSearchParams({}, { replace: true });

      // Load the lesson to get followUpQuestion
      if (lessonId) {
        api.get<APILesson>(`/lessons/${lessonId}`)
          .then(r => {
            setLesson(r.data);
            if (user) api.post(`/lessons/${lessonId}/read`).catch(() => {});
          })
          .catch(console.error);
      }
    });

    es.addEventListener('error', () => {
      es.close();
      esRef.current = null;
      // SSE failed (possibly 409 — generation already running from before reload)
      // Fall back to polling for the lesson to appear
      setWaitingForGen(true);
      if (series) {
        pollRef.current = setInterval(async () => {
          try {
            const lr = await api.get<APILessonsResponse>(`/series/${series._id}/lessons?page=1`);
            setTotalLessons(lr.data.total);
            const l = lr.data.lessons.find(l => l.sortOrder === Number(sortOrder));
            if (l) {
              clearInterval(pollRef.current!);
              pollRef.current = null;
              const full = await api.get<APILesson>(`/lessons/${l._id}`);
              setLesson(full.data);
              setWaitingForGen(false);
              setSearchParams({}, { replace: true });
              if (user) api.post(`/lessons/${full.data._id}/read`).catch(() => {});
            }
          } catch { /* ignore */ }
        }, 2000);
      }
    });

    return () => { es.close(); };
  }, [isStreaming, series]);

  const sortNum = Number(sortOrder);

  // Streaming mode render
  if (isStreaming || (streamParable && !lesson)) {
    const phaseLabel: Record<string, string> = {
      title: '✨ Creating title...',
      standard: '✍️ Preparing lesson...',
      parable: '📖 Writing parable...',
      meta: '🎵 Finishing up...',
      image: '🎨 Generating image...',
      error: '❌ Generation failed',
    };

    return (
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/" className="nav-link">Home</Link>
          <span className="breadcrumb-sep">›</span>
          {series && <Link to={`/${series.key}`} className="nav-link">{series.title}</Link>}
          <span className="breadcrumb-sep">›</span>
          <span>Day {sortNum}</span>
        </nav>

        <div className="lesson-hero">
          {streamImage ? (
            <img src={streamImage} alt="Lesson" />
          ) : (
            <div className="image-placeholder" />
          )}
        </div>

        <header className="lesson-header">
          <span className="lesson-day-badge">Day {sortNum}</span>
          {streamTitle && <h1 style={{ marginTop: '0.5rem' }}>{streamTitle}</h1>}
          {!streamDone && (
            <p style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>
              {phaseLabel[streamPhase] || 'Starting...'}
            </p>
          )}
        </header>

        <article className="lesson-content parable">
          {prevQuestion && (
            <div className="parable-context">
              <p className="parable-context-label">Today's Question:</p>
              <p className="parable-context-question">{prevQuestion}</p>
            </div>
          )}
          
          {/* Main parable content - never unmounts */}
          <div className="parable-main">
            {streamParable ? (
              <StreamingText text={streamParable} className="" />
            ) : streamPhase !== 'error' && (
              <div style={{ padding: '1rem 0' }}>
                <div className="skeleton-line skeleton-long" />
                <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
                <div className="skeleton-line skeleton-short" style={{ marginTop: '0.75rem' }} />
                <div className="skeleton-line skeleton-long" style={{ marginTop: '1rem' }} />
                <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
                <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
              </div>
            )}
          </div>

          {/* Follow-up question - appears when done */}
          {streamDone && lesson?.followUpQuestion && (
            <div className="parable-tomorrow">
              <p className="parable-tomorrow-label">Tomorrow's Question:</p>
              <p className="parable-tomorrow-question">{lesson.followUpQuestion}</p>
            </div>
          )}
        </article>

        {streamDone && (
          <nav className="bottom-nav">
            {sortNum > 1 ? (
              <Link to={`/${series!.key}/lesson/${sortNum - 1}`} className="nav-link">← Day {sortNum - 1}</Link>
            ) : <span />}
            {user?.role === 'admin' && (
              <button
                className="nav-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--gold)' }}
                onClick={() => navigate(`/${series!.key}/lesson/${sortNum + 1}?stream=true`)}
              >Generate Day {sortNum + 1} →</button>
            )}
          </nav>
        )}
      </div>
    );
  }

  // Waiting for generation to finish (reload mid-stream)
  if (waitingForGen && !lesson) {
    return (
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/" className="nav-link">Home</Link>
          <span className="breadcrumb-sep">›</span>
          {series && <Link to={`/${series.key}`} className="nav-link">{series.title}</Link>}
          <span className="breadcrumb-sep">›</span>
          <span>Day {sortNum}</span>
        </nav>

        <div className="lesson-hero">
          <div className="image-placeholder" />
        </div>

        <header className="lesson-header">
          <span className="lesson-day-badge">Day {sortNum}</span>
          <p style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>⏳ Generation in progress — waiting for lesson...</p>
        </header>

        <div style={{ padding: '1rem 0' }}>
          <div className="skeleton-line skeleton-long" />
          <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
          <div className="skeleton-line skeleton-short" style={{ marginTop: '0.75rem' }} />
          <div className="skeleton-line skeleton-long" style={{ marginTop: '1rem' }} />
          <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
        </div>
      </div>
    );
  }

  // Normal mode render (loading state)
  if (loading) {
    return (
      <div className="container">
        <nav className="breadcrumb">
          <Link to="/" className="nav-link">Home</Link>
          <span className="breadcrumb-sep">›</span>
          {series && <Link to={`/${series.key}`} className="nav-link">{series.title}</Link>}
          <span className="breadcrumb-sep">›</span>
          <span>Day {sortNum}</span>
        </nav>

        <div className="lesson-hero">
          <div className="image-placeholder" />
        </div>

        <header className="lesson-header">
          <span className="lesson-day-badge">Day {sortNum}</span>
        </header>

        <div style={{ padding: '1rem 0' }}>
          <div className="skeleton-line skeleton-long" />
          <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
          <div className="skeleton-line skeleton-short" style={{ marginTop: '0.75rem' }} />
          <div className="skeleton-line skeleton-long" style={{ marginTop: '1rem' }} />
          <div className="skeleton-line skeleton-long" style={{ marginTop: '0.75rem' }} />
        </div>
      </div>
    );
  }
  if (!lesson || !series) return <div className="container"><p>Lesson not found.</p><Link to="/" className="nav-link">← Home</Link></div>;

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/" className="nav-link">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to={`/${series.key}`} className="nav-link">{series.title}</Link>
        <span className="breadcrumb-sep">›</span>
        <span>Day {sortNum}</span>
      </nav>

      {lesson.image && (
        <div className="lesson-hero">
          <img src={lesson.image} alt={lesson.title} />
        </div>
      )}

      <header className="lesson-header">
        <span className="lesson-day-badge">Day {sortNum}</span>
        <h1>{lesson.title}</h1>
      </header>

      {lesson.parable && (
        <ParableRenderer 
          text={lesson.parable} 
          characters={series?.characters} 
          answeringQuestion={prevQuestion}
          followUpQuestion={lesson.followUpQuestion}
        />
      )}

      <nav className="bottom-nav">
        {sortNum > 1 ? (
          <Link to={`/${series.key}/lesson/${sortNum - 1}`} className="nav-link">← Day {sortNum - 1}</Link>
        ) : <span />}
        {sortNum < totalLessons ? (
          <Link to={`/${series.key}/lesson/${sortNum + 1}`} className="nav-link">Day {sortNum + 1} →</Link>
        ) : user?.role === 'admin' ? (
          <button
            className="nav-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--gold)' }}
            onClick={() => navigate(`/${series.key}/lesson/${sortNum + 1}?stream=true`)}
          >Generate Day {sortNum + 1} →</button>
        ) : null}
      </nav>
    </div>
  );
}
