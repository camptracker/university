/**
 * Series page — URL: /:seriesKey
 *
 * Shows the lesson list for a series, subscribe/unsubscribe controls, and generation status.
 *
 * Data fetched on load:
 * - GET /api/series → find series by key
 * - GET /api/series/:id/lessons → lesson list with progress
 * - GET /api/subscriptions → check if user is subscribed (auth only)
 * - GET /api/series/:id/generation-status → is a lesson currently generating?
 *
 * Key behaviors:
 * - Polls generation-status every 5s; refreshes lessons when generation finishes
 * - Lessons above currentDay are locked (greyed out, no link) for subscribers
 * - Admin users see a "Generate Next Lesson" button (POST /api/series/:id/generate)
 * - Subscribe/unsubscribe updates subscriberCount optimistically
 * - Redirects to / if series not found
 */
import { Link, useParams, Navigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { type APISeries, type APILesson, type APIProgress, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const API_BASE = (api.defaults.baseURL || '').replace(/\/api$/, '');

export default function SeriesPage() {
  const { seriesKey } = useParams<{ seriesKey: string }>();
  const { user } = useAuth();
  const [series, setSeries] = useState<APISeries | null>(null);
  const [lessons, setLessons] = useState<APILesson[]>([]);
  const [total, setTotal] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [progress, setProgress] = useState<APIProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [streamingContent, setStreamingContent] = useState<{ standard: string; parable: string; phase: string } | null>(null);
  const [streamTab, setStreamTab] = useState<'standard' | 'parable'>('standard');
  const generatingRef = useRef(false);
  const seriesIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const fetchLessons = (seriesId: string) => {
    return api.get<APILessonsResponse>(`/series/${seriesId}/lessons`)
      .then(r => {
        setLessons(r.data.lessons);
        setTotal(r.data.total);
        setProgress(r.data.progress);
      });
  };

  useEffect(() => {
    if (!seriesKey) return;
    setLoading(true);

    api.get<APISeries[]>('/series')
      .then(async (r) => {
        const found = r.data.find(s => s.key === seriesKey);
        if (!found) { setNotFound(true); return; }
        setSeries(found);
        seriesIdRef.current = found._id;

        // Fetch remaining data independently — don't let one failure break all
        const [lessonsRes, subsRes, statusRes] = await Promise.allSettled([
          api.get<APILessonsResponse>(`/series/${found._id}/lessons`),
          user ? api.get<{ _id: string; seriesId: APISeries }[]>('/subscriptions') : Promise.resolve(null),
          api.get<{ generating: boolean }>(`/series/${found._id}/generation-status`),
        ]);

        if (lessonsRes.status === 'fulfilled' && lessonsRes.value) {
          setLessons(lessonsRes.value.data.lessons);
          setTotal(lessonsRes.value.data.total);
          setProgress(lessonsRes.value.data.progress);
        }
        if (subsRes.status === 'fulfilled' && subsRes.value) {
          const sub = subsRes.value.data.find((s: { seriesId: APISeries }) => s.seriesId._id === found._id);
          setSubscribed(!!sub);
        }
        if (statusRes.status === 'fulfilled' && statusRes.value) {
          const gen = statusRes.value.data.generating;
          setGenerating(gen);
          generatingRef.current = gen;
        }
      })
      .catch((err) => console.error('Series load error:', err))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey, user]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const handleSubscribe = async () => {
    if (!series || !user) return;
    setSubLoading(true);
    try {
      if (subscribed) {
        await api.delete(`/series/${series._id}/subscribe`);
        setSubscribed(false);
        setProgress(null);
        setSeries(prev => prev ? { ...prev, subscriberCount: prev.subscriberCount - 1 } : prev);
      } else {
        await api.post(`/series/${series._id}/subscribe`);
        setSubscribed(true);
        setSeries(prev => prev ? { ...prev, subscriberCount: prev.subscriberCount + 1 } : prev);
        // Refresh to get new progress
        fetchLessons(series._id);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleGenerate = useCallback(() => {
    if (!series || generating) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setGenerating(true);
    generatingRef.current = true;
    setStreamingContent({ standard: '', parable: '', phase: 'standard' });
    setStreamTab('standard');

    const es = new EventSource(`${API_BASE}/api/series/${series._id}/generate-stream?token=${token}`);
    esRef.current = es;

    es.addEventListener('phase', (e) => {
      const { phase } = JSON.parse(e.data);
      setStreamingContent(prev => prev ? { ...prev, phase } : prev);
      if (phase === 'parable') setStreamTab('parable');
    });

    es.addEventListener('delta', (e) => {
      const { section, text } = JSON.parse(e.data);
      setStreamingContent(prev => {
        if (!prev) return prev;
        return { ...prev, [section]: prev[section as 'standard' | 'parable'] + text };
      });
    });

    es.addEventListener('done', (_e) => {
      es.close();
      esRef.current = null;
      setGenerating(false);
      generatingRef.current = false;
      setStreamingContent(null);
      if (series) fetchLessons(series._id);
    });

    es.addEventListener('error', (e) => {
      console.error('SSE error:', e);
      es.close();
      esRef.current = null;
      setGenerating(false);
      generatingRef.current = false;
      setStreamingContent(null);
    });
  }, [series, generating]);

  if (notFound) return <Navigate to="/" replace />;
  if (loading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!series) return null;

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/" className="nav-link">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <span>{series.title}</span>
      </nav>

      <header className="home-header" style={{ textAlign: 'left', paddingTop: '0.5rem' }}>
        <h1>{series.title}</h1>
        <p className="subtitle">{series.description}</p>
        <div className="series-meta-row">
          <span className="series-subscriber-count">{series.subscriberCount} subscriber{series.subscriberCount !== 1 ? 's' : ''}</span>
          {user && (
            <button
              className={`btn-subscribe ${subscribed ? 'subscribed' : ''}`}
              onClick={handleSubscribe}
              disabled={subLoading}
            >
              {subscribed ? 'Unsubscribe' : 'Subscribe'}
            </button>
          )}
        </div>
      </header>

      <div className="lesson-list">
        {lessons.map(lesson => (
          <Link
            to={`/${series.key}/lesson/${lesson.sortOrder}`}
            key={lesson._id}
            className="lesson-card"
            style={lesson.read ? { opacity: 0.5 } : undefined}
          >
            {lesson.image && (
              <img src={lesson.image} alt={lesson.title} className="lesson-card-img" />
            )}
            <div className="lesson-card-text">
              <span className="lesson-day">Day {lesson.sortOrder}</span>
              <span className="lesson-title">{lesson.title}{lesson.read ? ' ✓' : ''}</span>
            </div>
          </Link>
        ))}
        {lessons.length === 0 && (
          <p className="empty-state">{generating ? 'Generating first lesson…' : 'Lessons are being generated...'}</p>
        )}
      </div>

      {streamingContent && (
        <div className="streaming-preview" style={{ marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', background: 'var(--surface)' }}>
          <div style={{ marginBottom: '0.75rem', color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem' }}>
            {streamingContent.phase === 'standard' && '✍️ Generating lesson...'}
            {streamingContent.phase === 'parable' && '📖 Writing parable...'}
            {streamingContent.phase === 'meta' && '🎵 Creating sonnet & metadata...'}
            {streamingContent.phase === 'image' && '🎨 Generating image...'}
          </div>

          <div className="toggle-container" style={{ marginBottom: '0.75rem' }}>
            <button
              className={`toggle-btn ${streamTab === 'standard' ? 'active' : ''}`}
              onClick={() => setStreamTab('standard')}
              disabled={!streamingContent.standard}
            >📖 Lesson</button>
            <button
              className={`toggle-btn ${streamTab === 'parable' ? 'active' : ''}`}
              onClick={() => setStreamTab('parable')}
              disabled={!streamingContent.parable}
            >🏰 Parable</button>
          </div>

          <article className="lesson-content">
            {streamTab === 'standard' && streamingContent.standard && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent.standard}</ReactMarkdown>
            )}
            {streamTab === 'parable' && streamingContent.parable && (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent.parable}</ReactMarkdown>
            )}
            {!streamingContent.standard && !streamingContent.parable && (
              <div className="skeleton-line skeleton-long" style={{ marginTop: '0.5rem' }} />
            )}
          </article>
        </div>
      )}

      {user?.role === 'admin' && !generating && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            className="btn-subscribe"
            onClick={handleGenerate}
          >
            Generate Next Lesson
          </button>
        </div>
      )}
    </div>
  );
}
