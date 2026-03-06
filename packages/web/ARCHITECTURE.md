# Web Architecture

React 19 + Vite SPA. Entry: `src/main.tsx`. All routes are client-side; the API serves `index.html` for all non-API paths via SPA fallback.

---

## Route Map

| URL | Component | Auth Required | Data Fetched |
|-----|-----------|--------------|-------------|
| `/` | `Home` | no | `GET /api/series/popular` |
| `/subscriptions` | `SubscriptionsPage` | yes (redirects to /) | `GET /api/subscriptions` |
| `/new` | `NewSeriesPage` | yes (redirects to /) | POST on submit |
| `/auth/callback` | `AuthCallbackPage` | no | Reads `?token=` from URL |
| `/admin` | `AdminPage` | admin (redirects to /) | `GET /api/users`, `GET /api/series` |
| `/:seriesKey` | `SeriesPage` | no (optional) | `GET /api/series`, `/series/:id/lessons`, `/subscriptions`, `/series/:id/generation-status` |
| `/:seriesKey/lesson/:sortOrder` | `LessonPage` | no (optional) | `GET /api/series`, `/series/:id/lessons`, `/lessons/:id` |

---

## Auth Context

`src/hooks/useAuth.tsx` provides `AuthContext` via `AuthProvider`.

**State:**
- `user: APIUser | null` — null when logged out or loading
- `loading: boolean` — true during initial auth check

**Methods:**
- `login()` — redirects to `/auth/google`
- `logout()` — POST /auth/logout, clears localStorage, nulls user
- `refresh()` — POST /auth/refresh, updates localStorage + user state

**Initialization (on mount):**
1. If `localStorage.accessToken` exists → fetch `/api/users/me` to hydrate user
2. If that fails (or no token) → call `refresh()` (uses httpOnly refresh cookie)
3. Set `loading = false` either way

**Admin check:** `user?.role === 'admin'` (no separate isAdmin flag)

---

## API Client (`src/lib/api.ts`)

Axios instance with `baseURL: '/api'` and `withCredentials: true`.

**Request interceptor:** attaches `Authorization: Bearer <token>` from `localStorage.accessToken`.

**Response interceptor (auto-refresh):**
- On 401: POST /auth/refresh (deduplicated — only one refresh call even if multiple requests fail simultaneously)
- On success: store new token + retry original request
- On failure: remove token from localStorage, propagate error

**TypeScript interfaces exported:**
- `APISeries` — series object from API
- `APILesson` — lesson with optional `standard` populated, `read` boolean, `dayNumber`
- `APIStandard` — standard content sections
- `APIUser` — user profile
- `APISubscription` — subscription with `seriesId` populated as `APISeries`
- `APIProgress` — `{currentDay: number}`
- `APILessonsResponse` — paginated lessons endpoint response: `{lessons, total, page, pages, progress}`
- `Character` — series character shape

---

## Component Hierarchy

```
App (AuthProvider, BrowserRouter)
├── Sidebar (slide-out, always rendered)
│   ├── reads: useAuth (user, login, logout)
│   └── fetches: GET /api/series (on mount)
└── Routes
    ├── Home
    ├── SeriesPage
    ├── LessonPage
    ├── SubscriptionsPage
    ├── NewSeriesPage
    ├── AdminPage
    └── AuthCallbackPage
```

`KaraokeText` — standalone component, not currently wired to any page. Provides word-by-word audio sync highlighting using Whisper timestamps.

---

## Page Details

### Home (`/`)
- Fetches `GET /api/series/popular` (top 20 by subscriberCount)
- Shows series grid; each card links to `/:seriesKey`
- Unauthenticated: shows "Sign in with Google" CTA
- Authenticated: shows "+ Create New Series" card linking to `/new`

### SeriesPage (`/:seriesKey`)
- Resolves series by matching `seriesKey` against `GET /api/series` list
- Parallel fetch: lessons, subscriptions (if authed), generation-status
- **Generation polling:** `setInterval` every 5 seconds checks `/generation-status`. When status transitions from generating → done, refreshes lessons.
- Locked lessons (sortOrder > currentDay for subscribers) are shown with 50% opacity and `pointer-events: none`
- Admin sees "Generate Next Lesson" button (POST /api/series/:id/generate)
- Subscribe/Unsubscribe updates subscriberCount optimistically

### LessonPage (`/:seriesKey/lesson/:sortOrder`)
- **Three-tab UI:** Parable (🏰), Standard (📖), Sonnet (📜)
- Resolves lesson by: get all series → find by key → get lessons → find by sortOrder → fetch full lesson by ID
- **"Mark as Read & Continue"** button: calls PATCH `/api/series/:id/progress/advance`, then navigates to next lesson if `hasNext`, else back to series
- **"Mark as read"** button: calls POST `/api/lessons/:id/read` (standalone, doesn't advance)
- Bottom nav has Prev/Next day links (no boundary check — links always render)

### NewSeriesPage (`/new`)
- Auth guard: redirects to `/` if not logged in
- Single text input for topic, POST to `/api/series`, navigates to `/:series.key` on success
- Shows rate limit error message on 429

### AdminPage (`/admin`)
- Auth guard: redirects to `/` if not admin
- Two tabs: Users and Series
- Users tab: change any user's role (except own) between 'user' and 'admin'
- Series tab: soft-delete series with confirmation

### SubscriptionsPage (`/subscriptions`)
- Auth guard: redirects to `/` if not logged in
- Shows subscribed series as cards + "Create New Series" card

### AuthCallbackPage (`/auth/callback`)
- Reads `?token=` query param, saves to `localStorage.accessToken`, redirects to `/`

---

## State Patterns

**Data fetching:** All pages use `useEffect` + `useState` (no global state library). Loading states are tracked with boolean `loading` flags.

**Generation status polling:** SeriesPage uses `setInterval` (5s) + `useRef` (generatingRef) to detect state transitions without stale closure issues.

**Optimistic updates:** Subscribe/unsubscribe updates `subscriberCount` in local state immediately.

**Auth guards:** Pages check `authLoading` first (show spinner), then check auth/role. Use `<Navigate to="/" replace />` for redirect.

---

## Styling

- Single global CSS file at `src/index.css`
- Dark mode enforced on mount: `document.documentElement.setAttribute('data-theme', 'dark')`
- CSS custom properties for colors (`--text-muted`, `--surface`, `--border`)
- Class naming: `container`, `series-card`, `lesson-card`, `lesson-card-img`, `btn-primary`, `btn-subscribe`, `toggle-btn`, `sidebar-*`, `admin-*`
- No CSS-in-JS; inline styles used sparingly for one-off overrides

---

## Build

```bash
npm run dev    # Vite dev server on :5173, proxies /api and /auth to :3001
npm run build  # tsc then vite build → outputs to dist/
npm run lint   # eslint
```

Vite config (`vite.config.ts`) defines the proxy. Output `dist/` is served by the API in production.
