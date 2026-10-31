# PersonalPlanner Backend

REST API MVP sử dụng Node.js, Express và MySQL. API hiện có đăng ký/đăng nhập, hồ sơ, thời khóa biểu, công việc, lập lịch đề xuất/áp dụng, lịch đã áp dụng và thông báo.

## Yêu cầu

- Node.js 20 trở lên.
- MySQL 8.0.16 trở lên.
- Tạo database trước khi migrate, ví dụ:

```sql
CREATE DATABASE personalplanner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

## Cài đặt và chạy

Từ thư mục gốc repository:

```powershell
Copy-Item backend\.env.example backend\.env
```

Sửa `backend/.env` theo cấu hình MySQL của máy và đặt `JWT_SECRET` thành secret ngẫu nhiên tối thiểu 32 ký tự. Không đưa file `.env` lên Git.

```powershell
npm.cmd --prefix backend install
npm.cmd --prefix backend run db:migrate
npm.cmd --prefix backend run dev
```

API mặc định chạy tại `http://localhost:5000`; health check tại `GET /api/health`. CORS origin mặc định là `http://127.0.0.1:5500`; cập nhật `CORS_ORIGIN` khi frontend chạy ở origin khác.

## API

Các endpoint, request/response, enum và quy tắc dữ liệu chuẩn được mô tả trong [hợp đồng dùng chung](../docs/shared-contract.md). Mọi response thành công dùng `{ "data": ... }`; mọi lỗi dùng `{ "error": { "code", "message", "details" } }`.
ID công khai là chuỗi có prefix như `tsk_12`; ID BIGINT chỉ được chuyển đổi bên trong backend.

Để gọi endpoint cần đăng nhập, gửi:

```http
Authorization: Bearer <accessToken>
```

Danh sách endpoint hiện thực:

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/user/profile`, `PUT /api/user/profile`
- CRUD `/api/classes` và `/api/tasks`
- `GET /api/schedule/events`
- `POST /api/schedule/auto-generate`, `POST /api/schedule/apply`
- `GET /api/notifications`, `PUT /api/notifications/read-all`, `PUT /api/notifications/{id}/read`

Token access hiện không có refresh-token endpoint. Gửi email nhắc lịch, quên mật khẩu và worker định kỳ chưa được triển khai.

## Database migrations

Các migration nằm trong `src/db/migrations/` và được ghi nhận tại bảng `schema_migrations`. Chạy `npm.cmd --prefix backend run db:migrate` sau khi tạo database và cấu hình `.env`.

### Dữ liệu demo

Sau khi migration thành công, nạp dữ liệu mẫu bằng MySQL client:

```powershell
Get-Content -Raw backend/database/seed.sql | mysql --default-character-set=utf8mb4 -u your_mysql_user -p personalplanner
```

Tài khoản demo: `demo@personalplanner.local`, mật khẩu `12345678`. Seed có thể chạy lại mà không thêm trùng các bản ghi mẫu.

## Kiểm thử

```powershell
npm.cmd --prefix backend test
```

Các test hiện kiểm tra HTTP envelope, auth middleware, validation, thứ tự lập lịch và xử lý timezone/busy slots mà không cần kết nối MySQL. Cần MySQL riêng để xác minh migration và luồng truy vấn tích hợp đầy đủ.
