/**
 * Admin page — URL: /admin
 *
 * Auth guard: redirects to / if not authenticated or not admin role.
 *
 * Two-tab interface:
 * - Users tab: lists all users with role badges; admins can toggle any other user's
 *   role between 'user' and 'admin' (PATCH /api/users/:id/role)
 * - Series tab: lists all series; admins can soft-delete with confirmation
 *   (DELETE /api/series/:id)
 *
 * Data: fetches GET /api/users and GET /api/series on mount (parallel).
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { type APIUser, type APISeries } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.js';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<APIUser[]>([]);
  const [seriesList, setSeriesList] = useState<APISeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'series'>('users');

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    Promise.all([
      api.get<APIUser[]>('/users'),
      api.get<APISeries[]>('/series'),
    ])
      .then(([usersRes, seriesRes]) => {
        setUsers(usersRes.data);
        setSeriesList(seriesRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    await api.patch(`/users/${userId}/role`, { role: newRole });
    setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
  };

  const handleDeleteSeries = async (seriesId: string) => {
    if (!confirm('Soft-delete this series and all its lessons?')) return;
    await api.delete(`/series/${seriesId}`);
    setSeriesList(prev => prev.filter(s => s._id !== seriesId));
  };

  if (authLoading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="container">
      <header className="home-header">
        <h1>Admin Panel</h1>
      </header>

      <div className="toggle-container">
        <button className={`toggle-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`toggle-btn ${tab === 'series' ? 'active' : ''}`} onClick={() => setTab('series')}>Series</button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : tab === 'users' ? (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="admin-user-cell">
                      {u.picture && <img src={u.picture} alt={u.name} className="admin-avatar" />}
                      {u.name}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    {u._id !== user._id && (
                      <button
                        className="btn-small"
                        onClick={() => handleRoleChange(u._id, u.role === 'admin' ? 'user' : 'admin')}
                      >
                        Make {u.role === 'admin' ? 'user' : 'admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Key</th>
                <th>Subscribers</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {seriesList.map(s => (
                <tr key={s._id}>
                  <td>{s.emoji} {s.title}</td>
                  <td><code>{s.key}</code></td>
                  <td>{s.subscriberCount}</td>
                  <td>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => handleDeleteSeries(s._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
