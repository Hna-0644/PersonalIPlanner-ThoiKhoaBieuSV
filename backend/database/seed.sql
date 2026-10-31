-- =====================================================================
-- PersonalPlanner - Seed Data Script
-- Dữ liệu mẫu ban đầu để kiểm thử hệ thống
-- Mật khẩu mặc định của tài khoản demo là: 12345678 (hash bcrypt $2a$10$...)
-- =====================================================================

USE `personalplanner`;

-- 1. Insert Demo User: Dương Văn Thanh
-- Hash bên dưới là bcrypt của chuỗi '12345678' với salt round 10
INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `student_id`, `major`, `university`, `avatar`) 
VALUES (
  1,
  'Dương Văn Thanh',
  'td863166@gmail.com',
  '$2a$10$fS41q9JbN60n0LqFh5xJmOhfXfSgD8f0O3w5cM9kRz6A1XmYyGq6K',
  '2022600123',
  'Công nghệ thông tin',
  'Đại học Quốc gia',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
) ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- 2. Insert Study Preferences for User 1
INSERT INTO `study_preferences` (`id`, `user_id`, `preferred_windows`, `break_minutes`, `timezone`, `email_reminder`, `browser_reminder`)
VALUES (
  1,
  1,
  '{
    "morning": { "active": true, "start": "08:00", "end": "11:30" },
    "afternoon": { "active": true, "start": "14:00", "end": "17:30" },
    "evening": { "active": true, "start": "19:30", "end": "22:00" }
  }',
  15,
  'Asia/Ho_Chi_Minh',
  TRUE,
  TRUE
) ON DUPLICATE KEY UPDATE `user_id` = VALUES(`user_id`);

-- 3. Insert Classes for User 1
INSERT INTO `classes` (`id`, `user_id`, `title`, `code`, `room`, `lecturer`, `day_of_week`, `start_time`, `end_time`, `color`, `notes`)
VALUES
  (1, 1, 'Lập trình Web (Node.js & React)', 'IT3020', 'A2-301', 'ThS. Nguyễn Văn A', 1, '07:30:00', '10:00:00', '#4f46e5', 'Mang theo laptop cài sẵn Node.js v20'),
  (2, 1, 'Cơ sở dữ liệu nâng cao', 'IT3040', 'B1-204', 'TS. Trần Thị B', 3, '13:30:00', '16:00:00', '#06b6d4', 'Thực hành MySQL bài lab 3'),
  (3, 1, 'Trí tuệ nhân tạo (AI)', 'IT4010', 'C3-501', 'PGS. TS. Lê Văn C', 5, '08:00:00', '11:00:00', '#8b5cf6', 'Thảo luận chuyên đề Tìm kiếm A* và Heuristic'),
  (4, 1, 'An toàn thông tin mạng', 'IT4080', 'MS Teams Online', 'TS. Phạm Văn D', 6, '09:00:00', '11:30:00', '#10b981', 'Kiểm tra trắc nghiệm 15 phút đầu giờ')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 4. Insert Tasks for User 1
INSERT INTO `tasks` (`id`, `user_id`, `title`, `subject`, `priority`, `status`, `progress`, `estimated_hours`, `deadline`, `description`)
VALUES
  (1, 1, 'Làm bài tập lớn Web - Xây dựng RESTful API', 'Lập trình Web (Node.js & React)', 'high', 'inprogress', 65, 3.50, DATE_ADD(NOW(), INTERVAL 2 DAY), 'Hoàn thiện chức năng xác thực JWT và bảo vệ route.'),
  (2, 1, 'Thiết kế mô hình quan hệ ERD CSDL', 'Cơ sở dữ liệu nâng cao', 'urgent', 'todo', 15, 2.00, DATE_ADD(NOW(), INTERVAL 1 DAY), 'Vẽ lược đồ ERD chuẩn hóa 3NF cho đồ án hệ thống quản lý.'),
  (3, 1, 'Ôn tập thuật toán A* và Cây trò chơi Minimax', 'Trí tuệ nhân tạo (AI)', 'medium', 'todo', 0, 2.50, DATE_ADD(NOW(), INTERVAL 4 DAY), 'Làm lại các bài tập tính toán hàm đánh giá f(n).'),
  (4, 1, 'Báo cáo thực hành mã hóa bất đối xứng RSA', 'An toàn thông tin mạng', 'high', 'done', 100, 2.00, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Đã nộp file PDF qua cổng LMS.'),
  (5, 1, 'Đọc tài liệu React Query & Zustand state management', 'Tự học', 'low', 'todo', 0, 1.50, DATE_ADD(NOW(), INTERVAL 6 DAY), 'Tìm hiểu cách cache dữ liệu client không cần Redux.')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 5. Insert Scheduled Events for User 1 (Ví dụ một task đã được hoàn thành hoặc xếp lịch)
INSERT INTO `scheduled_events` (`id`, `user_id`, `task_id`, `title`, `subject`, `start_at`, `end_at`, `source`, `color`)
VALUES (
  1,
  1,
  4,
  'Báo cáo thực hành mã hóa bất đối xứng RSA',
  'An toàn thông tin mạng',
  DATE_SUB(NOW(), INTERVAL 2 DAY),
  DATE_SUB(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL -2 HOUR),
  'auto',
  '#10b981'
) ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 6. Insert Notifications for User 1
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `is_read`, `created_at`)
VALUES
  (1, 1, 'urgent', 'Sắp đến hạn!', 'Công việc "Thiết kế mô hình quan hệ ERD CSDL" hết hạn vào ngày mai.', FALSE, NOW()),
  (2, 1, 'info', 'Nhắc nhở lịch học', 'Lịch học môn Lập trình Web diễn ra vào 07:30 sáng Thứ Hai tại A2-301.', FALSE, NOW()),
  (3, 1, 'success', 'Chúc mừng!', 'Bạn đã hoàn thành 100% nhiệm vụ Báo cáo thực hành RSA.', TRUE, NOW())
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

