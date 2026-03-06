/**
 * Dev/Admin diagnostic page — URL: /dev
 *
 * Admin-only page listing all API endpoints with interactive "Run" buttons.
 * Each result shows: method, URL, status code (color-coded), response time, raw JSON.
 * Endpoints with parameters show input fields.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import api from '../lib/api.js';
import axios from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Param {
  name: string;
  placeholder?: string;
}

interface BodyField {
  name: string;
  placeholder?: string;
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  params?: Param[];
  bodyFields?: BodyField[];
  linkOnly?: boolean;
  note?: string;
}

interface EndpointGroup {
  label: string;
  endpoints: Endpoint[];
}

interface RunResult {
  method: string;
  url: string;
  status: number | null;
  ms: number;
  data: unknown;
  error?: string;
}

// ─── Endpoint definitions ─────────────────────────────────────────────────────

const GROUPS: EndpointGroup[] = [
  {
    label: 'Auth',
    endpoints: [
      { method: 'GET', path: '/auth/google', linkOnly: true, note: 'OAuth redirect — open in browser' },
      { method: 'POST', path: '/auth/refresh' },
      { method: 'POST', path: '/auth/logout' },
    ],
  },
  {
    label: 'Users',
    endpoints: [
      { method: 'GET', path: '/api/users/me' },
      { method: 'GET', path: '/api/users' },
      {
        method: 'PATCH',
        path: '/api/users/:userId/role',
        params: [{ name: 'userId', placeholder: 'User ID' }],
        bodyFields: [{ name: 'role', placeholder: 'user | admin' }],
      },
    ],
  },
  {
    label: 'Series',
    endpoints: [
      { method: 'GET', path: '/api/series' },
      { method: 'GET', path: '/api/series/popular' },
      {
        method: 'POST',
        path: '/api/series',
        bodyFields: [
          { name: 'title', placeholder: 'Title' },
          { name: 'key', placeholder: 'key (url slug)' },
          { name: 'description', placeholder: 'Description' },
          { name: 'anchor', placeholder: 'Anchor' },
          { name: 'emoji', placeholder: 'Emoji (optional)' },
          { name: 'wisdomLabel', placeholder: 'wisdomLabel (optional)' },
        ],
      },
      {
        method: 'POST',
        path: '/api/series/:seriesId/generate',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
      {
        method: 'GET',
        path: '/api/series/:seriesId/generation-status',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
      {
        method: 'DELETE',
        path: '/api/series/:seriesId',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
    ],
  },
  {
    label: 'Lessons',
    endpoints: [
      {
        method: 'GET',
        path: '/api/series/:seriesId/lessons',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
      {
        method: 'GET',
        path: '/api/lessons/:lessonId',
        params: [{ name: 'lessonId', placeholder: 'Lesson ID' }],
      },
      {
        method: 'DELETE',
        path: '/api/lessons/:lessonId',
        params: [{ name: 'lessonId', placeholder: 'Lesson ID' }],
      },
      {
        method: 'POST',
        path: '/api/lessons/:lessonId/read',
        params: [{ name: 'lessonId', placeholder: 'Lesson ID' }],
      },
    ],
  },
  {
    label: 'Subscriptions',
    endpoints: [
      { method: 'GET', path: '/api/subscriptions' },
      {
        method: 'POST',
        path: '/api/series/:seriesId/subscribe',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
      {
        method: 'DELETE',
        path: '/api/series/:seriesId/subscribe',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
    ],
  },
  {
    label: 'Progress',
    endpoints: [
      {
        method: 'GET',
        path: '/api/series/:seriesId/progress',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
      {
        method: 'PATCH',
        path: '/api/series/:seriesId/progress/advance',
        params: [{ name: 'seriesId', placeholder: 'Series ID' }],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveUrl(path: string, paramValues: Record<string, string>): string {
  return path.replace(/:(\w+)/g, (_, key) => paramValues[key] ?? `:${key}`);
}

function statusColor(status: number | null): string {
  if (status === null) return '#ef4444';
  if (status >= 200 && status < 300) return '#22c55e';
  if (status >= 400 && status < 500) return '#eab308';
  return '#ef4444';
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return '#60a5fa';
    case 'POST': return '#34d399';
    case 'PATCH': return '#f59e0b';
    case 'DELETE': return '#f87171';
    default: return '#a1a1aa';
  }
}

// ─── EndpointRow component ────────────────────────────────────────────────────

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvedUrl = resolveUrl(endpoint.path, paramValues);

  const run = async () => {
    setLoading(true);
    const start = performance.now();
    // Strip /api prefix since the api client already has baseURL=/api
    const clientPath = resolvedUrl.startsWith('/api')
      ? resolvedUrl.slice(4)
      : resolvedUrl;

    const body = endpoint.bodyFields
      ? Object.fromEntries(
          Object.entries(bodyValues).filter(([, v]) => v !== '')
        )
      : undefined;

    try {
      let res;
      switch (endpoint.method) {
        case 'GET':
          res = await api.get(clientPath);
          break;
        case 'POST':
          res = await api.post(clientPath, body ?? {});
          break;
        case 'PATCH':
          res = await api.patch(clientPath, body ?? {});
          break;
        case 'DELETE':
          res = await api.delete(clientPath);
          break;
      }
      const ms = Math.round(performance.now() - start);
      setResult({ method: endpoint.method, url: resolvedUrl, status: res!.status, ms, data: res!.data });
    } catch (err: unknown) {
      const ms = Math.round(performance.now() - start);
      if (axios.isAxiosError(err) && err.response) {
        setResult({
          method: endpoint.method,
          url: resolvedUrl,
          status: err.response.status,
          ms,
          data: err.response.data,
        });
      } else {
        setResult({
          method: endpoint.method,
          url: resolvedUrl,
          status: null,
          ms,
          data: null,
          error: String(err),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.row}>
      <div style={styles.rowHeader}>
        <span style={{ ...styles.method, color: methodColor(endpoint.method) }}>
          {endpoint.method}
        </span>
        <span style={styles.path}>{endpoint.path}</span>
        {endpoint.note && <span style={styles.note}>{endpoint.note}</span>}
        {endpoint.linkOnly ? (
          <a href={resolvedUrl} target="_blank" rel="noreferrer" style={styles.linkBtn}>
            Open
          </a>
        ) : (
          <button onClick={run} disabled={loading} style={styles.runBtn}>
            {loading ? '...' : 'Run'}
          </button>
        )}
      </div>

      {(endpoint.params || endpoint.bodyFields) && (
        <div style={styles.inputs}>
          {endpoint.params?.map(p => (
            <input
              key={p.name}
              placeholder={p.placeholder ?? p.name}
              value={paramValues[p.name] ?? ''}
              onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
              style={styles.input}
            />
          ))}
          {endpoint.bodyFields?.map(f => (
            <input
              key={f.name}
              placeholder={f.placeholder ?? f.name}
              value={bodyValues[f.name] ?? ''}
              onChange={e => setBodyValues(prev => ({ ...prev, [f.name]: e.target.value }))}
              style={styles.input}
            />
          ))}
        </div>
      )}

      {result && (
        <div style={styles.result}>
          <div style={styles.resultMeta}>
            <span style={{ ...styles.statusBadge, background: statusColor(result.status) }}>
              {result.status ?? 'ERR'}
            </span>
            <span style={styles.metaText}>{result.ms}ms</span>
            <span style={styles.metaText}>{result.method} {result.url}</span>
          </div>
          {result.error && <div style={styles.errorText}>{result.error}</div>}
          <pre style={styles.pre}>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DevPage() {
  const { user, loading } = useAuth();

  if (loading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Dev Console</h1>
      <p style={styles.subheading}>Admin-only diagnostic endpoint tester</p>
      {GROUPS.map(group => (
        <section key={group.label} style={styles.section}>
          <h2 style={styles.groupLabel}>{group.label}</h2>
          {group.endpoints.map(ep => (
            <EndpointRow key={`${ep.method}:${ep.path}`} endpoint={ep} />
          ))}
        </section>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'monospace',
    color: '#e4e4e7',
  },
  heading: {
    fontSize: '1.75rem',
    marginBottom: '0.25rem',
    color: '#f4f4f5',
  },
  subheading: {
    color: '#71717a',
    marginBottom: '2rem',
    fontSize: '0.9rem',
  },
  section: {
    marginBottom: '2rem',
  },
  groupLabel: {
    fontSize: '0.75rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#71717a',
    marginBottom: '0.5rem',
    borderBottom: '1px solid #27272a',
    paddingBottom: '0.25rem',
  },
  row: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 6,
    padding: '0.6rem 0.75rem',
    marginBottom: '0.4rem',
  },
  rowHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  method: {
    fontWeight: 700,
    fontSize: '0.8rem',
    minWidth: 52,
  },
  path: {
    flex: 1,
    fontSize: '0.88rem',
    color: '#d4d4d8',
  },
  note: {
    fontSize: '0.75rem',
    color: '#52525b',
  },
  runBtn: {
    background: '#3f3f46',
    color: '#e4e4e7',
    border: '1px solid #52525b',
    borderRadius: 4,
    padding: '0.2rem 0.7rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
  },
  linkBtn: {
    background: '#1e3a5f',
    color: '#93c5fd',
    border: '1px solid #2563eb',
    borderRadius: 4,
    padding: '0.2rem 0.7rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    textDecoration: 'none',
  },
  inputs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.5rem',
  },
  input: {
    background: '#09090b',
    border: '1px solid #3f3f46',
    borderRadius: 4,
    color: '#e4e4e7',
    padding: '0.25rem 0.5rem',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    minWidth: 160,
  },
  result: {
    marginTop: '0.6rem',
    borderTop: '1px solid #27272a',
    paddingTop: '0.6rem',
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.4rem',
    flexWrap: 'wrap',
  },
  statusBadge: {
    borderRadius: 4,
    padding: '0.1rem 0.5rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#000',
  },
  metaText: {
    fontSize: '0.78rem',
    color: '#71717a',
  },
  errorText: {
    color: '#f87171',
    fontSize: '0.8rem',
    marginBottom: '0.4rem',
  },
  pre: {
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: 4,
    padding: '0.75rem',
    fontSize: '0.78rem',
    overflowX: 'auto',
    margin: 0,
    color: '#a1a1aa',
    maxHeight: 400,
    overflowY: 'auto',
  },
};
