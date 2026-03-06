/**
 * Root application component.
 *
 * Sets up AuthProvider, BrowserRouter, and the full route table:
 * - /                            → Home
 * - /subscriptions               → SubscriptionsPage (auth required)
 * - /new                         → NewSeriesPage (auth required)
 * - /auth/callback               → AuthCallbackPage (stores access token from OAuth redirect)
 * - /admin                       → AdminPage (admin only)
 * - /:seriesKey                  → SeriesPage
 * - /:seriesKey/lesson/:sortOrder → LessonPage
 *
 * Also renders the Sidebar (slide-out nav) and hamburger toggle button.
 * Forces dark mode on mount via data-theme attribute.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider } from './hooks/useAuth.js';
import Sidebar from './components/Sidebar.js';
import Home from './pages/Home.js';
import SeriesPage from './pages/SeriesPage.js';
import LessonPage from './pages/LessonPage.js';
import SubscriptionsPage from './pages/SubscriptionsPage.js';
import AuthCallbackPage from './pages/AuthCallbackPage.js';
import AdminPage from './pages/AdminPage.js';
import NewSeriesPage from './pages/NewSeriesPage.js';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="main-content">
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              ☰
            </button>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/new" element={<NewSeriesPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/:seriesKey" element={<SeriesPage />} />
              <Route path="/:seriesKey/lesson/:sortOrder" element={<LessonPage />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
