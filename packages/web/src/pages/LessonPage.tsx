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
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { type APILesson, type APISeries, type APILessonsResponse } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

type Tab = 'parable' | 'content';

export default function LessonPage() {
  const { seriesKey, sortOrder } = useParams<{ seriesKey: string; sortOrder: string }>();
  const { user } = useAuth();
  const [series, setSeries] = useState<APISeries | null>(null);
  const [lesson, setLesson] = useState<APILesson | null>(null);
  const [totalLessons, setTotalLessons] = useState(0);
  const [tab, setTab] = useState<Tab>('parable');
  const [loading, setLoading] = useState(true);

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
        setTotalLessons(r.data.total);
        const all = r.data.lessons;
        const found = all.find(l => l.sortOrder === Number(sortOrder));
        if (!found) return;
        return api.get<APILesson>(`/lessons/${found._id}`);
      })
      .then(r => {
        if (!r) return;
        setLesson(r.data);
        // Auto mark as read
        if (user) {
          api.post(`/lessons/${r.data._id}/read`).catch(() => {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [seriesKey, sortOrder, user]);

  if (loading) return <div className="container"><div className="loading">Loading lesson...</div></div>;
  if (!lesson || !series) return <div className="container"><p>Lesson not found.</p><Link to="/" className="nav-link">← Home</Link></div>;

  const sortNum = lesson.sortOrder;

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
