# Performance Report

Date: 2026-04-06

## Scope

This repository does not currently contain a React application or a database-backed data layer.
The shipped app is an Express server with HTML/vanilla-JS frontends and JSON-file persistence in `data/`.

The optimization pass therefore focused on the real hot paths in this codebase:

- repeated JSON file reads/parses on request-heavy routes
- repeated filtering/sorting work for posts and contacts
- duplicate public API requests for featured content
- unnecessary client-side rerenders and stale request races
- excessive draft backup churn during bursty admin saves

## Implemented Changes

### Server and Storage

- Added `lib/jsonFileStore.js` to provide:
  - in-memory JSON caching
  - throttled freshness checks via file stats
  - serialized writes to avoid read-modify-write races
  - atomic temp-file writes
- Refactored `lib/contentStore.js` to:
  - cache draft and published content
  - cache contacts
  - build indexed contact search/pagination results in memory
  - throttle draft backup creation
  - expose cache invalidation after restore
- Refactored `lib/postStore.js` to:
  - cache draft and published posts
  - build post indexes by slug/id/type/search text
  - memoize paginated query results
  - persist draft and published post files from one shared code path
  - throttle draft backup creation
- Refactored `lib/userStore.js` to use cached JSON reads and serialized updates for login metadata and credential changes.

### Route Layer

- Refactored public post/content routes to use cached snapshots and indexed queries instead of full file scans.
- Added HTTP caching support for:
  - `/api/public/content`
  - `/api/posts`
  - `/api/posts/:slug`
  - `/sitemap.xml`
- Added in-memory sitemap document caching keyed by post-store version and current date.
- Refactored admin contacts and post listing routes to use shared indexed query helpers.
- Invalidated content/post/user caches after backup restore to prevent stale reads.

### Client-Side

- Reduced public post section loading from two requests per reset to one request by returning `featuredItem` from `/api/posts` when needed.
- Reduced DOM churn in `website/js/posts-sections.js` by appending only newly loaded cards instead of rerendering the entire grid on every pagination step.
- Added duplicate-item protection in post pagination via slug tracking.
- Added abortable contact search requests in `admin/dashboard.html` so fast typing/refreshing does not leave stale responses racing the UI.

## Verification

### Static Checks

- `node --check server.js`
- `node --check routes/public.js`
- `node --check routes/admin.js`
- `node --check lib/contentStore.js`
- `node --check lib/postStore.js`
- `node --check lib/userStore.js`
- `node --check lib/jsonFileStore.js`

### Runtime Smoke Tests

- Direct store/query verification:
  - published content snapshot loaded successfully
  - published posts query returned paginated items plus featured post
  - published post lookup by slug succeeded
  - contacts query returned paginated results
- Live HTTP verification against a started local server:
  - `GET /api/public/content` -> `200`
  - `GET /api/posts?type=news&page=1&limit=2&includeFeatured=1` -> `200`
  - `GET /sitemap.xml` -> `200`
  - cache headers were present on public endpoints

## Expected Impact

- Lower CPU usage under read-heavy traffic because content/posts/contacts are no longer reparsed from disk on every request.
- Lower disk I/O under bursty admin edits due to cached reads, serialized writes, and throttled backup creation.
- Faster repeated post/contact queries due to indexed in-memory filtering and memoized pagination.
- Lower frontend network and paint cost for post sections.
- Reduced stale-response flicker in the admin contacts view.

## Remaining Gaps

- There is no React tree in this repository to optimize. A React migration was intentionally not introduced because it would be a feature-risking rewrite, not a performance refactor.
- There is no database in this repository. The "database optimization" work was mapped to the existing JSON persistence layer and its request/query behavior.
- `mobile.html` and some other pages still depend on CDN-loaded Tailwind/runtime-heavy markup. Replacing those with locally built CSS would be a worthwhile next step if we want a deeper frontend weight reduction.
- Redis is still required for full authenticated-session behavior in production. During local smoke tests, Redis was unavailable, so the app ran in its degraded no-session mode.
