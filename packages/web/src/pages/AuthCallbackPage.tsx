/**
 * Auth callback page — URL: /auth/callback
 *
 * Landing page after Google OAuth redirect. Reads the ?token= query parameter
 * (access token from the API's OAuth callback) and saves it to localStorage.
 * Immediately redirects to / with replace history.
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('accessToken', token);
    }
    navigate('/', { replace: true });
  }, [params, navigate]);

  return <div className="container"><div className="loading">Signing in...</div></div>;
}
