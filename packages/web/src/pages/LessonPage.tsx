/**
 * Lesson page — URL: /:seriesKey/lesson/:sortOrder
 *
 * Displays a single lesson with three content tabs: Parable, Content, Poem.
 *
 * Data loaded:
 * - GET /api/series → find series by key
 * - GET /api/series/:id/lessons → get lesson list to find lessonId by sortOrder
 * - GET /api/lessons/:lessonId → full lesson
 *
 * Key behaviors:
 * - "Mark as Read & Continue" button (shown when isCurrentDay):
 *   PATCH /api/series/:id/progress/advance → advances progress and navigates to next lesson
 * - "Mark as read" button (standalone): POST /api/lessons/:id/read
 * - Bottom nav provides prev/next day links (no boundary check)
 * - Scrolls to top on lesson/series change
 * - Content tab renders lesson.content as markdown
 */
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import api, { type APILesson, type APISeries, type APIProgress, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

type Tab = 'parable' | 'content' | 'poem';

export default function LessonPage() {
  const { seriesKey, sortOrder } = useParams<{ seriesKey: string; sortOrder: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [series, setSeries] = useState<APISeries | null>(null);
  const [lesson, setLesson] = useState<APILesson | null>(null);
  const [progress, setProgress] = useState<APIProgress | null>(null);
  const [totalLessons, setTotalLessons] = useState(0);
  const [tab, setTab] = useState<Tab>('parable');
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [seriesKey, sortOrder]);

  useEffect(() => {
    if (!seriesKey || !sortOrder) return;
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
        setProgress(r.data.progress);
        setTotalLessons(r.data.total);
        const all = r.data.lessons;
        const found = all.find(l => l.sortOrder === Number(sortOrder));
        if (!found) return;
        return api.get<APILesson>(`/lessons/${found._id}`);
      })
      .then(r => {
        if (!r) return;
        setLesson(r.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [seriesKey, sortOrder]);

  const handleMarkRead = async () => {
    if (!lesson || !user) return;
    try {
      await api.post(`/lessons/${lesson._id}/read`);
      setMarked(true);
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleAdvance = async () => {
    if (!lesson || !series || !user || !progress) return;
    setAdvancing(true);
    try {
      const res = await api.patch<{ currentDay: number; hasNext: boolean }>(
        `/series/${series._id}/progress/advance`
      );
      setMarked(true);
      if (res.data.hasNext) {
        navigate(`/${series.key}/lesson/${lesson.sortOrder + 1}`);
      } else {
        navigate(`/${series.key}`);
      }
    } catch (err) {
      console.error('Advance error:', err);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) return <div className="container"><div className="loading">Loading lesson...</div></div>;
  if (!lesson || !series) return <div className="container"><p>Lesson not found.</p><Link to="/" className="nav-link">← Home</Link></div>;

  const sortNum = lesson.sortOrder;
  const isCurrentDay = progress !== null && sortNum === progress.currentDay;
  const hasNextLesson = sortNum < totalLessons;

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
        {user && (
          <button
            className={`btn-read ${marked ? 'read' : ''}`}
            onClick={handleMarkRead}
            disabled={marked}
          >
            {marked ? '✓ Read' : 'Mark as read'}
          </button>
        )}
      </header>

      <div className="toggle-container">
        {lesson.parable && (
          <button className={`toggle-btn ${tab === 'parable' ? 'active' : ''}`} onClick={() => setTab('parable')}>🏰 Parable</button>
        )}
        {lesson.content && (
          <button className={`toggle-btn ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>📖 Lesson</button>
        )}
        {lesson.poem && (
          <button className={`toggle-btn ${tab === 'poem' ? 'active' : ''}`} onClick={() => setTab('poem')}>📜 Poem</button>
        )}
      </div>

      <article className={`lesson-content ${tab}`} key={tab}>
        {tab === 'parable' && lesson.parable && (
          <ReactMarkdown>{lesson.parable}</ReactMarkdown>
        )}
        {tab === 'content' && lesson.content && (
          <ReactMarkdown>{lesson.content}</ReactMarkdown>
        )}
        {tab === 'poem' && lesson.poem && (
          <div className="poem-content">
            <ReactMarkdown>{lesson.poem}</ReactMarkdown>
          </div>
        )}
      </article>

      <nav className="bottom-nav">
        {sortNum > 1 ? (
          <Link to={`/${series.key}/lesson/${sortNum - 1}`} className="nav-link">← Day {sortNum - 1}</Link>
        ) : <span />}
        <Link to={`/${series.key}/lesson/${sortNum + 1}`} className="nav-link">Day {sortNum + 1} →</Link>
      </nav>

      {user && progress && isCurrentDay && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            className="btn-subscribe"
            onClick={handleAdvance}
            disabled={advancing}
            style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}
          >
            {advancing ? 'Saving…' : hasNextLesson ? 'Mark as Read & Continue →' : 'Mark as Read & Finish'}
          </button>
        </div>
      )}
    </div>
  );
}
