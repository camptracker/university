/**
 * Home page — URL: /
 *
 * Displays the top 20 series by subscriberCount (GET /api/series/popular).
 * Each series card links to /:seriesKey.
 *
 * Unauthenticated users see a "Sign in with Google" CTA.
 * Authenticated users see a "+ Create New Series" card linking to /new.
 */
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { type APISeries } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

export default function Home() {
  const [seriesList, setSeriesList] = useState<APISeries[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, login } = useAuth();

  useEffect(() => {
    api.get<APISeries[]>('/series/popular')
      .then(r => setSeriesList(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <header className="home-header">
        <h1>📜 Parable</h1>
        <p className="subtitle">Daily Lessons Through Stories</p>
        {!user && (
          <div className="home-cta">
            <p className="home-cta-text">Sign in to track your progress and create new series</p>
            <button className="btn-primary" onClick={login}>Sign in with Google</button>
          </div>
        )}
      </header>

      {loading ? (
        <div className="loading">Loading series...</div>
      ) : (
        <div className="series-grid">
          {seriesList.map(s => (
            <Link to={`/${s.key}`} key={s._id} className="series-card">
              <div className="series-card-emoji">{s.emoji || '📚'}</div>
              <h2 className="series-card-name">{s.title}</h2>
              <p className="series-card-theme">{s.description}</p>
              <div className="series-card-meta">
                <span>{s.subscriberCount} subscriber{s.subscriberCount !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          ))}
          {user && (
            <Link to="/new" className="series-card series-card-new">
              <div className="series-card-emoji">✨</div>
              <h2 className="series-card-name">Create New Series</h2>
              <p className="series-card-theme">Generate a new AI-powered learning series on any topic</p>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
