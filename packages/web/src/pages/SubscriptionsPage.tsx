/**
 * Subscriptions page — URL: /subscriptions
 *
 * Auth guard: redirects to / if not authenticated.
 *
 * Displays the user's subscribed series as cards (GET /api/subscriptions).
 * Each card links to /:seriesKey. Also shows a "+ Create New Series" card.
 * Shows empty state with Browse link if user has no subscriptions.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api, { type APISubscription } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [subs, setSubs] = useState<APISubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get<APISubscription[]>('/subscriptions')
      .then(r => setSubs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="container">
      <header className="home-header">
        <h1>My Series</h1>
        <p className="subtitle">Your subscribed learning series</p>
      </header>

      {loading ? (
        <div className="loading">Loading subscriptions...</div>
      ) : subs.length === 0 ? (
        <div className="empty-state">
          <p>You haven't subscribed to any series yet.</p>
          <Link to="/" className="btn-primary">Browse Series</Link>
        </div>
      ) : (
        <div className="series-grid">
          {subs.map(sub => (
            <Link to={`/${sub.seriesId.key}`} key={sub._id} className="series-card">
              <div className="series-card-emoji">{sub.seriesId.emoji || '📚'}</div>
              <h2 className="series-card-name">{sub.seriesId.title}</h2>
              <p className="series-card-theme">{sub.seriesId.description}</p>
              <div className="series-card-meta">
                <span>{sub.seriesId.subscriberCount} subscriber{sub.seriesId.subscriberCount !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
          <Link to="/new" className="series-card series-card-new">
            <div className="series-card-emoji">✨</div>
            <h2 className="series-card-name">Create New Series</h2>
            <p className="series-card-theme">Generate a new AI-powered learning series</p>
          </Link>
        </div>
      )}
    </div>
  );
}
