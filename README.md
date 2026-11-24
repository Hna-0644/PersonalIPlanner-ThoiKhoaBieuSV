# PersonalPlanner

> **Trợ lý lập kế hoạch học tập và làm việc dành cho sinh viên** — kết hợp thời khóa biểu, lịch làm việc (ca làm), công việc và thời gian tự học trong một nơi.

PersonalPlanner hướng đến việc giúp sinh viên biết **cần làm gì tiếp theo**, nhận diện deadline quan trọng, quản lý ca làm thêm và tự động tìm khoảng thời gian phù hợp để hoàn thành công việc. Lịch học/làm việc được đề xuất tự động để người dùng xem trước và xác nhận trước khi áp dụng.

## Mục lục

- [Tình trạng dự án](#tình-trạng-dự-án)
- [Chức năng](#chức-năng)
- [Công nghệ](#công-nghệ)
- [Hướng dẫn chạy thử](#hướng-dẫn-chạy-thử)
- [Kiểm thử tự động](#kiểm-thử-tự-động)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tài liệu](#tài-liệu)
- [Lộ trình](#lộ-trình)
- [Nhóm phát triển](#nhóm-phát-triển)

## Tình trạng dự án

**Giai đoạn hiện tại: Tích hợp Full-stack (Frontend + Backend REST API + MySQL + Redis) kèm chế độ Offline Fallback.**

Hệ thống đã hoàn thiện kết nối giữa giao diện Frontend và Backend REST API (`USE_MOCK: false`), đồng thời hỗ trợ tự động chuyển sang lưu trữ cục bộ (`localStorage`) khi không kết nối được máy chủ để dễ dàng trải nghiệm nhanh.

## Chức năng

### Các tính năng chính

- **Trang tổng quan (Dashboard):** Theo dõi nhanh các kế hoạch, lịch học, ca làm việc trong ngày và công việc sắp tới hạn.
- **Quản lý Thời khóa biểu & Quét lịch AI:** Thêm/sửa/xóa lớp học, cảnh báo trùng giờ và hỗ trợ quét ảnh thời khóa biểu tự động bằng Gemini AI Vision (`/api/ai/scan-schedule`).
- **Quản lý Lịch làm việc (Work Shifts):** Tạo, chỉnh sửa, xóa và theo dõi các ca làm việc/lịch làm thêm trực quan ngay trên lịch biểu và bảng điều khiển (`/api/work-schedules`).
- **Quản lý Công việc (Tasks):** Thiết lập mức ưu tiên, deadline, thời lượng ước tính, tiến độ, bộ lọc và chế độ xem Danh sách / Kanban (`/api/tasks`).
- **Cộng đồng & Thư viện tài liệu:** Đánh giá/hỏi đáp môn học; trang Trao đổi tài liệu hỗ trợ tìm kiếm, lọc, xem trước PDF và chia sẻ PDF/DOC/DOCX/PPTX hoặc link HTTPS theo trường, môn, niên khóa, bên cạnh chợ trao đổi (`/api/documents`).
- **Tự động xếp lịch thông minh (Auto-scheduling):** Tự động phân bổ các công việc chưa hoàn thành vào các khung giờ trống hợp lệ, tôn trọng lịch học cố định, ca làm việc, giờ nghỉ và khung giờ продуктив ưu tiên của người dùng mà không gây xung đột thời gian (`/api/schedule/auto-generate` & `/api/schedule/apply`).
- **Thống kê & Hồ sơ cá nhân:** Biểu đồ tiến độ công việc, quản lý thông tin cá nhân và thiết lập khung giờ học tập ưu tiên.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện (Frontend) | HTML5, CSS3, Vanilla JavaScript |
| UI & Lịch biểu | Bootstrap 5, FullCalendar |
| Biểu đồ & Thông báo | Chart.js, SweetAlert2 |
| Máy chủ (Backend) | Node.js (>= 20), Express.js, Multer, Zod, Luxon |
| Cơ sở dữ liệu & Cache | MySQL 8.0+, Redis (tùy chọn cache lịch trình) |
| Xác thực & AI | JWT (`jsonwebtoken`, `bcryptjs`), Google Gemini Vision API |
| Kiểm thử | Node.js Test Runner, Supertest, In-Memory E2E HTTP Harness |

Các thư viện giao diện hiện được tải từ CDN, vì vậy cần kết nối Internet khi mở ứng dụng trên trình duyệt.

## Hướng dẫn chạy thử

Bạn có thể chạy thử dự án theo **2 cách**: Chạy đầy đủ Full-stack (khuyến nghị) hoặc Chạy nhanh giao diện (chế độ Offline/LocalStorage).

### Cách 1: Chạy đầy đủ Full-stack (Backend + MySQL + Frontend)

#### 1. Yêu cầu môi trường
- **Node.js** phiên bản `20` trở lên.
- **MySQL** `8.0.16+` (hoặc **Docker Desktop** để khởi chạy nhanh MySQL và Redis qua Docker Compose).

#### 2. Cấu hình biến môi trường và cài đặt thư viện
Mở terminal (PowerShell) tại thư mục gốc của dự án:

```powershell
# 1. Tạo file cấu hình .env từ file mẫu
Copy-Item backend\.env.example backend\.env

# 2. Cài đặt các gói phụ thuộc cho backend
npm.cmd --prefix backend install
```

Mở file `backend/.env` và kiểm tra/cập nhật các thông số:
- `DB_PASSWORD`: Mật khẩu root MySQL của bạn (bắt buộc nếu dùng Docker Compose).
- `JWT_SECRET`: Chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự.
- `GEMINI_API_KEY`: (Tùy chọn) API Key của Google Gemini nếu muốn dùng tính năng quét ảnh thời khóa biểu bằng AI.

#### 3. Khởi động Database & Chạy Migration
Nếu sử dụng **Docker**:
```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d mysql redis
```
*(Nếu dùng MySQL cài sẵn trên máy, hãy tạo database trống tên `personal_planner` với charset `utf8mb4`).*

Sau khi MySQL đã sẵn sàng, chạy lệnh khởi tạo bảng (migration) tự động hoặc thủ công:
```powershell
npm.cmd --prefix backend run db:migrate
```

*(Tùy chọn)* Nạp dữ liệu mẫu (Seed data) để có sẵn tài khoản và lịch trình thử nghiệm:
```powershell
Get-Content -Raw backend/database/seed.sql | mysql --default-character-set=utf8mb4 -u root -p personal_planner
```
> **Tài khoản demo sau khi seed:** Email `demo@personalplanner.local` | Mật khẩu: `12345678`

#### 4. Khởi động Server và trải nghiệm
```powershell
npm.cmd --prefix backend run dev
```
- Máy chủ Backend đồng thời phục vụ luôn giao diện tĩnh (Frontend) tại địa chỉ: **`http://localhost:5000`**
- Kiểm tra trạng thái API (Health check): **`http://localhost:5000/api/health`**
- Mở trình duyệt truy cập `http://localhost:5000` (hoặc mở `frontend/index.html` qua tiện ích **Live Server** của VS Code ở cổng `5500`), đăng ký tài khoản mới hoặc đăng nhập bằng tài khoản demo để trải nghiệm:
  1. Vào **Thời khóa biểu** để thêm lớp học hoặc **ca làm việc (Lịch làm)**.
  2. Vào **Công việc** để thêm các bài tập/dự án cần làm cùng thời lượng và hạn chót.
  3. Vào **Tự động sắp xếp** để hệ thống tự động tính toán, né các giờ học và ca làm việc, đề xuất lịch làm việc không xung đột và nhấn **Áp dụng**.

---

### Cách 2: Chạy nhanh Giao diện (Không cần cài đặt Database)

Nếu bạn chỉ muốn xem thử giao diện và thao tác nhanh mà chưa cài MySQL:
1. Mở thư mục dự án bằng **Visual Studio Code**.
2. Dùng tiện ích **Live Server** mở file `frontend/index.html` (thường chạy ở `http://127.0.0.1:5500/frontend/index.html`).
3. Khi không phát hiện máy chủ Backend, ứng dụng sẽ tự động kích hoạt chế độ dự phòng cục bộ (`localStorage`), cho phép bạn đăng nhập thử, thêm lớp học, ca làm việc, công việc và chạy thử thuật toán xếp lịch ngay trên trình duyệt.

## Kiểm thử tự động

Dự án được trang bị bộ kiểm thử tự động toàn diện (không yêu cầu kết nối MySQL thật khi chạy test nhờ cơ chế In-Memory Pool & Mock Harness):

1. **Chạy Unit & Integration Tests (Backend & Frontend Store/API logic - 61 tests):**
   ```powershell
   npm.cmd --prefix backend test
   ```

2. **Chạy bộ kiểm thử E2E 4 tầng (Tier 1 -> Tier 4 - 89 ca kiểm thử nghiệp vụ):**
   ```powershell
   node tests/e2e/test-runner.js
   ```
   *(Có thể chạy riêng từng tầng bằng tham số, ví dụ: `node tests/e2e/test-runner.js --tier=1`)*

## Cấu trúc dự án

```text
PersonalPlanner/
├── frontend/
│   ├── index.html                 # Trang tổng quan (Dashboard)
│   ├── pages/
│   │   ├── auto-schedule.html     # Giao diện tự động xếp lịch & quản lý lịch làm
│   │   ├── login.html             # Đăng nhập / Đăng ký
│   │   ├── profile.html           # Hồ sơ cá nhân & cấu hình khung giờ
│   │   ├── statistics.html        # Thống kê hiệu suất
│   │   ├── tasks.html             # Quản lý công việc (List / Kanban)
│   │   └── timetable.html         # Thời khóa biểu & Lịch làm việc
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js                 # REST API Client
│   │   ├── auth.js                # Quản lý JWT token & phiên đăng nhập
│   │   ├── main.js                # Khởi tạo UI chung
│   │   ├── store.js               # State management & đồng bộ API/localStorage
│   │   └── ui-states.js           # Quản lý thông báo, loading, lỗi
│   └── assets/
├── backend/
│   ├── src/
│   │   ├── config/                # Cấu hình env, MySQL pool, Redis
│   │   ├── db/migrations/         # Các file SQL migration (001 -> 003)
│   │   ├── middleware/            # Xác thực JWT, xử lý lỗi tập trung
│   │   ├── routes/                # Định tuyến API (auth, classes, tasks, work-schedules, schedule, ai...)
│   │   ├── schemas/               # Validation dữ liệu đầu vào với Zod
│   │   └── services/              # Nghiệp vụ cốt lõi & thuật toán xếp lịch tự động
│   ├── database/
│   │   └── seed.sql               # Dữ liệu mẫu phục vụ chạy thử
│   ├── test/                      # Unit & Integration tests (Node test runner)
│   └── README.md
├── tests/
│   └── e2e/                       # Bộ kiểm thử E2E 4 tầng độc lập (89 tests)
├── docs/
│   ├── diagrams.md
│   ├── product-vision-and-roadmap.md
│   └── shared-contract.md
├── .gitignore
└── README.md
```

## Tài liệu

- [Ý tưởng sản phẩm và kế hoạch phát triển](docs/product-vision-and-roadmap.md) — tầm nhìn, MVP, tiêu chí nghiệm thu và roadmap.
- [Sơ đồ hệ thống và UML](docs/diagrams.md) — use case, class/sequence diagram, luồng người dùng, kiến trúc và ERD.
- [Hợp đồng dùng chung cho AI](docs/shared-contract.md) — field, enum, ngày giờ, API và quy tắc nghiệp vụ chuẩn để phối hợp giữa các tầng.
- [Hướng dẫn chi tiết Backend](backend/README.md) — cài đặt, cấu hình database, danh sách endpoint API và kiểm thử.

## Lộ trình

1. **Hoàn thiện frontend MVP:** thống nhất luồng sử dụng, validation, trạng thái giao diện và kiểm thử nghiệp vụ. *(Đã hoàn thành)*
2. **Thiết kế dữ liệu và API:** chốt schema MySQL, hợp đồng REST và quy tắc ngày giờ. *(Đã hoàn thành)*
3. **Xây dựng backend và tích hợp:** kết nối API, xác thực JWT, quản lý lịch học, công việc và lịch làm việc. *(Đã hoàn thành)*
4. **Cải tiến lập lịch và nhắc việc:** tự động xếp lịch né xung đột ca làm/lớp học, thông báo và tác vụ định kỳ. *(Đã hoàn thành lõi lập lịch)*
5. **Kiểm thử và triển khai:** bộ kiểm thử tự động Unit/Integration/E2E, tối ưu hiệu năng và hướng dẫn vận hành. *(Đang hoàn thiện triển khai thực tế)*

Xem [roadmap chi tiết](docs/product-vision-and-roadmap.md) để biết phạm vi và tiêu chí nghiệm thu từng giai đoạn.

docker compose up -d
npm run db:migrate
npm run dev
## Nhóm phát triển

- **Dương Văn Thanh**
- **Dương Minh Tân**
