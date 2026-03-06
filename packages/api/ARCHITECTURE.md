# API Architecture

Express 5 + TypeScript backend. Entry point: `src/index.ts`.

---

## Request Lifecycle

Every incoming request passes through this middleware chain (in order):

1. **`helmet`** — sets security HTTP headers (CSP disabled to allow SPA serving)
2. **`cors`** — allows `CLIENT_URL` in production, `localhost:5173` and `localhost:3001` in dev
3. **`express.json()`** — parse JSON request bodies
4. **`cookieParser()`** — parse cookies (needed for refresh token)
5. **`passport.initialize()`** — Passport setup (used only in `/auth/google*` routes)
6. **`authLimiter`** on `/auth` — 10 req/min/IP
7. **`generalLimiter`** on `/api` — 100 req/min/IP
8. **Route handlers** — `/auth`, `/api/series`, `/api/series` (subscriptions), `/api`, `/api/users`
9. **Static files** — serves `packages/web/dist`
10. **SPA fallback** — `/{*path}` → sends `index.html`

---

## Auth Flow

### Google OAuth (initial login)
```
Browser → GET /auth/google
  → Passport redirects to Google consent page
  → Google redirects to GET /auth/google/callback
  → Passport verifies profile, upserts User in DB
    - email in ADMIN_EMAILS list → role = 'admin'
  → generateTokens(userId, email, role)
    - accessToken: JWT 15min
    - refreshToken: JWT 30d
  → Store refreshToken in User.refreshToken
  → Set httpOnly cookie 'refreshToken' (path=/auth, 30d)
  → Redirect to CLIENT_URL/auth/callback?token=<accessToken>
```

### Token Refresh
```
POST /auth/refresh
  → Read 'refreshToken' cookie
  → verifyRefreshToken: JWT verify + DB lookup (validates token matches stored)
  → Issue new token pair
  → Update User.refreshToken
  → Set new cookie
  → Return { accessToken, user }
```

### Protecting Routes
- `requireAuth` — validates `Authorization: Bearer <token>` header, sets `req.authUser`
- `optionalAuth` — same but doesn't reject on missing/invalid token
- `requireAdmin` — calls `requireAuth` then checks `req.authUser.role === 'admin'`

**Important:** `req.authUser` (not `req.user`) holds the JWT payload. `req.user` is Passport's property used only in the OAuth callback, where it's cast as `unknown` to access `_id`, `email`, `role`.

---

## Generation Pipeline

### Creating a New Series (`POST /api/series`)

```
createSeriesWithFirstLesson(topic, userId)
  1. createSeriesDetails(topic)         → Claude: title, key, description, anchor, emoji, wisdomLabel
  2. Check if key already exists in DB  → if yes, subscribe user and return existing series
  3. Series.create(...)                 → persisted immediately
  4. Subscription.create(...)           → user subscribed
  5. createFirstLessonForSeries(series) → fires in background (no await)
  6. Return series to client (lesson generation is async)
```

### First Lesson Generation (`createFirstLessonForSeries`)

```
generateFirstStandard(anchor, title, description)
  → Claude tool: title, concept, whyItMatters, howItWorks, definitions[], wisdom, followUpQuestion
  → No 'review' field (this is the first lesson)

generateParable(standard, existingCharacters=[])
  → Claude tool: content (markdown), characters[] (full cast, created fresh for first lesson)
  → Series.findByIdAndUpdate → save characters to series

generateSonnet(standard)
  → Claude tool: title, content (14-line Shakespearean sonnet)

generateImagePrompt(sonnet)
  → Claude tool: prompt (classical oil painting style, no text)

generateAndUploadImage(prompt, seriesKey, sortOrder=1)
  → DALL-E 3 at 1792x1024
  → Upload to Cloudinary: parable/{seriesKey}/day-1

Lesson.create({ seriesId, sortOrder: 1, title, date, image, parable, sonnet })
Standard.create({ lessonId, seriesId, concept, ... })
lesson.standardId = savedStandard._id → lesson.save()
```

### Subsequent Lesson Generation (`createLessonForSeries`)

Called by the midnight cron and by `POST /api/series/:id/generate`.

```
acquireJob(seriesId)  → false if already generating/queued

Load all prev lessons + standards
Build prevLessonData: [{title, followUpQuestion}]
Extract lastStandard.followUpQuestion (seeds next topic)

generateStandard(seriesContext, prevFollowUpQuestion, prevLessonData)
  → Same shape as first standard BUT includes 'review' (recap of previous lesson)
  → Prompt includes all previous titles + questions to avoid repetition

generateParable(standard, series.characters)
  → Reuses existing characters + may introduce new ones
  → Merge new characters (by name) into Series.characters

generateSonnet → generateImagePrompt → generateAndUploadImage (same as first lesson)

Lesson.create + Standard.create + link standardId (same as first lesson)

releaseJob(seriesId)
  → If job was marked 'queued' while running → re-trigger createLessonForSeries
  → Otherwise → delete the job
```

### Key difference: first vs subsequent
| | First Lesson | Subsequent |
|---|---|---|
| Standard fn | `generateFirstStandard` | `generateStandard` |
| `review` field | absent | present (recap previous) |
| Characters | created fresh | merged from existing |
| Trigger | background after series create | cron or admin endpoint |
| sortOrder | always 1 | lastLesson.sortOrder + 1 |

---

## Job Queue Pattern

`GenerationJob` collection prevents concurrent generation for the same series.

```
acquireJob(seriesId):
  - No existing job → create { status: 'generating' } → return true (proceed)
  - Job exists with status 'generating' → set to 'queued' → return false (don't proceed)
  - Job exists with status 'queued' → return false (already queued)

releaseJob(seriesId):
  - Job status is 'queued' → set to 'generating' + fire createLessonForSeries (re-run)
  - Job status is 'generating' → delete job (done)
```

TTL: jobs auto-expire after 30 minutes to clear stuck states.

---

## Cron Jobs

Both crons use UTC timezone.

### `startOrchestrateSeriesCron` — daily at midnight UTC (`0 0 * * *`)
- Fetches all non-deleted series
- Calls `createLessonForSeries` for each with concurrency limit of 3 (via `p-limit`)
- This is the primary mechanism for daily lesson production

### `startOrchestrateProgressCron` — daily at 7AM UTC (`0 7 * * *`)
- Iterates all subscriptions
- For each subscription:
  - If no Progress exists → create one at day 1
  - If Progress exists → check if currentDay's lesson has been Read
  - If read → find the next lesson → if it exists, increment currentDay
- Only advances if the user actually read the lesson (Read record exists)

---

## Models Reference

All models are in `src/models/`. Quick reference:

| Model | Key Fields | Indexes |
|-------|-----------|---------|
| Series | title, key (unique), anchor, characters[], subscriberCount, deletedAt | key unique |
| Lesson | seriesId, sortOrder, standardId, parable, sonnet, image, deletedAt | (seriesId, sortOrder) unique; (seriesId, deletedAt) |
| Standard | lessonId (unique), seriesId, review?, concept, definitions[], wisdom, followUpQuestion | lessonId unique; seriesId |
| User | googleId (unique), email (unique), role, refreshToken | googleId, email unique |
| Subscription | userId, seriesId | (userId, seriesId) unique; seriesId |
| Progress | userId, seriesId, currentDay | (userId, seriesId) unique |
| Read | userId, lessonId, readAt | (userId, lessonId) unique |
| GenerationJob | seriesId (unique), status, action, TTL 30min | seriesId unique; createdAt TTL |

---

## Rate Limiting

- **`generalLimiter`**: 100 req/min/IP on all `/api` routes
- **`authLimiter`**: 10 req/min/IP on all `/auth` routes
- **`checkCreateSeriesLimit`**: In-memory per-user limit of 3 series creations per 24h (not persisted across restarts)

---

## Error Handling

Routes use `async` functions directly (Express 5 handles promise rejections automatically). Errors propagate to Express's default error handler unless caught explicitly. Image generation failures are caught and logged but do not abort lesson creation (lesson is saved without image).
