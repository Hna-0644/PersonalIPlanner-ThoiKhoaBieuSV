# Community Module Design

## Intent

Add a backend-only Community module to PersonalPlanner so authenticated
students can review shared subjects and exchange short posts/comments within a
class section. Keep existing MVP routes and data behavior intact.

## Current project context

- Backend uses Express, `mysql2/promise`, MySQL migrations, Zod, JWT middleware,
  and Redis supplied to `createApp`.
- Persistence follows `routes -> controllers -> services -> repositories`;
  database IDs are exposed as typed public IDs.
- The current timetable entity is `classes`, not `timetable`. `classes` is
  user-owned and has `code`, `title`, and no subject relationship.
- `003_work_schedules.sql` and the uncommitted `004_add_marketplace_items.sql`
  exist, so the new migration must be `005_add_course_reviews_and_qa.sql`.
- JSON uses camelCase, success responses use `{ data: ... }`, and SQL
  `DATETIME(3)` values are handled as UTC.
- The active checkout contains uncommitted timetable, marketplace, and
  infrastructure changes. The feature worktree was created from the committed
  base and those edits were copied into it; the original checkout remains
  untouched except for the committed local worktree-ignore rule.

## Goals

- Add a normalized `subjects` catalog and nullable `classes.subject_id` FK,
  preserving existing timetable rows.
- Add one review per user/subject, with a clear `409` on duplicate POST and
  explicit PUT for editing the owner's review.
- Add class-scoped posts, comments, post votes, and comment votes, with
  transactional vote/count updates and duplicate-vote protection.
- Keep Community code isolated under its own routes, controllers, services,
  schemas, and repositories.
- Cache review summaries and page-one latest posts with Redis cache-aside,
  graceful MySQL fallback, cache metadata, and invalidation on writes.
- Apply write rate limits keyed by authenticated `req.user.id`.
- Preserve existing UTC handling and parameterized SQL.

## Non-goals

- No frontend integration, course-catalog import, school-wide forum, roster
  management, or timetable migration/backfill.
- Q&A uses `classCode` as the discussion partition: any authenticated user
  who knows a code can read or post there. The current schema has no shared
  enrollment roster, and adding membership authorization is out of scope.
- No unauthenticated Community endpoints.

## Approaches

1. **Fold Community into existing timetable routes/services.** This reduces
   files but couples social/review concerns to the MVP schedule module and
   risks changing existing endpoints.
2. **Create an independent Community module and register its routers in
   `app.js`.** This preserves the existing module boundaries and limits
   integration to app composition and a nullable `classes.subject_id`.
3. **Implement only the schema and expose raw SQL-backed handlers.** This is
   shorter initially but bypasses the repository/service conventions, weakens
   testability, and makes cache/race handling harder to audit.

**Selected:** approach 2, matching the required module isolation and current
layered architecture. Reuse the existing shared `middleware/rate-limit.js`
factory instead of adding a second rate-limit implementation.

## Data model and migration

The migration creates `subjects`, `class_sections`, `course_reviews`,
`class_posts`, `post_comments`, `post_votes`, and `comment_votes`; it adds
nullable `classes.subject_id` with an FK to `subjects.id`. `class_sections`
maps one globally unique `classCode` to one subject, so the path-only posts
GET remains unambiguous. The first authenticated post request registers the
code/subject pair; later requests with the same code and another subject
return `409`. This mapping is not enrollment verification. Foreign keys to
`users` follow the existing InnoDB convention and cascade on owner deletion.
Add the requested unique constraints, rating/difficulty checks, and indexes,
including descending review/post timestamps where supported by MySQL 8.

`comment_votes` is an intentional addition: `post_comments.upvote_count`
cannot safely represent one-vote-per-user without a vote ledger. The
`class_sections` registry makes the code-to-subject association consistent;
the authenticated code scope is not a roster membership check.

Migration execution is sequential and lexicographic. Existing migrations 003
and 004 must remain unchanged; the Community migration uses prefix 005.
Subjects are provisioned by a catalog import/admin SQL process; this scope
does not add a subject-creation endpoint.

## API and behavior

Register independent `/api/courses`, `/api/classes`, `/api/posts`, and
`/api/comments` routers. Use these operations:

- `GET /api/courses/:subjectId/reviews?page=1&limit=20` returns
  `{ data: { summary: { avgRating, totalReviews, attendanceRate }, reviews,
  pagination } }`; reviews sort newest first.
- `POST /api/courses/:subjectId/reviews` accepts `lecturerName`, `rating`,
  `difficulty`, `attendanceRequired`, `gradingNotes`, `materialsNotes`, and
  `content`. A duplicate `(user, subject)` returns `409`.
- `PUT|DELETE /api/courses/:subjectId/reviews/me` update/delete only the
  authenticated user's review.
- `GET|POST /api/classes/:classCode/posts`; POST accepts `subjectId`, `title`,
  and `content`. The service inserts/locks `class_sections` and rejects a
  code already mapped to another subject with `409`.
- `GET|POST /api/posts/:postId/comments`; POST accepts `content`. Comments
  sort oldest first as required by the database index.
- `POST /api/posts/:postId/upvote` and
  `POST /api/comments/:commentId/upvote` toggle the caller's vote.
- `DELETE /api/posts/:postId/me` deletes only the author's post and supports
  the required latest-post cache invalidation.

Lists use `page` (default 1) and `limit` (default 20, max 100); the latest-post
cache applies only to page 1 with limit 20. Use typed public IDs for subjects,
reviews, posts, and comments.

All writes take the actor only from `req.user.id`. Review POST duplicates
return `409`; PUT and DELETE target only that user's review. Missing subjects
and posts return standard `404` errors. Validate public IDs, path codes,
pagination, text lengths, non-empty trimmed strings, rating, and difficulty
before service execution. Rating and difficulty are 1–5. Proposed limits are
120 characters for post titles, 2,000 for post/comment content and review
notes, 150 for lecturer names, and 5,000 for review content. Keep response
fields camelCase and the existing `{ data: ... }` envelope.

Post and comment upvotes are toggles. A transaction locks the target row,
checks the user's vote, inserts/deletes the vote ledger row, adjusts the
counter, then commits. Unique constraints remain the final race-condition
guard. Roll back on any failure. A successful upvote or post deletion
invalidates the affected class's latest-post cache.

## Caching, rate limits, and time

- Cache review aggregates at
  `review:subject:{subjectId}:summary` with a 30-minute TTL.
- Cache only the default first 20 posts at `qa:class:{classCode}:latest` with
  a 5-minute TTL.
- A Redis miss/error reads MySQL; Redis read/write/invalidation errors are
  logged and do not turn successful DB reads/writes into API failures.
  Successful cache invalidation deletes the corresponding key. Cache status
  is exposed using `X-Cache: HIT|MISS`.
- Write throttling reuses `createRateLimiter` from
  `middleware/rate-limit.js`, after JWT authentication, so keys use
  `req.user.id` and never a caller-supplied user ID.
- Use DB-generated `DATETIME(3)` timestamps and the existing UTC database
  configuration; return timestamps as ISO UTC.

## Validation and tests

Add focused tests for duplicate review conflict, owner isolation, missing
subject, Redis cache hit/miss and Redis failure fallback, latest-post
invalidation, concurrent/toggle vote idempotency, counter consistency,
validation, and per-user rate limiting. Add a k6 read-review scenario that
reports throughput/latency and accepts the API URL/token from environment.
Run focused tests and the backend suite; existing API tests use Supertest
loopback sockets, which are currently denied by this sandbox with `EACCES`.

## Open to the builder

- Choose TTL values within the specified ranges and conservative per-user
  write limits consistent with the existing marketplace limiter.
- Follow existing public-ID prefixes and error formatting.
- Do not add a roster or enrollment API unless the scope changes.
