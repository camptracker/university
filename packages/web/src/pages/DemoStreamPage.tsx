/**
 * Demo Stream page — /demo-stream
 * Picks a random lesson from DB and mock-streams it using the same SSE + word-by-word UI.
 */
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import StreamingText from '../components/StreamingText.js';
import api from '../lib/api.js';

const API_BASE = (api.defaults.baseURL || '').replace(/\/api$/, '');

type Tab = 'parable' | 'content';

export default function DemoStreamPage() {
  const [tab, setTab] = useState<Tab>('parable');
  const [streamPhase, setStreamPhase] = useState('');
  const [streamStandard, setStreamStandard] = useState('');
  const [streamParable, setStreamParable] = useState('');
  const [streamImage, setStreamImage] = useState<string | null>(null);
  const [streamDone, setStreamDone] = useState(false);
  const [started, setStarted] = useState(false);
  const autoStarted = useRef(false);

  // Auto-start on mount
  useEffect(() => {
    if (!autoStarted.current) {
      autoStarted.current = true;
      const token = localStorage.getItem('accessToken');
      if (token) startStream();
    }
  }, []);

  const startStream = () => {
    setStarted(true);
    setStreamPhase('');
    setStreamStandard('');
    setStreamParable('');
    setStreamImage(null);
    setStreamDone(false);
    setTab('parable');

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const es = new EventSource(`${API_BASE}/api/series/demo-stream?token=${token}`);

    es.addEventListener('phase', (e) => {
      const { phase } = JSON.parse(e.data);
      setStreamPhase(phase);
      if (phase === 'parable') setTab('parable');
    });

    es.addEventListener('delta', (e) => {
      const { section, text } = JSON.parse(e.data);
      if (section === 'standard') setStreamStandard(prev => prev + text);
      if (section === 'parable') setStreamParable(prev => prev + text);
    });

    es.addEventListener('done', (e) => {
      const { image } = JSON.parse(e.data);
      if (image) setStreamImage(image);
      setStreamDone(true);
      es.close();
    });

    es.addEventListener('error', () => {
      es.close();
      setStreamDone(true);
    });
  };

  const phaseLabel: Record<string, string> = {
    parable: '📖 Streaming parable...',
    standard: '✍️ Streaming lesson...',
    image: '🎨 Loading image...',
  };

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/" className="nav-link">Home</Link>
        <span className="breadcrumb-sep">›</span>
        <span>Demo Stream</span>
      </nav>

      {!started ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h1 style={{ color: 'var(--gold)', marginBottom: '1rem' }}>🎬 Demo Stream</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Streams a random lesson from the database with word-by-word rendering.
          </p>
          <button className="btn-subscribe" onClick={startStream}>Start Demo</button>
        </div>
      ) : (
        <>
          {streamImage && (
            <div className="lesson-hero">
              <img src={streamImage} alt="Lesson" />
            </div>
          )}

          <header className="lesson-header">
            <span className="lesson-day-badge">Demo</span>
            {!streamDone && streamPhase && (
              <p style={{ color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 600 }}>
                {phaseLabel[streamPhase] || 'Starting...'}
              </p>
            )}
            {streamDone && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ✅ Stream complete — <button onClick={startStream} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', font: 'inherit', padding: 0, textDecoration: 'underline' }}>run again</button>
              </p>
            )}
          </header>

          <div className="toggle-container">
            <button
              className={`toggle-btn ${tab === 'parable' ? 'active' : ''}`}
              onClick={() => setTab('parable')}
            >🏰 Parable</button>
            <button
              className={`toggle-btn ${tab === 'content' ? 'active' : ''}`}
              onClick={() => setTab('content')}
              disabled={!streamStandard}
            >📖 Lesson</button>
          </div>

          <article>
            {tab === 'parable' && streamParable && (
              <StreamingText text={streamParable} className="parable" />
            )}
            {tab === 'content' && streamStandard && (
              <StreamingText text={streamStandard} className="content" />
            )}
            {tab === 'parable' && !streamParable && !streamDone && (
              <div style={{ padding: '2rem 0' }}>
                <div className="skeleton-line skeleton-long" />
                <div className="skeleton-line skeleton-short" style={{ marginTop: '0.5rem' }} />
              </div>
            )}
          </article>
        </>
      )}
    </div>
  );
}
