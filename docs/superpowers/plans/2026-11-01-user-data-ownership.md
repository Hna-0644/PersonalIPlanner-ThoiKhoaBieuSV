# User Data Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and preserve per-user authorization so an authenticated user cannot read or modify another user's data.

**Architecture:** Keep JWT authentication on protected routers and keep ownership predicates (`user_id`) in service SQL. Add API and service regression tests for missing authentication, identity taken from the token, foreign resource IDs, and foreign task IDs in schedule application; only change runtime code if a test reveals a missing check.

**Tech Stack:** Node.js, Express, `node:test`, Supertest, MySQL service query mocks.

**Spec:** [docs/superpowers/specs/2026-11-01-user-data-ownership-design.md](../specs/2026-11-01-user-data-ownership-design.md)

## Global Constraints

- Duy trì JWT hiện có; không tin `user_id` do request cung cấp.
- Tiếp tục áp dụng điều kiện `user_id` trực tiếp trong các thao tác dữ liệu; không thay bằng kiểm tra middleware đơn lẻ.
- Người dùng khác không được đọc hoặc sửa tài nguyên; truy cập bằng ID không thuộc quyền sở hữu trả về `404` hiện có hoặc phản hồi tương đương không tiết lộ sự tồn tại.
- Kiểm thử phải xác nhận các thao tác bị từ chối không làm thay đổi dữ liệu.
- Không thêm vai trò quản trị hoặc thay đổi mô hình phân quyền.

## Review Focus

- Thiếu hoặc token không hợp lệ trên từng nhóm API được bảo vệ phải trả `401`; kiểm tra tại Task 1.
- Tham số `userId` giả mạo từ query/request không được thay danh tính trong token; kiểm tra tại Task 1.
- ID lớp/bài tập/thông báo thuộc người khác không được làm phát sinh thao tác ghi; kiểm tra tại Task 2.
- Người dùng khác không thể áp dụng lịch chứa task ID không thuộc tài khoản; kiểm tra tại Task 3.
- Truy vấn hồ sơ/lớp/bài tập/lịch/thông báo không được dùng `userId` giả mạo từ query; kiểm tra tại Task 1.

---

### Task 1: Xác minh xác thực và danh tính token trên các router

**Files:**
- Modify: `backend/test/api.test.js`
- Modify only if needed: `backend/src/app.js`, `backend/src/middleware/authenticate.js`, or a relevant route

**Interfaces:**
- Consumes: `createApp({ pool, config })` and JWT claims already used by the API.
- Produces: API regression coverage for unauthenticated protected routes and token-derived ownership.

- [ ] **Step 1: Add table-driven tests for missing and invalid authentication**

Add a test named `protected resource routers reject requests without a bearer token`. Exercise `GET /api/user/profile`, `GET /api/classes`, `GET /api/tasks`, `GET /api/schedule/events`, `GET /api/notifications`, and `POST /api/ai/scan-schedule`. Assert every response is `401` with `UNAUTHENTICATED`. Also exercise a token with an unexpected issuer on each router and assert `401`.

- [ ] **Step 2: Run the focused API tests**

Run: `node --test test/api.test.js` from `backend`.
Expected: The new cases pass or identify a protected router that needs authentication.

- [ ] **Step 3: Test data-list identity comes from the JWT**

Add `data list routes scope queries to the authenticated user`, using a valid `usr_5` token and a conflicting `?userId=6` query on profile, class, task, schedule-event, and notification list routes. With a stub pool returning empty rows, assert each service query receives user ID `5`, not `6`.

- [ ] **Step 4: Correct any uncovered route or identity gap**

Keep the change minimal; retain per-user service SQL predicates and derive the owner only from `req.user.id`.

- [ ] **Step 5: Re-run the focused API tests**

Run: `node --test test/api.test.js` from `backend`.
Expected: All authentication and token-identity assertions pass.

### Task 2: Verify foreign IDs cannot change owned resources

**Files:**
- Create: `backend/test/ownership.test.js`
- Modify only if needed: `backend/src/services/class-service.js`, `backend/src/services/task-service.js`, or `backend/src/services/notification-service.js`

**Interfaces:**
- Consumes: Existing service methods `update(userId, resourceId, input)`, `remove(userId, resourceId)`, and `markRead(userId, notificationId)`.
- Produces: Tests proving foreign resource IDs are scoped by the caller's user ID, return not-found behavior, and do not execute an unscoped write.

- [ ] **Step 1: Add foreign-class update and delete tests**

Add tests named `class update rejects a class owned by another user without writing` and `class delete rejects a class owned by another user`. Mock the owner's lookup as present, the caller-scoped class lookup as empty, and deletion as affecting zero rows. Assert `404`, rollback where applicable, and no `UPDATE` statement.

- [ ] **Step 2: Add foreign-task update and delete tests**

Add tests named `task update rejects a task owned by another user without writing` and `task delete rejects a task owned by another user`. Assert the caller ID is bound to the lookup/delete and no update occurs after a missing caller-scoped row.

- [ ] **Step 3: Add a foreign-notification test**

Add `notification read rejects another user's notification`. Assert the update and follow-up lookup both bind the caller's user ID, return `404` when no caller-owned row exists, and do not report a successful change.

- [ ] **Step 4: Correct any uncovered ownership gap and run the focused test**

If a test finds an unscoped operation, add `user_id = ?` to that operation and bind the authenticated owner. Run: `node --test test/ownership.test.js` from `backend`.
Expected: All foreign-resource tests pass and assert no unauthorized write.

### Task 3: Verify schedule application rejects foreign task IDs

**Files:**
- Modify: `backend/test/ownership.test.js`
- Modify only if needed: `backend/src/services/schedule-service.js`

**Interfaces:**
- Consumes: `createScheduleService({ pool }).apply(userId, plan, breakMinutes, timezone)`.
- Produces: Regression coverage that task IDs in a submitted schedule must belong to the authenticated user.

- [ ] **Step 1: Add a foreign-task schedule application test**

Add `schedule application rejects another user's task without inserting events`. Return valid user preferences but no tasks from the query scoped to the caller; assert `404`, transaction rollback, and no `INSERT INTO scheduled_events` or `INSERT INTO notifications`.

- [ ] **Step 2: Correct any uncovered ownership gap**

Keep task selection and all schedule/event writes constrained by the authenticated `userId`; do not add a separate role or ownership middleware.

- [ ] **Step 3: Run focused and complete backend tests**

Run: `node --test test/ownership.test.js test/api.test.js test/schedule-service.test.js` from `backend`, then `npm test` from `backend`.
Expected: Both commands exit successfully with zero test failures.
