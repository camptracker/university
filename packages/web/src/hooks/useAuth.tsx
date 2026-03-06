/**
 * Authentication context and provider.
 *
 * Exports:
 * - `AuthProvider` — wraps the app; manages user state and token lifecycle
 * - `useAuth()` — returns {user, loading, login, logout, refresh}
 *
 * Initialization: on mount, tries localStorage.accessToken → GET /api/users/me.
 * Falls back to POST /auth/refresh (httpOnly cookie) if token is missing or invalid.
 *
 * Methods:
 * - login() — redirects to /auth/google
 * - logout() — POST /auth/logout, clears localStorage, nulls user state
 * - refresh() — POST /auth/refresh, updates token + user state
 *
 * Admin check: user?.role === 'admin' (no separate hook needed)
 * Dependencies: axios (direct, not the api client, for auth endpoints)
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';
import { type APIUser } from '../lib/api.js';

interface AuthState {
  user: APIUser | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<APIUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.post('/auth/refresh', {}, { withCredentials: true });
      localStorage.setItem('accessToken', res.data.accessToken);
      setUser(res.data.user as APIUser);
    } catch {
      localStorage.removeItem('accessToken');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Fetch user profile
      axios.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      })
        .then(r => setUser(r.data as APIUser))
        .catch(() => refresh())
        .finally(() => setLoading(false));
    } else {
      refresh().finally(() => setLoading(false));
    }
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = '/auth/google';
  }, []);

  const logout = useCallback(async () => {
    await axios.post('/auth/logout', {}, { withCredentials: true });
    localStorage.removeItem('accessToken');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
