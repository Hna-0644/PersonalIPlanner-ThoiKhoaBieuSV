# PersonalPlanner

> **Trợ lý lập kế hoạch học tập dành cho sinh viên** — kết hợp thời khóa biểu, công việc và thời gian tự học trong một nơi.

PersonalPlanner hướng đến việc giúp sinh viên biết **cần làm gì tiếp theo**, nhận diện deadline quan trọng và tìm khoảng thời gian phù hợp để hoàn thành công việc. Lịch được đề xuất để người dùng xem trước và xác nhận trước khi áp dụng.

## Mục lục

- [Tình trạng dự án](#tình-trạng-dự-án)
- [Chức năng](#chức-năng)
- [Công nghệ](#công-nghệ)
- [Bắt đầu](#bắt-đầu)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tài liệu](#tài-liệu)
- [Lộ trình](#lộ-trình)
- [Nhóm phát triển](#nhóm-phát-triển)

## Tình trạng dự án

**Giai đoạn hiện tại: prototype frontend và backend MVP ban đầu.**

Giao diện có các trang tổng quan, thời khóa biểu, công việc, tự động sắp xếp, thống kê, hồ sơ và đăng nhập/đăng ký. Dữ liệu frontend vẫn mặc định dùng `localStorage`; `ApiService` đang bật chế độ mock. Backend đã có API MVP và migration MySQL; cần cài đặt, cấu hình database và chủ động chuyển frontend sang API trước khi dùng chung dữ liệu.

> Đăng nhập/dữ liệu trong frontend mock chỉ phục vụ trình diễn. Backend có JWT và truy vấn MySQL, nhưng chưa được triển khai lên môi trường production; email nhắc lịch và refresh token chưa có.

## Chức năng

### Đã có trong prototype

- Trang tổng quan các kế hoạch và công việc.
- Quản lý thời khóa biểu và cảnh báo các lớp học trùng giờ.
- Quản lý công việc với mức ưu tiên, deadline, tiến độ, bộ lọc và chế độ danh sách/kanban.
- Tạo và xem trước lịch học/làm việc đề xuất theo khung giờ ưu tiên.
- Thống kê công việc, hồ sơ cá nhân và thiết lập giờ học.
- Lưu dữ liệu demo cục bộ trên trình duyệt.

### Định hướng phát triển

- Hoàn thiện trải nghiệm frontend và các trạng thái lỗi/rỗng/đang tải.
- Kết nối frontend với REST API đã xây dựng, xác thực người dùng và lưu trữ dữ liệu trên MySQL.
- Bổ sung nhắc lịch đáng tin cậy và cải tiến thuật toán lập lịch.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | HTML, CSS, JavaScript |
| UI và lịch | Bootstrap 5, FullCalendar |
| Biểu đồ và thông báo | Chart.js, SweetAlert2 |
| Lưu trữ prototype | Browser `localStorage` |
| Backend | Node.js, Express.js |
| Cơ sở dữ liệu | MySQL 8.0.16+ (có migration khởi tạo) |

Các thư viện giao diện hiện được tải từ CDN, vì vậy cần kết nối Internet khi mở ứng dụng.

## Bắt đầu

### Yêu cầu

- Trình duyệt web hiện đại.
- Kết nối Internet để tải các thư viện giao diện từ CDN.
- Visual Studio Code và tiện ích Live Server (khuyến nghị) để chạy giao diện cục bộ.

### Chạy giao diện

1. Mở repository bằng Visual Studio Code.
2. Dùng Live Server để mở `frontend/index.html`.
3. Điều hướng qua menu để xem các trang lịch, công việc, lập lịch tự động, thống kê và hồ sơ.

Ứng dụng hiện dùng dữ liệu demo trong `localStorage`. Xóa dữ liệu trang web trong trình duyệt sẽ xóa dữ liệu demo đã lưu.

### Chạy backend

Backend dùng Node.js và MySQL. Xem [hướng dẫn cài đặt backend](backend/README.md) để tạo database, cấu hình `.env`, chạy migration và khởi động API.

## Cấu trúc dự án

```text
PersonalPlanner/
├── frontend/
│   ├── index.html
│   ├── pages/
│   │   ├── auto-schedule.html
│   │   ├── login.html
│   │   ├── profile.html
│   │   ├── statistics.html
│   │   ├── tasks.html
│   │   └── timetable.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── main.js
│   │   └── store.js
│   └── assets/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/migrations/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── services/
│   ├── test/
│   └── README.md
├── docs/
│   ├── diagrams.md
│   ├── product-vision-and-roadmap.md
│   └── shared-contract.md
├── tests/                   # Khu vực dự kiến cho kiểm thử
├── .gitignore
└── README.md
```

## Tài liệu

- [Ý tưởng sản phẩm và kế hoạch phát triển](docs/product-vision-and-roadmap.md) — tầm nhìn, MVP, tiêu chí nghiệm thu và roadmap.
- [Sơ đồ hệ thống và UML](docs/diagrams.md) — use case, class/sequence diagram, luồng người dùng, kiến trúc và ERD.
- [Hợp đồng dùng chung cho AI](docs/shared-contract.md) — field, enum, ngày giờ, API và quy tắc nghiệp vụ chuẩn để phối hợp giữa các tầng.
- [Hướng dẫn backend](backend/README.md) — cài đặt, cấu hình database, chạy API và test.

## Lộ trình

1. **Hoàn thiện frontend MVP:** thống nhất luồng sử dụng, validation, trạng thái giao diện và kiểm thử nghiệp vụ.
2. **Thiết kế dữ liệu và API:** chốt schema MySQL, hợp đồng REST và quy tắc ngày giờ.
3. **Xây dựng backend và tích hợp:** thay mock bằng API; xác thực và giới hạn dữ liệu theo người dùng.
4. **Cải tiến lập lịch và nhắc việc:** xử lý các ràng buộc, thông báo và tác vụ định kỳ.
5. **Kiểm thử và triển khai:** tăng cường bảo mật, khả năng truy cập, hiệu năng và hướng dẫn vận hành.

Xem [roadmap chi tiết](docs/product-vision-and-roadmap.md) để biết phạm vi và tiêu chí nghiệm thu từng giai đoạn.

## Nhóm phát triển

- **Dương Văn Thanh**
- **Dương Minh Tân**
