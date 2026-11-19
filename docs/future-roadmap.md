# PersonalPlanner — Lộ trình phát triển tương lai (Out-of-Scope trong MVP)

> **Mục đích:** Ghi nhận rõ các tính năng được khóa (**OUT-OF-SCOPE**) khỏi giai đoạn MVP nhằm giữ trọng tâm đồ án vào bài toán cốt lõi: quản lý thời khóa biểu, lịch làm việc, công việc cá nhân và thuật toán tự động xếp lịch học cho sinh viên.

## Danh mục tính năng OUT-OF-SCOPE trong MVP

Các tính năng dưới đây **không** được triển khai trong phiên bản MVP hiện tại để tránh làm loãng kiến trúc và phạm vi kiểm thử:

### 1. Mạng xã hội sinh viên (Student Social Network)
- Kết bạn, theo dõi hồ sơ học tập của sinh viên khác, bảng tin (newsfeed) chia sẻ lịch học hoặc thành tích cá nhân.
- **Lý do khóa:** MVP tập trung hoàn toàn vào trải nghiệm lập kế hoạch cá nhân hóa và bảo mật dữ liệu riêng tư của từng sinh viên.

### 2. Diễn đàn & Chat nhóm (Forums & Group Chat)
- Phòng chat thời gian thực (WebSocket/Socket.IO), diễn đàn thảo luận môn học, bình luận hoặc làm việc nhóm trực tiếp trên hệ thống.
- **Lý do khóa:** Đòi hỏi hạ tầng nhắn tin thời gian thực, kiểm duyệt nội dung và phân quyền nhóm phức tạp nằm ngoài mục tiêu lập lịch cá nhân.

### 3. Gamification (Huy hiệu & Bảng xếp hạng)
- Hệ thống điểm thưởng (XP), chuỗi ngày học liên tiếp (streak), huy hiệu thành tích (badges) và bảng xếp hạng (leaderboard) giữa các người dùng.
- **Lý do khóa:** Tránh thêm các bảng trạng thái phụ và logic tính điểm không ảnh hưởng trực tiếp đến chất lượng thuật toán xếp lịch.

### 4. Gửi Email Worker SMTP thực tế (Background SMTP Email Worker)
- Hàng đợi background worker (BullMQ/Cron) kết nối máy chủ SMTP/SendGrid để gửi email nhắc nhở tự động ra ngoài Internet.
- **Lý do khóa:** Trong MVP, cờ `emailReminder` trong `StudyPreferences` chỉ được lưu trữ ở mức cấu hình ưu tiên của người dùng; hệ thống chỉ tạo thông báo nội bộ (`Notification` lưu trong MySQL) khi có sự kiện lịch.

### 5. Web Push Notification (Thông báo đẩy trình duyệt nền)
- Service Worker đăng ký VAPID keys và gửi thông báo đẩy qua Web Push Protocol khi trình duyệt đã đóng.
- **Lý do khóa:** Cờ `browserReminder` được lưu trong hồ sơ người dùng để phục vụ giao diện thông báo trong ứng dụng (in-app notifications), chưa tích hợp Push API cấp hệ điều hành.

### 6. Chia nhỏ 1 Task thành nhiều phiên học rời rạc (Multi-Session Task Splitting)
- Tự động cắt một công việc có thời lượng lớn (ví dụ 6 giờ) thành nhiều `ScheduledEvent` nhỏ rải rác qua nhiều khung giờ hoặc nhiều ngày khác nhau.
- **Lý do khóa:** Trong MVP, ràng buộc `scheduled_events.task_id` là `UNIQUE` (quan hệ 1-1 giữa `Task` đã xếp lịch và `ScheduledEvent`). Mỗi công việc được xếp trọn vẹn vào một khung giờ học khả dụng duy nhất; nếu thời lượng vượt quá mọi khung giờ học cấu hình, thuật toán trả về mã lý do `DURATION_EXCEEDS_WINDOW` trong danh sách `unscheduled`.

---

## Điều kiện mở khóa sau MVP

Bất kỳ tính năng nào trong danh sách trên trước khi được đưa vào phát triển ở các phiên bản tiếp theo đều phải:
1. Cập nhật đặc tả entity, API endpoint và quy tắc nghiệp vụ trong [shared-contract.md](./shared-contract.md).
2. Thiết kế migration cơ sở dữ liệu riêng biệt (ví dụ: gỡ bỏ unique index trên `scheduled_events.task_id` nếu mở khóa tính năng chia nhỏ task).
3. Bổ sung bộ kiểm thử đơn vị (unit tests) và kiểm thử tích hợp (integration tests) tương ứng.
