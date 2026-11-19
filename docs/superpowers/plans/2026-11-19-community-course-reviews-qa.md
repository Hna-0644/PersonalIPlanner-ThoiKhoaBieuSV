# Community Course Reviews and Class Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated Community backend module for course reviews and class-scoped posts, comments, and votes.

**Architecture:** Add a sequential MySQL migration and a Community-only route/controller/service/repository stack. The service uses Redis for read-heavy cache-aside paths and invalidation, while repositories own parameterized SQL and vote transactions; `app.js` only composes the new module.

**Tech Stack:** Node.js 20+, Express 4, MySQL 8, mysql2/promise, Redis 6 client, Zod 4, node:test, Supertest, k6.

**Spec:** [2026-11-19-community-course-reviews-qa-design.md](../specs/2026-11-19-community-course-reviews-qa-design.md)

## Global Constraints

- Preserve all existing MVP routes and behaviors; add the Community module independently.
- Derive every write actor from authenticated `req.user.id`; never accept a user ID from request data.
- Use parameterized MySQL queries for all values.
- Use MySQL `DATETIME(3)` with the existing UTC database configuration.
- Review summary cache TTL is 1800 seconds; class latest-post cache TTL is 300 seconds.
- Cache only the latest-post page with `page=1` and `limit=20`; paginate with default 20 and maximum 100.
- Include `X-Cache: HIT|MISS` on cached review-summary and post-list reads.
- Redis read/write/invalidation failures must not crash otherwise successful MySQL reads or writes.
- Use the `005_add_course_reviews_and_qa.sql` migration name; `003_work_schedules.sql` and the uncommitted `004_add_marketplace_items.sql` already exist.
- Keep API JSON camelCase and the existing `{ data: ... }` / `{ error: ... }` envelope.
- Do not commit copied user changes; keep this worktree uncommitted unless the user asks for commits.

## Review Focus

1. **Unknown or malformed IDs, class codes, and SQL-like input** must return validation/404 errors without broad queries. Test malformed public IDs and nonexistent subjects/posts in schema and service tests.
2. **Duplicate reviews and class-code/subject conflicts** must not create duplicates or silently change mappings. Test repeated review POST -> 409 and conflicting mapping -> 409.
3. **Concurrent vote toggles** must keep vote rows and counters synchronized. Test transaction lock order, toggle behavior, uniqueness handling, and counter changes for both posts and comments.
4. **Redis unavailable or failing on GET/SET/DEL** must fall back to MySQL and leave writes successful while reporting cache misses. Test unready Redis and each failure path.
5. **Invalid pagination/text and write bursts** must be rejected or throttled per authenticated user. Test clamping/rejection, trimmed empty strings, limits, and independent user rate buckets.

---

## File Structure

- `backend/src/db/migrations/005_add_course_reviews_and_qa.sql` — subject, section, review, post, comment, and vote tables plus `classes.subject_id`.
- `backend/src/utils/public-id.js` — add public ID prefixes for subjects, reviews, posts, and comments.
- `backend/src/schemas/community-schemas.js` — Community body, path, and query validation.
- `backend/src/repositories/community-repository.js` — parameterized Community SQL and transaction boundaries.
- `backend/src/services/community-service.js` — review/Q&A business rules and Redis cache-aside/invalidation.
- `backend/src/controllers/community-controller.js` — request extraction and response envelopes/headers.
- `backend/src/routes/community-routes.js` — authenticated Community endpoints and write throttling.
- `backend/src/middleware/rate-limit.js` — reuse existing per-user fixed-window limiter for Community writes.
- `backend/src/app.js` — instantiate/register only the new Community services/router.
- `backend/test/community-schemas.test.js` — schema and public ID validation.
- `backend/test/community-service.test.js` — reviews, Q&A, cache behavior, and transactions with mocks.
- `backend/test/community-routes.test.js` — route authentication, validation, status, response, and cache headers.
- `backend/k6/community-reviews.js` — configurable review-read load scenario.
- `docs/shared-contract.md` — add the Community module, endpoints, payloads, response fields, and error/cache behavior without removing current uncommitted edits.

## Task 1: Add the Community database and validation contract

**Files:**
- Create: `backend/src/db/migrations/005_add_course_reviews_and_qa.sql`
- Create: `backend/src/schemas/community-schemas.js`
- Modify: `backend/src/utils/public-id.js`
- Test: `backend/test/community-schemas.test.js`

**Interfaces:**
- Produces `toPublicId(type, id)` / `toDatabaseId(id, type)` support for `subject`, `review`, `post`, and `comment`.
- Produces schemas for review create/update, post create, comment create, pagination, class code, and typed public IDs.
- Migration adds `subjects`, `class_sections`, `course_reviews`, `class_posts`, `post_comments`, `post_votes`, and `comment_votes`, plus nullable `classes.subject_id`.

- [ ] **Step 1: Write failing schema and ID tests**

Assert rating/difficulty accept only integers 1–5; trimmed required text rejects empty values; title/content limits are enforced; page/limit defaults are 1/20 with limit capped at 100; malformed IDs and class codes fail; new public ID prefixes round-trip.

- [ ] **Step 2: Run `node --test test/community-schemas.test.js` and verify the new assertions fail**

- [ ] **Step 3: Implement the Community schemas and public ID prefixes**

Use the design's limits: title 120, post/comment content 2,000, lecturer 150, review notes 2,000, review content 5,000. Keep create-review fields required where the database requires them and preserve nullable notes.

- [ ] **Step 4: Add the MySQL 8 migration**

Add unique `(user_id, subject_id)` for reviews and `(user_id, post_id)` / `(user_id, comment_id)` for vote ledgers; add rating/difficulty checks, requested time indexes, FKs, and `class_sections.class_code` uniqueness. Do not edit migrations 001–004.

- [ ] **Step 5: Run `node --test test/community-schemas.test.js` and verify it passes**

Also run the existing `node --test test/public-id.test.js`.

## Task 2: Implement reviews and summary caching

**Files:**
- Create: `backend/src/repositories/community-repository.js`
- Create: `backend/src/services/community-service.js`
- Test: `backend/test/community-service.test.js`

**Interfaces:**
- Repository exposes parameterized `findSubject`, `getReviewSummary`, `listReviews`, `createReview`, `updateMyReview`, and `deleteMyReview`.
- Service exposes `getReviews(subjectId, page, limit)`, `createReview(userId, subjectId, input)`, `updateMyReview(userId, subjectId, input)`, and `deleteMyReview(userId, subjectId)`.
- `getReviews` returns summary `{ avgRating, totalReviews, attendanceRate }`, newest-first reviews, pagination, and cache status.

- [ ] **Step 1: Write failing tests** for missing subject -> 404, duplicate review -> explicit 409, update/delete owner filtering, summary cache hit/miss, Redis fallback, and post-write invalidation.
- [ ] **Step 2: Run `node --test test/community-service.test.js` and verify the review tests fail**
- [ ] **Step 3: Implement review repository queries and summary aggregation**

Calculate attendance rate from `attendance_required`; SQL must include the authenticated user for all owner mutations. Translate duplicate-key errors for the review constraint to a clear 409.

- [ ] **Step 4: Implement review service cache-aside**

Use key `review:subject:{subjectId}:summary`, TTL 1800, and a separate paginated review query. Redis errors log and fall through to MySQL; mutations attempt invalidation after commit without changing successful DB outcomes.

- [ ] **Step 5: Run `node --test test/community-service.test.js` and verify all review tests pass**

## Task 3: Implement class posts, comments, and race-safe voting

**Files:**
- Modify: `backend/src/repositories/community-repository.js`
- Modify: `backend/src/services/community-service.js`
- Test: `backend/test/community-service.test.js`

**Interfaces:**
- Repository adds `listPosts`, `createPost`, `deleteMyPost`, `listComments`, `createComment`, `togglePostVote`, and `toggleCommentVote`.
- Service adds `getPosts(classCode, page, limit)`, `createPost(userId, classCode, input)`, `deleteMyPost(userId, postId)`, `getComments(postId, page, limit)`, `createComment(userId, postId, input)`, `togglePostVote(userId, postId)`, and `toggleCommentVote(userId, commentId)`.
- Vote methods return `{ upvoted, upvoteCount }`; `getPosts` returns newest-first posts and cache status; comments are oldest-first.

- [ ] **Step 1: Write failing tests** for first class-code mapping, conflicting subject -> 409, missing post -> 404, page-one-only caching, Redis fallback, comment ordering, own-post deletion, and post/comment vote toggles.
- [ ] **Step 2: Run the focused service tests and verify the new Q&A assertions fail**
- [ ] **Step 3: Implement post/section/comment repository queries**

Use a transaction to create a section mapping on first post and lock/check it before inserting; all SQL values remain placeholders.

- [ ] **Step 4: Implement vote transactions**

Lock the target post/comment row with `FOR UPDATE`, inspect the user's ledger row, insert or delete it, update the count in the same transaction, and roll back on every failure. Keep the unique vote constraint as the final race guard.

- [ ] **Step 5: Implement latest-post cache and invalidation**

Use `qa:class:{classCode}:latest`, TTL 300, only for page 1/limit 20. Invalidate after post creation/deletion and post vote toggles; do not invalidate on comments because the cache contains posts only.

- [ ] **Step 6: Run `node --test test/community-service.test.js` and verify all service tests pass**

## Task 4: Wire authenticated API, cache metadata, and rate limiting

**Files:**
- Create: `backend/src/controllers/community-controller.js`
- Create: `backend/src/routes/community-routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/test/community-routes.test.js`

**Interfaces:**
- Router factory: `createCommunityRouter(communityService, authenticate)`.
- Controller factory: `createCommunityController(communityService)`; every write passes only `req.user.id`.
- Reuse `createRateLimiter({ windowMs, maxRequests })` from `middleware/rate-limit.js`; it keys by authenticated `req.user.id`.

- [ ] **Step 1: Write failing route/controller tests** for auth, invalid payloads, duplicate review 409, pagination, X-Cache HIT/MISS, actor propagation from JWT, and per-user rate-limit isolation.
- [ ] **Step 2: Run the route tests and verify the new assertions fail**
- [ ] **Step 3: Implement controller and route handlers**

Add the requested review and Q&A paths plus delete-own-post and comment-upvote paths. Preserve the standard success/error envelope and set `X-Cache` on cached GETs.

- [ ] **Step 4: Implement per-user write throttling**

Apply per-user fixed windows to review/post/comment creation and vote toggles using the existing limiter factory. Use conservative limits (5 creates/minute and 30 votes/minute) and return the standard 429 error.

- [ ] **Step 5: Register Community in `app.js` and run route tests**

Do not refactor or rename existing routes. Run `node --test test/community-routes.test.js`; Supertest tests may require sandbox loopback access.

## Task 5: Document and load-test the module

**Files:**
- Create: `backend/k6/community-reviews.js`
- Modify: `docs/shared-contract.md`

- [ ] **Step 1: Add contract documentation**

Document endpoints, camelCase fields, pagination, 409/404 behavior, classCode's authenticated-but-not-roster-verified scope, UTC timestamps, and `X-Cache`.

- [ ] **Step 2: Add a k6 read-review scenario**

Read `BASE_URL`, `TOKEN`, and `SUBJECT_ID` from environment; request page 1 with limit 20; report status, latency, throughput, and cache header; use a modest default VU/duration profile.

- [ ] **Step 3: Run focused tests and the backend suite**

Run `node --test test/community-*.test.js` and `npm test` from `backend`. The baseline currently has seven unrelated Supertest loopback failures (`EACCES`); report those separately if sandbox policy still blocks localhost.

- [ ] **Step 4: Validate migration and load script**

Run migration against MySQL 8 when available, then `k6 run backend/k6/community-reviews.js` with environment values. Do not claim a load threshold unless the run actually reports it.

## Self-review

- **Spec coverage:** migration/entities/indexes; review CRUD and summary; posts/comments/votes; Redis cache-aside, metadata, fallback, and invalidation; authenticated ownership; validation and rate limits; UTC; tests and k6 are assigned above.
- **Step scan:** Each task has failing-test, implementation, and passing-test steps; documentation/load validation are isolated in the final task.
- **Type/interface consistency:** Services accept database IDs after route validation and user IDs only from `req.user.id`; API responses map database IDs to the new public prefixes.
- **Review focus:** All five identified failure classes are tied to the focused tests in Tasks 1–4.
- **Proportion:** Five tasks divide the migration/validation, two behavior groups, API composition, and docs/load validation without splitting dependent files into artificial projects.
