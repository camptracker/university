/**
 * New Series page — URL: /new
 *
 * Auth guard: redirects to / if not authenticated.
 *
 * Single text input for a topic string. On submit, POSTs to /api/series with {topic}.
 * On success, navigates to /:series.key.
 * Handles rate limit (429): shows "max 3 series per day" message.
 * Note: series creation is async — the API returns the series before the first lesson
 * is generated. The user lands on SeriesPage which will show generation status.
 */
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api, { type APISeries } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

export default function NewSeriesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number } };
      if (axiosErr.response?.status === 429) {
        setError('Rate limit: you can create up to 3 series per day.');
      } else {
        setError(axiosErr.response?.data?.error || msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="home-header">
        <h1>Create New Series</h1>
        <p className="subtitle">Generate an AI-powered daily learning series on any topic</p>
      </header>

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
          <p className="form-hint">Be specific — your topic will be turned into a series of daily stories and lessons.</p>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading || !topic.trim()}>
          {loading ? 'Generating series...' : 'Create Series'}
        </button>

        {loading && (
          <p className="form-hint">This may take 30–60 seconds while AI generates your first lesson.</p>
        )}
      </form>
    </div>
  );
}
