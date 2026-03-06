/**
 * Sidebar navigation component.
 *
 * Slide-out sidebar controlled by open/onClose props from App.tsx.
 * Renders a hamburger overlay, nav links, and a scrollable series list.
 *
 * Nav links:
 * - Discover (/) — always visible
 * - My Series (/subscriptions) — authenticated users only
 * - + New Series (/new) — authenticated users only
 * - Admin (/admin) — admin role only
 * - All active series (from GET /api/series) — always visible
 *
 * Footer: shows user avatar/name + Sign out button, or Sign in with Google button.
 * Fetches series list on mount (independent of auth state).
 */
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import api, { type APISeries } from '../lib/api.js';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, login, logout } = useAuth();
  const [seriesList, setSeriesList] = useState<APISeries[]>([]);
  const currentKey = location.pathname.split('/')[1] || '';

  useEffect(() => {
    api.get<APISeries[]>('/series').then(r => setSeriesList(r.data)).catch(() => {});
  }, []);

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={onClose}>📜 Parable</Link>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`}
            onClick={onClose}
          >
            <span className="sidebar-item-name">Discover</span>
          </Link>

          {user && (
            <>
              <Link
                to="/subscriptions"
                className={`sidebar-item ${location.pathname === '/subscriptions' ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="sidebar-item-name">My Series</span>
              </Link>
              <Link
                to="/new"
                className={`sidebar-item ${location.pathname === '/new' ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="sidebar-item-name">+ New Series</span>
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`sidebar-item ${location.pathname === '/admin' ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-item-name">Admin</span>
            </Link>
          )}

          <div className="sidebar-divider" />

          {seriesList.map(s => (
            <Link
              key={s._id}
              to={`/${s.key}`}
              className={`sidebar-item ${currentKey === s.key ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-item-name">{s.emoji ? `${s.emoji} ` : ''}{s.title}</span>
              <span className="sidebar-item-count">{s.subscriberCount}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <div className="sidebar-user">
              {user.picture && <img src={user.picture} alt={user.name} className="sidebar-avatar" />}
              <span className="sidebar-user-name">{user.name}</span>
              <button className="sidebar-logout" onClick={() => { logout(); onClose(); }}>Sign out</button>
            </div>
          ) : (
            <button className="sidebar-login" onClick={() => { login(); onClose(); }}>
              Sign in with Google
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
