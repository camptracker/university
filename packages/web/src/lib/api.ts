/**
 * Axios API client and TypeScript type definitions for all API responses.
 *
 * The default export is a configured Axios instance (baseURL: '/api', withCredentials: true).
 *
 * Interceptors:
 * - Request: attaches Authorization header from localStorage.accessToken
 * - Response: on 401, attempts POST /auth/refresh (deduplicated), retries original request.
 *   Clears localStorage token if refresh fails.
 *
 * Exported interfaces:
 * - APISeries — series object from the API
 * - APILesson — lesson with optional standard, read flag, dayNumber
 * - APIStandard — structured lesson content (concept, definitions, wisdom, etc.)
 * - APIUser — user profile {_id, email, name, picture, role, createdAt}
 * - APISubscription — subscription with seriesId populated as APISeries
 * - APIProgress — {currentDay: number}
 * - APILessonsResponse — paginated response: {lessons, total, page, pages, progress}
 * - Character — series character shape {name, pronoun, age?, personality?, role?}
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach access token from storage
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/auth/refresh', {}, { withCredentials: true })
          .then(r => {
            const token = r.data.accessToken as string;
            localStorage.setItem('accessToken', token);
            return token;
          })
          .catch(() => {
            localStorage.removeItem('accessToken');
            return null;
          })
          .finally(() => { refreshPromise = null; });
      }
      const token = await refreshPromise;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Character {
  name: string;
  pronoun: string;
  age?: string;
  personality?: string;
  role?: string;
}

export interface APISeries {
  _id: string;
  title: string;
  key: string;
  description: string;
  anchor: string;
  emoji?: string;
  wisdomLabel?: string;
  characters: Character[];
  subscriberCount: number;
  createdAt: string;
}

export interface APILesson {
  _id: string;
  seriesId: string;
  sortOrder: number;
  dayNumber: number;
  title: string;
  date: string;
  image?: string;
  parable?: string;
  sonnet?: string;
  standardId?: string;
  standard?: APIStandard;
  read?: boolean;
}

export interface APIStandard {
  _id: string;
  lessonId: string;
  seriesId: string;
  review?: string;
  concept: string;
  whyItMatters: string;
  howItWorks: string;
  definitions: { term: string; definition: string }[];
  wisdom: string;
  followUpQuestion: string;
}

export interface APIUser {
  _id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface APISubscription {
  _id: string;
  seriesId: APISeries;
  userId: string;
  createdAt: string;
}

export interface APIProgress {
  currentDay: number;
}

export interface APILessonsResponse {
  lessons: APILesson[];
  total: number;
  page: number;
  pages: number;
  progress: APIProgress | null;
}
