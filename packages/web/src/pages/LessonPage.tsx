/**
 * Lesson page — URL: /:seriesKey/lesson/:sortOrder
 *
 * Two modes:
 * 1. Normal: loads existing lesson from API
 * 2. Streaming: if ?stream=true, opens SSE to generate-stream endpoint and
 *    renders content in real-time as it arrives. When done, loads saved lesson.
 */
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { type APILesson, type APISeries, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const API_BASE = (api.defaults.baseURL || '').replace(/\/api$/, '');

type Tab = 'parable' | 'content';

export default function LessonPage() {
  const { seriesKey, sortOrder } = useParams<{ seriesKey: string; sortOrder: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [series, setSeries] = useState<APISeries | null>(null);
  const [lesson, setLesson] = useState<APILesson | null>(null);
  const [totalLessons, setTotalLessons] = useState(0);
  const [tab, setTab] = useState<Tab>('parable');
  const [loading, setLoading] = useState(true);

  // Streaming state
  const isStreaming = searchParams.get('stream') === 'true';
  const [streamPhase, setStreamPhase] = useState<string>('');
  const [streamStandard, setStreamStandard] = useState('');
  const [streamParable, setStreamParable] = useState('');
  const [streamImage, setStreamImage] = useState<string | null>(null);
  const [streamDone, setStreamDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

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

  // Normal mode: load existing lesson
  useEffect(() => {
    if (!seriesKey || !sortOrder || isStreaming) return;
    setLoading(true);

    api.get<APISeries[]>('/series')
      .then(r => {
        const found = r.data.find(s => s.key === seriesKey);
        if (!found) return;
        setSeries(found);
        return api.get<APILessonsResponse>(`/series/${found._id}/lessons?page=1`);
      })
      .then(r => {
        if (!r) return;
        setTotalLessons(r.data.total);
        const found = r.data.lessons.find(l => l.sortOrder === Number(sortOrder));
        if (!found) return;
        return api.get<APILesson>(`/lessons/${found._id}`);
      })
      .then(r => {
        if (!r) return;
        setLesson(r.data);
        if (user) api.post(`/lessons/${r.data._id}/read`).catch(() => {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [seriesKey, sortOrder, user, isStreaming]);

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
      // Standard generates first (hidden), then parable streams visible
      if (phase === 'parable') setTab('parable');
    });

    es.addEventListener('delta', (e) => {
      const { section, text } = JSON.parse(e.data);
      if (section === 'standard') setStreamStandard(prev => prev + text);
      if (section === 'parable') setStreamParable(prev => prev + text);
    });

    es.addEventListener('done', (e) => {
      const { image } = JSON.parse(e.data);
      if (image) setStreamImage(image);
      setStreamDone(true);
      es.close();
      esRef.current = null;

      // Remove ?stream param and load the real lesson
      setSearchParams({}, { replace: true });

      // Reload lesson from DB
      api.get<APILessonsResponse>(`/series/${series._id}/lessons?page=1`)
        .then(r => {
          setTotalLessons(r.data.total);
          const found = r.data.lessons.find(l => l.sortOrder === Number(sortOrder));
          if (!found) return;
          return api.get<APILesson>(`/lessons/${found._id}`);
        })
        .then(r => {
          if (!r) return;
          setLesson(r.data);
          if (user) api.post(`/lessons/${r.data._id}/read`).catch(() => {});
        })
        .catch(console.error);
    });

    es.addEventListener('error', () => {
      es.close();
      esRef.current = null;
      setStreamPhase('error');
    });

    return () => { es.close(); };
  }, [isStreaming, series]);

  const sortNum = Number(sortOrder);

  // Streaming mode render
  if (isStreaming || (streamStandard && !lesson)) {
    const phaseLabel: Record<string, string> = {
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

        {streamImage && (
          <div className="lesson-hero">
            <img src={streamImage} alt="Lesson" />
          </div>
        )}

        <header className="lesson-header">
          <span className="lesson-day-badge">Day {sortNum}</span>
          {!streamDone && (
            <p style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>
              {phaseLabel[streamPhase] || 'Starting...'}
            </p>
          )}
        </header>

        <div className="toggle-container">
          <button
            className={`toggle-btn ${tab === 'parable' ? 'active' : ''}`}
            onClick={() => setTab('parable')}
          >🏰 Parable</button>
          <button
            className={`toggle-btn ${tab === 'content' ? 'active' : ''}`}
            onClick={() => setTab('content')}
            disabled={!streamStandard}
          >📖 Lesson</button>
        </div>

        <article className="lesson-content">
          {tab === 'parable' && streamParable && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamParable}</ReactMarkdown>
          )}
          {tab === 'content' && streamStandard && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamStandard}</ReactMarkdown>
          )}
          {tab === 'parable' && !streamParable && streamPhase !== 'error' && (
            <div style={{ padding: '2rem 0' }}>
              <div className="skeleton-line skeleton-long" />
              <div className="skeleton-line skeleton-short" style={{ marginTop: '0.5rem' }} />
            </div>
          )}
        </article>
      </div>
    );
  }

  // Normal mode render
  if (loading) return <div className="container"><div className="loading">Loading lesson...</div></div>;
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

      <div className="toggle-container">
        {lesson.parable && (
          <button className={`toggle-btn ${tab === 'parable' ? 'active' : ''}`} onClick={() => setTab('parable')}>🏰 Parable</button>
        )}
        {lesson.content && (
          <button className={`toggle-btn ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>📖 Lesson</button>
        )}
      </div>

      <article className={`lesson-content ${tab}`} key={tab}>
        {tab === 'parable' && lesson.parable && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.parable}</ReactMarkdown>
        )}
        {tab === 'content' && lesson.content && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.content}</ReactMarkdown>
        )}
      </article>

      <nav className="bottom-nav">
        {sortNum > 1 ? (
          <Link to={`/${series.key}/lesson/${sortNum - 1}`} className="nav-link">← Day {sortNum - 1}</Link>
        ) : <span />}
        {sortNum < totalLessons && (
          <Link to={`/${series.key}/lesson/${sortNum + 1}`} className="nav-link">Day {sortNum + 1} →</Link>
        )}
      </nav>
    </div>
  );
}
