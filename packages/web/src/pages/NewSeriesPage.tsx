/**
 * New Series page — URL: /new
 *
 * Auth guard: redirects to / if not authenticated.
 *
 * Single text input for a topic string. On submit, POSTs to /api/series with {topic}.
 * On success, navigates to /:series.key.
 * Note: series creation is async — the API returns the series before the first lesson
 * is generated. The user lands on SeriesPage which will show generation status.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api, { type APISeries } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

interface DailyTheme {
  emoji: string;
  title: string;
  topic: string;
}

export default function NewSeriesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dailyThemes, setDailyThemes] = useState<DailyTheme[]>([]);

  // Fetch daily AI-generated themes on mount
  useEffect(() => {
    api.get<{ themes: DailyTheme[]; generatedAt: string | null }>('/themes/daily')
      .then(res => {
        if (res.data.themes && res.data.themes.length > 0) {
          setDailyThemes(res.data.themes);
        }
      })
      .catch(err => {
        console.error('Failed to load daily themes:', err);
        // No fallback - only show AI-generated themes
      });
  }, []);

  if (authLoading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<APISeries>('/series', { topic: topic.trim() });
      navigate(`/${res.data.key}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create series';
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeries = async (topicText: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<APISeries>('/series', { topic: topicText });
      navigate(`/${res.data.key}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create series';
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || msg);
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="home-header">
        <h1>Create New Series</h1>
      </header>

      {/* Custom topic form */}
      <form className="new-series-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="topic" className="form-label">What do you want to learn?</label>
          <input
            id="topic"
            type="text"
            className="form-input"
            placeholder="e.g. Stoic philosophy, Machine learning, Personal finance..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            disabled={loading}
            maxLength={200}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading || !topic.trim()}>
          {loading ? 'Generating series...' : 'Create Series'}
        </button>

        {loading && (
          <p className="form-hint">This may take 30–60 seconds while AI generates your first lesson.</p>
        )}
      </form>

      {/* Daily themes - only show if loaded from API */}
      {dailyThemes.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <p className="form-hint" style={{ marginBottom: '0.75rem' }}>Recommended themes:</p>
          <div className="topic-tags">
            {dailyThemes.map(theme => (
              <button
                key={theme.topic}
                className="topic-tag"
                onClick={() => handleCreateSeries(theme.topic)}
                disabled={loading}
              >
                {theme.emoji} {theme.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
