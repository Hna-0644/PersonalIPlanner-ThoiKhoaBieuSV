# Database Composite Indexes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tối ưu hóa hiệu năng truy vấn cho backend bằng cách thêm các Composite Indexes (chỉ mục kết hợp) vào các bảng `classes`, `tasks`, và `scheduled_events` trong cơ sở dữ liệu MySQL của PersonalPlanner.

**Architecture:** Sử dụng kỹ thuật Composite Indexing theo mẫu truy vấn thực tế của backend (`WHERE user_id = ? AND status = ? ORDER BY deadline ASC`, `WHERE user_id = ? AND day_of_week = ?`). Cập nhật file DDL `schema.sql` và tài liệu kỹ thuật `database-design.md`.

**Tech Stack:** MySQL 8.0, SQL DDL, Markdown.

**Spec:** [docs/database-design.md](file:///d:/Project/PersonalIPlanner/docs/database-design.md) và [docs/shared-contract.md](file:///d:/Project/PersonalIPlanner/docs/shared-contract.md).

## Global Constraints

- Tên cột theo chuẩn `snake_case`, tên khóa và index theo tiền tố `idx_` hoặc `fk_`.
- Không làm thay đổi kiểu dữ liệu hoặc phá vỡ các quan hệ khóa ngoại (Foreign Keys) hiện có.
- Tuân thủ bộ mã ký tự `utf8mb4` và collation `utf8mb4_unicode_ci`.

## Review Focus

- Kiểm tra thứ tự các cột trong composite index: cột điều kiện đẳng thức (`user_id`, `status`, `day_of_week`) phải đứng trước cột khoảng hoặc sắp xếp (`start_time`, `deadline`).
- Đảm bảo tính tương thích khi xóa các index đơn lẻ cũ để không tạo index dư thừa (redundant indexes).
- Kiểm tra cú pháp SQL bằng MySQL script parser hoặc test runner.

---

### Task 1: Cập nhật Composite Indexes trong `backend/database/schema.sql`

**Files:**
- Modify: `backend/database/schema.sql`

**Interfaces:**
- Consumes: Bảng `classes`, `tasks`, `scheduled_events` hiện tại.
- Produces: Các chỉ mục kết hợp mới:
  - `classes`: `idx_classes_user_day_time (user_id, day_of_week, start_time)`
  - `tasks`: `idx_tasks_user_status_deadline (user_id, status, deadline)`, `idx_tasks_user_status_priority (user_id, status, priority)`
  - `scheduled_events`: `idx_events_user_time (user_id, start_at, end_at)`

- [ ] **Step 1: Cập nhật bảng `classes` trong `schema.sql`**
  Thay thế index đơn `idx_classes_user_day (user_id, day_of_week)` bằng composite index tối ưu:
  `INDEX idx_classes_user_day_time (user_id, day_of_week, start_time)`

- [ ] **Step 2: Cập nhật bảng `tasks` trong `schema.sql`**
  Thêm composite index phục vụ lọc theo trạng thái và sắp xếp theo hạn chót / độ ưu tiên:
  `INDEX idx_tasks_user_status_deadline (user_id, status, deadline)`
  `INDEX idx_tasks_user_status_priority (user_id, status, priority)`

- [ ] **Step 3: Kiểm tra bảng `scheduled_events` trong `schema.sql`**
  Xác nhận đã có composite index `idx_events_user_time (user_id, start_at, end_at)` để quét khung giờ bận và trống.

---

### Task 2: Đồng bộ tài liệu thiết kế CSDL trong `docs/database-design.md`

**Files:**
- Modify: `docs/database-design.md`

**Interfaces:**
- Consumes: Định nghĩa Index mới từ Task 1.
- Produces: Tài liệu thiết kế CSDL cập nhật với bảng danh mục Index và phân tích hiệu năng.

- [ ] **Step 1: Cập nhật bảng Data Dictionary của `classes` và `tasks`**
  Ghi nhận các index mới vào bảng mô tả chi tiết của từng bảng trong tài liệu.

- [ ] **Step 2: Cập nhật phần Chiến lược Index (Indexing Strategy)**
  Giải thích rõ lý do chọn Composite Index `(user_id, status, deadline)` và `(user_id, day_of_week, start_time)` đối với ứng dụng có nhiều người dùng.

---

### Task 3: Xác minh cú pháp SQL và tính toàn vẹn của Schema

**Files:**
- Test: `backend/database/schema.sql`

- [ ] **Step 1: Kiểm tra cú pháp SQL**
  Xác minh cú pháp DDL của file `backend/database/schema.sql` không có lỗi cú pháp bằng script Node.js kiểm tra.

- [ ] **Step 2: Xác nhận không còn index đơn trùng lặp gây lãng phí tài nguyên**
  Đảm bảo không bị trùng giữa `(user_id, day_of_week)` và `(user_id, day_of_week, start_time)` vì prefix index của composite index đã tự động bao hàm index đơn.

