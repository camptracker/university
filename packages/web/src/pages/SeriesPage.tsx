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
import { useEffect, useRef, useState } from 'react';
import api, { type APISeries, type APILesson, type APIProgress, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

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
  const generatingRef = useRef(false);
  const seriesIdRef = useRef<string | null>(null);

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
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesKey, user]);

  // Poll generation status every 5s
  useEffect(() => {
    if (!series) return;
    const seriesId = series._id;
    const poll = setInterval(async () => {
      try {
        const res = await api.get<{ generating: boolean }>(`/series/${seriesId}/generation-status`);
        const nowGenerating = res.data.generating;
        if (generatingRef.current && !nowGenerating) {
          // Generation just finished — refresh lessons
          fetchLessons(seriesId);
        }
        generatingRef.current = nowGenerating;
        setGenerating(nowGenerating);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

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

  const handleGenerate = async () => {
    if (!series || generating) return;
    setGenLoading(true);
    try {
      await api.post(`/series/${series._id}/generate`);
      setGenerating(true);
      generatingRef.current = true;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setGenerating(true);
        generatingRef.current = true;
      } else {
        console.error('Generate error:', err);
      }
    } finally {
      setGenLoading(false);
    }
  };

  if (notFound) return <Navigate to="/" replace />;
  if (loading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!series) return null;

  const currentDay = progress?.currentDay ?? 1;

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/" className="nav-link">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <span>{series.title}</span>
      </nav>

      <header className="home-header">
        <div className="series-title-row">
          {series.emoji && <span className="series-hero-emoji">{series.emoji}</span>}
          <h1>{series.title}</h1>
        </div>
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

      {user?.role === 'admin' && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            className="btn-subscribe"
            onClick={handleGenerate}
            disabled={generating || genLoading}
          >
            {generating || genLoading ? '⏳ Generating…' : 'Generate Next Lesson'}
          </button>
        </div>
      )}

      {subscribed && total > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Day {currentDay} of {total} lesson{total !== 1 ? 's' : ''}
        </p>
      )}

      {!subscribed && user && lessons.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.75rem' }}>Subscribe to track your progress through this series.</p>
          <button className="btn-subscribe" onClick={handleSubscribe} disabled={subLoading}>
            Subscribe to start learning
          </button>
        </div>
      )}

      <div className="lesson-list">
        {lessons.map(lesson => {
          const isLocked = subscribed && lesson.sortOrder > currentDay;

          if (isLocked) {
            return (
              <div key={lesson._id} className="lesson-card" style={{ opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' }}>
                {lesson.image && (
                  <img src={lesson.image} alt={lesson.title} className="lesson-card-img" />
                )}
                <div className="lesson-card-text">
                  <span className="lesson-day">Day {lesson.sortOrder}</span>
                  <span className="lesson-title">{lesson.title} 🔒</span>
                </div>
              </div>
            );
          }

          return (
            <Link to={`/${series.key}/lesson/${lesson.sortOrder}`} key={lesson._id} className="lesson-card">
              {lesson.image && (
                <img src={lesson.image} alt={lesson.title} className="lesson-card-img" />
              )}
              <div className="lesson-card-text">
                <span className="lesson-day">Day {lesson.sortOrder}</span>
                <span className="lesson-title">{lesson.title}</span>
              </div>
            </Link>
          );
        })}
        {lessons.length === 0 && (
          <p className="empty-state">{generating ? 'Generating first lesson…' : 'Lessons are being generated...'}</p>
        )}
        {generating && lessons.length > 0 && (
          <div className="lesson-card" style={{ opacity: 0.5, cursor: 'default', justifyContent: 'center' }}>
            <div className="lesson-card-text" style={{ textAlign: 'center' }}>
              <span className="lesson-title">⏳ Generating next lesson…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
