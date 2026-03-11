/**
 * Home page — URL: /
 *
 * Displays the top 20 series sorted by most recent (GET /api/series/popular).
 * Each series card links to /:seriesKey.
 *
 * Unauthenticated users see a "Sign in with Google" CTA.
 * Authenticated users see a "Create New Series" card at the top linking to /new.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { type APISeries } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

const RECOMMENDED_SERIES = [
  { emoji: '💰', title: 'Financial Independence', topic: 'Financial independence through investing, saving, and building wealth' },
  { emoji: '🏛️', title: 'Stoic Philosophy', topic: 'Stoic philosophy and practical wisdom for daily life' },
  { emoji: '🧭', title: 'Emotional Intelligence', topic: 'Emotional intelligence and self-awareness' },
  { emoji: '💕', title: 'Building Relationships', topic: 'Building and maintaining deep, meaningful relationships' },
  { emoji: '⏳', title: 'Health & Longevity', topic: 'Health, longevity, and evidence-based wellness practices' },
  { emoji: '🤝', title: 'Negotiation', topic: 'Negotiation tactics and persuasion' },
  { emoji: '🧘', title: 'Habits & Systems', topic: 'Building habits and systems for productivity' },
  { emoji: '🎵', title: 'Music Theory', topic: 'Music theory fundamentals and composition' },
];

export default function Home() {
  const [seriesList, setSeriesList] = useState<APISeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get<APISeries[]>('/series/popular')
      .then(r => setSeriesList(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreateSeries = async (topic: string) => {
    setCreating(true);
    try {
      const res = await api.post<APISeries>('/series', { topic });
      navigate(`/${res.data.key}`);
    } catch (err) {
      console.error('Failed to create series:', err);
      setCreating(false);
    }
  };

  return (
    <div className="container">
      <header className="home-header">
        <h1>🎓 University</h1>
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
        <>
          {user && (
            <div className="recommended-section">
              <h2 className="section-title">✨ Create New Series</h2>
              <p className="section-subtitle">Start with a recommended topic or <Link to="/new" className="custom-link">create your own</Link></p>
              <div className="series-grid">
                {RECOMMENDED_SERIES.map(rec => (
                  <button
                    key={rec.topic}
                    className="series-card series-card-recommended"
                    onClick={() => handleCreateSeries(rec.topic)}
                    disabled={creating}
                  >
                    <h2 className="series-card-name">{rec.emoji} {rec.title}</h2>
                    <p className="series-card-theme">{rec.topic}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {seriesList.length > 0 && (
            <div className="existing-section">
              <h2 className="section-title">📚 Existing Series</h2>
              <div className="series-grid">
                {seriesList.map(s => (
                  <Link to={`/${s.key}`} key={s._id} className="series-card">
                    <h2 className="series-card-name">{s.title}</h2>
                    <p className="series-card-theme">{s.description}</p>
                    <div className="series-card-meta">
                      <span>{s.subscriberCount} subscriber{s.subscriberCount !== 1 ? 's' : ''}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
