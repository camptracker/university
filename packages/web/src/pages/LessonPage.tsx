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
  const [streamFollowUpQuestion, setStreamFollowUpQuestion] = useState<string>('');
  const [streamImage, setStreamImage] = useState<string | null>(null);
  const [streamDone, setStreamDone] = useState(false);
  const [waitingForGen, setWaitingForGen] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const hasScrolledRef = useRef(false);
  const savedScrollYRef = useRef<number>(0);

  useEffect(() => { 
    window.scrollTo(0, 0); 
    hasScrolledRef.current = false;
    
    // Reset all state when navigating to a different lesson
    setLesson(null); // Clear old lesson data to prevent race conditions
    setPrevQuestion(null);
    setStreamPhase('');
    setStreamTitle('');
    setStreamStandard('');
    setStreamParable('');
    setStreamFollowUpQuestion('');
    setStreamImage(null);
    setStreamDone(false);
    setWaitingForGen(false);
    
    // Close any existing event source
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [seriesKey, sortOrder]);

  // Auto-scroll below image when streaming starts
  useEffect(() => {
    if (isStreaming && streamParable && !hasScrolledRef.current && headerRef.current) {
      headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      hasScrolledRef.current = true;
    }
  }, [isStreaming, streamParable]);

  // Restore scroll position when streaming completes
  useEffect(() => {
    if (streamDone && savedScrollYRef.current > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollYRef.current);
        savedScrollYRef.current = 0; // Reset after restoring
      });
    }
  }, [streamDone]);

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

    // In streaming mode, always use sortOrder from URL (not lesson object) to avoid race conditions
    // When navigating from lesson N to lesson N+1, lesson state may still contain lesson N data
    const currentSort = isStreaming ? Number(sortOrder) : (lesson?.sortOrder || Number(sortOrder));
    if (currentSort === 1) {
      // For Lesson 1, use the series anchor question
      setPrevQuestion(series.anchor);
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
  }, [lesson, series, sortOrder, isStreaming]);

  // Streaming mode: open SSE (wait for previous lesson to exist first if not Lesson 1)
  useEffect(() => {
    if (!isStreaming || !series) return;
    setLoading(false);

    const currentDay = Number(sortOrder);
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // First, check if this lesson already exists (e.g., after refresh mid-generation)
    api.get<APILessonsResponse>(`/series/${series._id}/lessons?page=1`)
      .then(r => {
        const existingLesson = r.data.lessons.find(l => l.sortOrder === currentDay);
        if (existingLesson) {
          // Lesson already exists, load it instead of streaming
          api.get<APILesson>(`/lessons/${existingLesson._id}`)
            .then(full => {
              setLesson(full.data);
              setSearchParams({}, { replace: true });
              if (user) api.post(`/lessons/${full.data._id}/read`).catch(() => {});
            })
            .catch(console.error);
          return;
        }

        // Lesson doesn't exist yet, proceed with streaming checks
        if (currentDay > 1) {
          const prevLesson = r.data.lessons.find(l => l.sortOrder === currentDay - 1);
          if (!prevLesson) {
            // Previous lesson doesn't exist yet, wait a moment and retry
            console.log(`Waiting for Lesson ${currentDay - 1} to be saved...`);
            setTimeout(() => {
              setLoading(true);
              setLoading(false);
            }, 1000);
            return;
          }
        }

        // All clear, start streaming
        startStream();
      })
      .catch(console.error);

    function startStream() {
      if (!series) return; // TypeScript guard
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
      if (section === 'followUpQuestion') setStreamFollowUpQuestion(prev => prev + text);
    });

    es.addEventListener('done', (e) => {
      const { image, lessonId } = JSON.parse(e.data);
      
      // Save scroll position before state updates that will trigger re-render
      savedScrollYRef.current = window.scrollY;
      
      // Batch state updates to minimize re-renders
      if (image) setStreamImage(image);
      setStreamDone(true);
      setTotalLessons(prev => prev + 1);
      
      es.close();
      esRef.current = null;

      // Mark as read
      if (user && lessonId) {
        api.post(`/lessons/${lessonId}/read`).catch(() => {});
      }

      // Don't remove ?stream=true param or set lesson state
      // Any state/URL change would trigger re-render and lose scroll position
      // The streaming UI with streamDone=true shows everything correctly
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
        }, 1000); // Poll every 1 second for faster updates
      }
      });
    }

    return () => { if (esRef.current) esRef.current.close(); };
  }, [isStreaming, series, sortOrder, user]);

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
          <span>Lesson {sortNum}</span>
        </nav>

        <header className="lesson-header" ref={headerRef}>
          <span className="lesson-day-badge">Lesson {sortNum}</span>
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

          {/* Follow-up question - appears when received from stream */}
          {streamFollowUpQuestion && (
            <div className="parable-tomorrow">
              <p className="parable-tomorrow-label">Tomorrow's Question:</p>
              <p className="parable-tomorrow-question">{streamFollowUpQuestion}</p>
            </div>
          )}
        </article>

        {/* Image placeholder while generating */}
        {streamPhase === 'image' && !streamImage && (
          <div className="lesson-hero">
            <div className="image-placeholder" />
          </div>
        )}

        {/* Image appears at bottom after generation */}
        {streamImage && (
          <div className="lesson-hero">
            <img src={streamImage} alt="Lesson" />
          </div>
        )}

        {streamDone && (
          <nav className="bottom-nav">
            {sortNum > 1 ? (
              <Link to={`/${series!.key}/lesson/${sortNum - 1}`} className="nav-link">← Lesson {sortNum - 1}</Link>
            ) : <span />}
            {user?.role === 'admin' && (
              <button
                className="nav-link generate-next-btn"
                onClick={() => navigate(`/${series!.key}/lesson/${sortNum + 1}?stream=true`)}
              >Generate Lesson {sortNum + 1} →</button>
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
          <span>Lesson {sortNum}</span>
        </nav>

        <header className="lesson-header">
          <span className="lesson-day-badge">Lesson {sortNum}</span>
          <p style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>
            ⏳ Generation in progress — the lesson will appear automatically when complete
          </p>
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
          <span>Lesson {sortNum}</span>
        </nav>

        <header className="lesson-header">
          <span className="lesson-day-badge">Lesson {sortNum}</span>
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
        <span>Lesson {sortNum}</span>
      </nav>

      <header className="lesson-header">
        <span className="lesson-day-badge">Lesson {sortNum}</span>
        <h1>{lesson.title}</h1>
      </header>

      {lesson.parable && (
        <ParableRenderer 
          text={lesson.parable} 
          answeringQuestion={prevQuestion}
          followUpQuestion={lesson.followUpQuestion}
        />
      )}

      {lesson.image && (
        <div className="lesson-hero">
          <img src={lesson.image} alt={lesson.title} />
        </div>
      )}

      <nav className="bottom-nav">
        {sortNum > 1 ? (
          <Link to={`/${series.key}/lesson/${sortNum - 1}`} className="nav-link">← Lesson {sortNum - 1}</Link>
        ) : <span />}
        {sortNum < totalLessons ? (
          <Link to={`/${series.key}/lesson/${sortNum + 1}`} className="nav-link">Lesson {sortNum + 1} →</Link>
        ) : user?.role === 'admin' ? (
          <button
            className="nav-link generate-next-btn"
            onClick={() => navigate(`/${series.key}/lesson/${sortNum + 1}?stream=true`)}
          >Generate Lesson {sortNum + 1} →</button>
        ) : null}
      </nav>
    </div>
  );
}
