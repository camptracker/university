/**
 * Series page — URL: /:seriesKey
 *
 * Shows lesson list. When 0 lessons + admin, auto-starts SSE to generate first lesson
 * and shows a placeholder card that fills in with title + image. Clicking navigates
 * to the lesson page. For subsequent lessons, "Generate Next Lesson" navigates to
 * lesson page with ?stream=true.
 */
import { Link, useParams, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import api, { type APISeries, type APILesson, type APIProgress, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const API_BASE = (api.defaults.baseURL || '').replace(/\/api$/, '');

export default function SeriesPage() {
  const { seriesKey } = useParams<{ seriesKey: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [series, setSeries] = useState<APISeries | null>(null);
  const [lessons, setLessons] = useState<APILesson[]>([]);
  const [total, setTotal] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [progress, setProgress] = useState<APIProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // First-lesson streaming placeholder state
  const [placeholderTitle, setPlaceholderTitle] = useState<string | null>(null);
  const [placeholderImage, setPlaceholderImage] = useState<string | null>(null);
  const [placeholderPhase, setPlaceholderPhase] = useState<string>('');
  const esRef = useRef<EventSource | null>(null);
  const autoStartedRef = useRef(false);

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
          setGenerating(statusRes.value.data.generating);
        }
      })
      .catch((err) => console.error('Series load error:', err))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey, user]);

  // Auto-start first lesson: navigate to lesson page with streaming
  useEffect(() => {
    if (!series || loading || autoStartedRef.current) return;
    if (lessons.length > 0 || generating) return;
    if (user?.role !== 'admin') return;

    autoStartedRef.current = true;
    navigate(`/${series.key}/lesson/1?stream=true`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, loading, lessons.length, generating, user]);

  // Cleanup SSE on unmount
  useEffect(() => () => { esRef.current?.close(); }, []);

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
        fetchLessons(series._id);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!series || generating) return;
    const nextDay = (lessons.length > 0 ? Math.max(...lessons.map(l => l.sortOrder)) : 0) + 1;
    navigate(`/${series.key}/lesson/${nextDay}?stream=true`);
  };

  if (notFound) return <Navigate to="/" replace />;
  if (loading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!series) return null;

  const phaseLabel: Record<string, string> = {
    standard: 'Writing lesson...',
    parable: 'Writing parable...',
    meta: 'Finishing up...',
    image: 'Generating image...',
  };

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/" className="nav-link">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <span>{series.title}</span>
      </nav>

      <header className="home-header" style={{ textAlign: 'left', paddingTop: '0.5rem' }}>
        <h1>{series.title}</h1>
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

        {/* Placeholder card for first lesson being generated */}
        {generating && lessons.length === 0 && (
          <Link
            to={`/${series.key}/lesson/1?stream=true`}
            className="lesson-card"
            onClick={() => { esRef.current?.close(); esRef.current = null; }}
          >
            {placeholderImage ? (
              <img src={placeholderImage} alt={placeholderTitle || 'Generating...'} className="lesson-card-img" />
            ) : (
              <div className="skeleton-img" />
            )}
            <div className="lesson-card-text">
              <span className="lesson-day">Day 1</span>
              <span className="lesson-title">
                {placeholderTitle || (phaseLabel[placeholderPhase] || 'Generating...')}
              </span>
            </div>
          </Link>
        )}
      </div>

      {user?.role === 'admin' && !generating && lessons.length > 0 && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="btn-subscribe" onClick={handleGenerate}>
            Generate Next Lesson
          </button>
        </div>
      )}
    </div>
  );
}
