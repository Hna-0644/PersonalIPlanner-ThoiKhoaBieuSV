# PersonalPlanner

> **Trợ lý lập kế hoạch học tập, làm việc và không gian học thuật mở dành cho sinh viên** — kết hợp Thời khóa biểu, Lịch làm việc (ca làm), Công việc, Tự động xếp lịch AI, Đánh giá & Hỏi đáp môn học theo Trường Đại học/Cao đẳng và Thư viện Tài liệu Học tập (`/api/documents` & `/api/marketplace`) trong một nền tảng duy nhất.

PersonalPlanner hướng đến việc giúp sinh viên biết **cần làm gì tiếp theo**, nhận diện deadline quan trọng trong 24h, quản lý ca làm thêm, tự động tìm khoảng thời gian trống hợp lệ để hoàn thành bài tập, đồng thời tra cứu kinh nghiệm học tập, hỏi đáp theo lớp và chia sẻ/xem trước tài liệu học tập theo đúng trường, môn học và niên khóa.

## Mục lục

- [Tình trạng dự án](#tình-trạng-dự-án)
- [Chức năng](#chức-năng)
- [Công nghệ](#công-nghệ)
- [Hướng dẫn chạy thử](#hướng-dẫn-chạy-thử)
- [Phím tắt VS Code Tasks](#phím-tắt-vs-code-tasks)
- [Kiểm thử tự động](#kiểm-thử-tự-động)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tài liệu](#tài-liệu)
- [Lộ trình](#lộ-trình)
- [Nhóm phát triển](#nhóm-phát-triển)

## Tình trạng dự án

**Giai đoạn hiện tại: Hoàn thiện Full-stack (Frontend + Backend REST API + MySQL 8.0 + Redis Cache) kèm chế độ Offline Fallback.**

Hệ thống đã hoàn thiện kết nối giữa giao diện Frontend và Backend REST API (`USE_MOCK: false`), trang bị khóa giao dịch an toàn (`SELECT ... FOR UPDATE`), phân tách dữ liệu chống IDOR, giới hạn tần suất (Rate Limiting) và tự động chuyển sang lưu trữ cục bộ (`localStorage`) khi không kết nối được máy chủ để dễ dàng trải nghiệm nhanh.

## Chức năng

### Các tính năng chính

- **Trang tổng quan (Dashboard):** Theo dõi nhanh các kế hoạch, lịch học, ca làm việc trong ngày, công việc sắp tới hạn và tự động quét thông báo nhắc hạn trong vòng 24 giờ (`/api/notifications/reminders/scan`).
- **Quản lý Thời khóa biểu & Quét lịch AI:** Thêm/sửa/xóa lớp học, cảnh báo trùng giờ và hỗ trợ quét ảnh thời khóa biểu tự động bằng Gemini AI Vision (`/api/ai/scan-schedule`) hoặc trích xuất từ tin nhắn văn bản, Excel, SVG.
- **Quản lý Lịch làm việc (Work Shifts):** Tạo, chỉnh sửa, xóa và theo dõi các ca làm việc/lịch làm thêm lặp theo tuần (`dayOfWeek`) hoặc theo ngày cụ thể (`workDate`) trực quan ngay trên lịch biểu và bảng điều khiển (`/api/work-schedules`).
- **Quản lý Công việc (Tasks):** Thiết lập mức ưu tiên, deadline, thời lượng ước tính, tiến độ, bộ lọc và chế độ xem Danh sách / Kanban (`/api/tasks`).
- **Đánh giá & Hỏi đáp môn học (`community.html`):** Đánh giá môn học và giảng viên phân tách theo Trường Cao đẳng / Đại học (`/api/courses/:subjectId/reviews`, bắt buộc cập nhật thông tin trường trong hồ sơ trước khi xem hoặc đánh giá) kết hợp diễn đàn Hỏi đáp & Thảo luận lớp học, bình luận và Upvote (`/api/classes/:classCode/posts`).
- **Thư viện & Trao đổi Tài liệu Học tập (`tradingsource.html`):** Hỗ trợ tìm kiếm, lọc theo trường, môn học, niên khóa, danh mục (*Giáo trình, Slide bài giảng, Đề cương/Ghi chú, Đề thi/Bài tập*), lưu tài liệu yêu thích (Bookmark), xem trước PDF trực tiếp và chia sẻ tệp PDF/DOC/DOCX/PPTX (tối đa 15 MiB qua Multer) hoặc link HTTPS (`/api/documents` & `/api/marketplace`).
- **Tự động xếp lịch thông minh (Auto-scheduling):** Tự động phân bổ các công việc chưa hoàn thành vào các khung giờ trống hợp lệ, tôn trọng lịch học cố định, ca làm việc, giờ nghỉ (`breakMinutes`) và khung giờ học tập ưu tiên của người dùng mà không gây xung đột thời gian (`/api/schedule/auto-generate` & `/api/schedule/apply`).
- **Thống kê & Hồ sơ cá nhân:** Biểu đồ tiến độ công việc, quản lý thông tin cá nhân (MSSV, Ngành, Trường ĐH/CĐ, Năm học, Ảnh đại diện) và thiết lập khung giờ học tập ưu tiên.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện (Frontend) | HTML5, CSS3, Vanilla JavaScript |
| UI & Lịch biểu | Bootstrap 5.3, Bootstrap Icons, FullCalendar |
| Biểu đồ & Thông báo | Chart.js, SweetAlert2 |
| Máy chủ (Backend) | Node.js (>= 20), Express.js, Multer, Zod 4, Luxon |
| Cơ sở dữ liệu & Cache | MySQL 8.0+ (10 migrations tuần tự `001` -> `010`), Redis (Cache-Aside & Versioned Invalidation) |
| Xác thực, Bảo mật & AI | JWT (`jsonwebtoken`, `bcryptjs`), Rate Limiter, Google Gemini Vision API |
| Kiểm thử | Node.js Test Runner (`node:test`), Supertest, In-Memory E2E HTTP Harness, k6 |

Các thư viện giao diện hiện được tải từ CDN, vì vậy cần kết nối Internet khi mở ứng dụng trên trình duyệt.

## Hướng dẫn chạy thử

Bạn có thể chạy thử dự án theo **2 cách**: Chạy đầy đủ Full-stack (khuyến nghị) hoặc Chạy nhanh giao diện (chế độ Offline/LocalStorage).

### Cách 1: Chạy đầy đủ Full-stack (Backend + MySQL + Redis + Frontend)

#### 1. Yêu cầu môi trường
- **Node.js** phiên bản `20` trở lên.
- **MySQL** `8.0.16+` (hoặc **Docker Desktop** để khởi chạy nhanh MySQL và Redis qua Docker Compose).

#### 2. Cấu hình biến môi trường và cài đặt thư viện
Mở terminal (PowerShell) tại thư mục gốc của dự án (`D:\Project\PersonalIPlanner`):

```powershell
# 1. Tạo file cấu hình .env từ file mẫu
Copy-Item backend\.env.example backend\.env

# 2. Cài đặt các gói phụ thuộc cho backend (bao gồm express, mysql2, redis, multer, zod...)
npm.cmd --prefix backend install
```

Mở file `backend/.env` và kiểm tra/cập nhật các thông số:
- `DB_PASSWORD`: Mật khẩu root MySQL của bạn (bắt buộc nếu dùng Docker Compose).
- `JWT_SECRET`: Chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự.
- `GEMINI_API_KEY`: (Tùy chọn) API Key của Google Gemini nếu muốn dùng tính năng quét ảnh thời khóa biểu bằng AI.

#### 3. Khởi động Database & Chạy Migration (`001` -> `010`)
Nếu sử dụng **Docker** (chạy từ thư mục gốc của dự án):
```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d mysql redis
```
*(Nếu bạn đang đứng trong thư mục `backend\`, chỉ cần gõ `docker compose up -d`).*

Sau khi MySQL đã sẵn sàng, chạy lệnh khởi tạo bảng (migration tự động từ `001` đến `010`):
```powershell
npm.cmd --prefix backend run db:migrate
```

*(Tùy chọn)* Nạp dữ liệu mẫu (Seed data) để có sẵn tài khoản, lịch trình, đánh giá môn học và tài liệu thử nghiệm:
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
  1. Vào **Thời khóa biểu** để thêm lớp học, quét ảnh TKB bằng AI hoặc thêm **ca làm việc (Lịch làm)**.
  2. Vào **Công việc** để thêm các bài tập/dự án cần làm cùng thời lượng và hạn chót.
  3. Vào **Tự động xếp lịch** để hệ thống tự động tính toán, né các giờ học và ca làm việc, đề xuất lịch học không xung đột và nhấn **Áp dụng**.
  4. Vào **Đánh giá & Hỏi đáp** (`community.html`) để xem review môn học theo Trường Cao đẳng / Đại học và thảo luận bài tập cùng lớp.
  5. Vào **Trao đổi tài liệu** (`tradingsource.html`) để tìm kiếm, xem trước PDF, lưu bookmark và chia sẻ tài liệu học tập theo môn học & niên khóa.

---

### Cách 2: Chạy nhanh Giao diện (Không cần cài đặt Database)

Nếu bạn chỉ muốn xem thử giao diện và thao tác nhanh mà chưa cài MySQL:
1. Mở thư mục dự án bằng **Visual Studio Code**.
2. Dùng tiện ích **Live Server** mở file `frontend/index.html` (thường chạy ở `http://127.0.0.1:5500/frontend/index.html`).
3. Khi không phát hiện máy chủ Backend, ứng dụng sẽ tự động kích hoạt chế độ dự phòng cục bộ (`localStorage`), cho phép bạn đăng nhập thử, thêm lớp học, ca làm việc, công việc, chạy thử thuật toán xếp lịch, đánh giá môn học và tra cứu kho tài liệu ngay trên trình duyệt.

## Phím tắt VS Code Tasks

Dự án đã cấu hình sẵn bảng tác vụ nhanh trong `.vscode/tasks.json` (`Ctrl + Shift + P` -> `Tasks: Run Task`):
- `🚀 Start Full-Stack Dev Server (Port 5000)`: Khởi chạy máy chủ Express + Frontend.
- `🐳 Start Docker MySQL & Redis`: Bật nhanh container MySQL và Redis.
- `🗄️ Run Database Migrations`: Chạy toàn bộ migration `001` -> `010`.
- `🧪 Run Backend Unit & Integration Tests`: Chạy toàn bộ bộ kiểm thử Unit & Integration.
- `🎯 Run E2E 4-Tier Test Suite`: Chạy 89 kịch bản kiểm thử E2E 4 tầng.
- `📊 Check Git Status & Worktrees`: Kiểm tra nhanh trạng thái nhánh và tệp tin.

## Kiểm thử tự động

Dự án được trang bị bộ kiểm thử tự động toàn diện (không yêu cầu kết nối MySQL thật khi chạy test nhờ cơ chế In-Memory Pool & Mock Harness):

1. **Chạy Unit & Integration Tests (Backend Services, Repositories, Routes, Guardrails & Frontend Store/Documents):**
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
│   │   ├── community.html         # Đánh giá và hỏi đáp môn học theo Trường ĐH/CĐ
│   │   ├── login.html             # Đăng nhập / Đăng ký
│   │   ├── profile.html           # Hồ sơ cá nhân & cấu hình khung giờ
│   │   ├── statistics.html        # Thống kê hiệu suất
│   │   ├── tasks.html             # Quản lý công việc (List / Kanban)
│   │   ├── timetable.html         # Thời khóa biểu, Lịch làm việc & Quét lịch AI
│   │   └── tradingsource.html     # Thư viện & Trao đổi tài liệu học tập
│   ├── css/
│   │   ├── style.css              # Hệ thống giao diện chung
│   │   └── study-documents.css    # Giao diện chuyên biệt cho Thư viện tài liệu
│   ├── js/
│   │   ├── api.js                 # REST API Client
│   │   ├── auth.js                # Quản lý JWT token & phiên đăng nhập
│   │   ├── documents.js           # Logic tìm kiếm, lọc, xem trước PDF & chia sẻ tài liệu
│   │   ├── main.js                # Khởi tạo UI chung
│   │   ├── store.js               # State management & đồng bộ API/localStorage
│   │   ├── subject-catalog.js     # Danh mục môn học & gợi ý chuẩn hóa
│   │   ├── timetable-parser.js    # Bộ phân tích TKB từ Text, Excel, SVG
│   │   └── ui-states.js           # Quản lý thông báo, loading, lỗi
│   └── assets/
├── backend/
│   ├── src/
│   │   ├── config/                # Cấu hình env, MySQL pool, Redis
│   │   ├── controllers/           # Điều phối HTTP Request/Response (auth, timetable, tasks, community, documents, marketplace)
│   │   ├── db/migrations/         # Các file SQL migration tuần tự (001 -> 010)
│   │   ├── middleware/            # Xác thực JWT, Rate Limiter, Zod Validation, xử lý lỗi tập trung
│   │   ├── repositories/          # Truy vấn MySQL tham số hóa & quản lý Transaction
│   │   ├── routes/                # Định tuyến API (auth, classes, tasks, work-schedules, schedule, ai, community, documents, marketplace)
│   │   ├── schemas/               # Validation dữ liệu đầu vào với Zod
│   │   ├── services/              # Nghiệp vụ cốt lõi, thuật toán xếp lịch tự động & Redis Cache-Aside
│   │   └── utils/                 # Cache Manager, Public ID, Timezone UTC/+07:00
│   ├── database/
│   │   ├── schema.sql             # Lược đồ tổng hợp cơ sở dữ liệu
│   │   └── seed.sql               # Dữ liệu mẫu idempotent phục vụ chạy thử
│   ├── k6/
│   │   └── community-reviews.js   # Kịch bản kiểm thử tải với k6
│   ├── test/                      # Unit & Integration tests (Node test runner)
│   └── README.md
├── tests/
│   └── e2e/                       # Bộ kiểm thử E2E 4 tầng độc lập (89 tests)
├── docs/
│   ├── database-design.md
│   ├── diagrams.md
│   ├── future-roadmap.md
│   ├── product-vision-and-roadmap.md
│   └── shared-contract.md
├── .vscode/
│   └── tasks.json                 # Các tác vụ chạy nhanh cho VS Code
├── .gitignore
└── README.md
```

## Tài liệu

- [Ý tưởng sản phẩm và kế hoạch phát triển](docs/product-vision-and-roadmap.md) — tầm nhìn, MVP, tiêu chí nghiệm thu và roadmap.
- [Thiết kế Cơ sở dữ liệu](docs/database-design.md) — chi tiết các bảng, khóa ngoại và chiến lược Composite Index.
- [Sơ đồ hệ thống và UML](docs/diagrams.md) — use case, class/sequence diagram, luồng người dùng, kiến trúc và ERD.
- [Hợp đồng dùng chung cho AI](docs/shared-contract.md) — field, enum, ngày giờ, API và quy tắc nghiệp vụ chuẩn để phối hợp giữa các tầng.
- [Hướng dẫn chi tiết Backend](backend/README.md) — cài đặt, cấu hình database, danh sách endpoint API và kiểm thử.

## Lộ trình

1. **Hoàn thiện frontend MVP:** thống nhất luồng sử dụng, validation, trạng thái giao diện và kiểm thử nghiệp vụ. *(Đã hoàn thành)*
2. **Thiết kế dữ liệu và API:** chốt schema MySQL (migrations `001` -> `010`), hợp đồng REST và quy tắc ngày giờ. *(Đã hoàn thành)*
3. **Xây dựng backend và tích hợp:** kết nối API, xác thực JWT, quản lý lịch học, công việc và lịch làm việc. *(Đã hoàn thành)*
4. **Cải tiến lập lịch, nhắc việc & Cộng đồng học liệu:** tự động xếp lịch né xung đột ca làm/lớp học, thông báo nhắc hạn 24h, Đánh giá & Hỏi đáp môn học theo Trường ĐH/CĐ và Thư viện chia sẻ tài liệu học tập. *(Đã hoàn thành)*
5. **Kiểm thử và triển khai:** bộ kiểm thử tự động Unit/Integration/E2E, tối ưu hiệu năng Redis Cache-Aside và hướng dẫn vận hành. *(Đã hoàn thành)*

Xem [roadmap chi tiết](docs/product-vision-and-roadmap.md) để biết phạm vi và tiêu chí nghiệm thu từng giai đoạn.

## Nhóm phát triển

- **Dương Văn Thanh**
- **Dương Minh Tân**
