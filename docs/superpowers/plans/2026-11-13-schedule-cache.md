# Schedule Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user Redis Cache-Aside for schedule events with a 3600-second TTL and invalidate the affected user's cache after applying a schedule.

**Architecture:** Reuse the existing `backend/src/config/redis.js` client, connect it from the server entry point, pass it through `createApp` into `schedule-service`, and keep cache operations in that service. Redis read/write failures fall back to MySQL and are logged; versioned cache keys prevent a delayed miss from reactivating stale data after post-commit invalidation.

**Tech Stack:** Node.js, Express, `redis` client, MySQL2, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-13-schedule-cache-design.md`

## Global Constraints

- Use a user-specific cache key and a TTL of exactly 3600 seconds.
- On a Redis miss or error, read schedule events from MySQL.
- Invalidate the affected user's event cache after `/api/schedule/apply` commits.
- Keep cache behavior in `schedule-service`; preserve the existing response shape.
- Preserve existing edits in `backend/package.json` and `backend/package-lock.json`.
- No PUT/DELETE schedule-event routes currently exist; do not add them in this change.

## Review Focus

- Redis read errors must still serve MySQL data — test `listEvents` with a rejecting `get`.
- Invalid JSON in a cache entry must not break the endpoint — test a malformed value is treated as a miss and refreshed.
- An empty cached event list is still a hit — test `[]` does not trigger a MySQL query.
- Redis write errors must not discard a successful MySQL read — test `setEx` rejection still returns rows and logs the error.
- Cache invalidation must run only after successful commit — assert the transaction is committed before the fake Redis `del` call.
- Redis commands during reconnect must not stall MySQL fallback — test an unready client is bypassed.
- A read started before invalidation must not repopulate the active cache generation afterward — test a delayed MySQL result across a version bump.

---

### Task 1: Implement schedule caching with the existing Redis client

**Files:**
- Modify: `backend/src/services/schedule-service.js`
- Modify: `backend/src/app.js`
- Modify: `backend/src/server.js`
- Modify: `backend/src/config/redis.js`
- Test: `backend/test/schedule-service.test.js`

**Interfaces:**
- `createScheduleService({ pool, redisClient })` accepts an optional Redis client passed from `createApp`, preserving existing service callers without one.
- `createApp({ pool, config, redisClient })` passes the existing client to `createScheduleService`.
- `backend/src/server.js` starts and closes the existing client exported by `backend/src/config/redis.js`; the module already supports `REDIS_URL` and `REDIS_HOST`/`REDIS_PORT`.
- Schedule cache version key is `schedule:events:version:<userId>`; each event key is `schedule:events:<userId>:<generation>`.
- Cache values are JSON-serialized event arrays; use Redis `get`, `setEx(key, 3600, value)`, and `del`.
- Disable Redis offline command queuing and skip Redis reads while the client is not ready.

- [ ] **Step 1: Write failing cache behavior tests**

Add tests asserting: a cache hit returns decoded events without querying MySQL; a miss queries MySQL then writes with TTL 3600; cached `[]` is a hit; malformed cached JSON falls through to MySQL and refreshes the cache; Redis `get`/`setEx` errors are logged and do not prevent returning MySQL results.

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `cd backend; node --test test/schedule-service.test.js`
Expected: FAIL because `listEvents` does not yet use Redis.

- [ ] **Step 3: Implement Cache-Aside in `listEvents`**

Check Redis first, parse valid cached JSON, and return it. For misses or cache errors, query MySQL and map rows as before; then attempt to cache the JSON result for 3600 seconds. Explicitly log cache failures without suppressing MySQL errors.

- [ ] **Step 4: Write a failing post-commit invalidation test**

Add a test that injects a fake Redis client into `apply`, records transaction and Redis operations, and asserts `del('schedule:events:<userId>')` occurs after commit; also assert failed apply does not invalidate.

- [ ] **Step 5: Run the invalidation test and verify it fails**

Run: `cd backend; node --test test/schedule-service.test.js`
Expected: FAIL because `apply` does not invalidate the cache.

- [ ] **Step 6: Invalidate after successful commit**

After committing and releasing the database transaction, delete the user's cache key. Log any Redis deletion error explicitly; do not invalidate on failed transactions.

- [ ] **Step 7: Wire Redis into the app and manage its lifecycle**

Pass the existing Redis client from `server.js` into `createApp`, then into `createScheduleService`. Begin `connectRedis` without blocking API startup, close the client during server shutdown, and configure it to reject commands while reconnecting; retain the existing Redis module's error logging.

- [ ] **Step 8: Run focused and full backend tests**

Run: `cd backend; node --test test/schedule-service.test.js test/env.test.js`
Expected: PASS.

Run: `cd backend; npm test`
Expected: all backend tests pass; if the sandbox blocks local HTTP tests or the baseline-only load test cannot resolve `k6`, report those limitations separately.
