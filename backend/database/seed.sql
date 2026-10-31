-- PersonalPlanner demo data for the schema in src/db/migrations/.
-- Demo login: demo@personalplanner.local / 12345678
-- Re-running this script does not add duplicate sample records.

USE `personalplanner`;

INSERT INTO `users` (
  `full_name`, `email`, `password_hash`, `student_id`, `major`, `university`
)
VALUES (
  'Nguyễn Minh An',
  'demo@personalplanner.local',
  '$2a$10$mIgRlNOwEQndso/tFFNO2ez3LWNzk8KkIRNZxhNJBwy4LvQ6FKg/G',
  '2026000001',
  'Công nghệ thông tin',
  'Đại học Quốc gia Hà Nội'
)
ON DUPLICATE KEY UPDATE `email` = 'demo@personalplanner.local';

SET @demo_user_id := (
  SELECT `id` FROM `users` WHERE `email` = 'demo@personalplanner.local'
);

INSERT INTO `study_preferences` (
  `user_id`, `preferred_hours`, `break_minutes`, `timezone`,
  `email_reminder`, `browser_reminder`
)
VALUES (
  @demo_user_id,
  JSON_OBJECT(
    'morning', JSON_OBJECT('active', TRUE, 'start', '08:00', 'end', '11:30'),
    'afternoon', JSON_OBJECT('active', TRUE, 'start', '14:00', 'end', '17:30'),
    'evening', JSON_OBJECT('active', TRUE, 'start', '19:30', 'end', '22:00')
  ),
  15,
  'Asia/Ho_Chi_Minh',
  TRUE,
  TRUE
)
ON DUPLICATE KEY UPDATE
  `preferred_hours` = VALUES(`preferred_hours`),
  `break_minutes` = VALUES(`break_minutes`),
  `timezone` = VALUES(`timezone`),
  `email_reminder` = VALUES(`email_reminder`),
  `browser_reminder` = VALUES(`browser_reminder`);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Lập trình Web (Node.js & React)', 'IT3020', 'A2-301',
  'ThS. Nguyễn Văn A', 1, '07:30:00', '10:00:00', '#4f46e5',
  'Mang theo laptop cài sẵn Node.js v20'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT3020'
);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Cơ sở dữ liệu nâng cao', 'IT3040', 'B1-204',
  'TS. Trần Thị B', 3, '13:30:00', '16:00:00', '#06b6d4',
  'Thực hành MySQL bài lab 3'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT3040'
);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Trí tuệ nhân tạo (AI)', 'IT4010', 'C3-501',
  'PGS. TS. Lê Văn C', 5, '08:00:00', '11:00:00', '#8b5cf6',
  'Thảo luận chuyên đề Tìm kiếm A* và Heuristic'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT4010'
);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'An toàn thông tin mạng', 'IT4080', 'MS Teams Online',
  'TS. Phạm Văn D', 6, '09:00:00', '11:30:00', '#10b981',
  'Kiểm tra trắc nghiệm 15 phút đầu giờ'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT4080'
);

INSERT INTO `tasks` (
  `user_id`, `title`, `subject`, `priority`, `status`, `progress`,
  `estimated_hours`, `deadline`, `description`
)
SELECT
  @demo_user_id, 'Làm bài tập lớn Web - Xây dựng RESTful API',
  'Lập trình Web (Node.js & React)', 'high', 'inprogress', 65, 3.50,
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 2 DAY),
  'Hoàn thiện chức năng xác thực JWT và bảo vệ route.'
WHERE NOT EXISTS (
  SELECT 1 FROM `tasks`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Làm bài tập lớn Web - Xây dựng RESTful API'
);

INSERT INTO `tasks` (
  `user_id`, `title`, `subject`, `priority`, `status`, `progress`,
  `estimated_hours`, `deadline`, `description`
)
SELECT
  @demo_user_id, 'Thiết kế mô hình quan hệ ERD CSDL',
  'Cơ sở dữ liệu nâng cao', 'urgent', 'todo', 15, 2.00,
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 DAY),
  'Vẽ lược đồ ERD chuẩn hóa 3NF cho đồ án hệ thống quản lý.'
WHERE NOT EXISTS (
  SELECT 1 FROM `tasks`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Thiết kế mô hình quan hệ ERD CSDL'
);

INSERT INTO `tasks` (
  `user_id`, `title`, `subject`, `priority`, `status`, `progress`,
  `estimated_hours`, `deadline`, `description`
)
SELECT
  @demo_user_id, 'Ôn tập thuật toán A* và Cây trò chơi Minimax',
  'Trí tuệ nhân tạo (AI)', 'medium', 'todo', 0, 2.50,
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 4 DAY),
  'Làm lại các bài tập tính toán hàm đánh giá f(n).'
WHERE NOT EXISTS (
  SELECT 1 FROM `tasks`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Ôn tập thuật toán A* và Cây trò chơi Minimax'
);

INSERT INTO `tasks` (
  `user_id`, `title`, `subject`, `priority`, `status`, `progress`,
  `estimated_hours`, `deadline`, `description`
)
SELECT
  @demo_user_id, 'Báo cáo thực hành mã hóa bất đối xứng RSA',
  'An toàn thông tin mạng', 'high', 'done', 100, 2.00,
  DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY),
  'Đã nộp file PDF qua cổng LMS.'
WHERE NOT EXISTS (
  SELECT 1 FROM `tasks`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Báo cáo thực hành mã hóa bất đối xứng RSA'
);

INSERT INTO `tasks` (
  `user_id`, `title`, `subject`, `priority`, `status`, `progress`,
  `estimated_hours`, `deadline`, `description`
)
SELECT
  @demo_user_id, 'Đọc tài liệu React Query & Zustand state management',
  'Tự học', 'low', 'todo', 0, 1.50,
  DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 6 DAY),
  'Tìm hiểu cách cache dữ liệu client không cần Redux.'
WHERE NOT EXISTS (
  SELECT 1 FROM `tasks`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Đọc tài liệu React Query & Zustand state management'
);

INSERT INTO `scheduled_events` (
  `user_id`, `task_id`, `title`, `subject`, `start_at`, `end_at`, `source`, `color`
)
SELECT
  @demo_user_id,
  `tasks`.`id`,
  `tasks`.`title`,
  `tasks`.`subject`,
  DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY),
  DATE_ADD(DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), INTERVAL 2 HOUR),
  'auto',
  '#10b981'
FROM `tasks`
WHERE `tasks`.`user_id` = @demo_user_id
  AND `tasks`.`title` = 'Báo cáo thực hành mã hóa bất đối xứng RSA'
  AND NOT EXISTS (
    SELECT 1 FROM `scheduled_events`
    WHERE `scheduled_events`.`task_id` = `tasks`.`id`
  );

INSERT INTO `notifications` (
  `user_id`, `type`, `title`, `message`, `read_at`
)
SELECT
  @demo_user_id,
  'urgent',
  'Sắp đến hạn!',
  'Công việc "Thiết kế mô hình quan hệ ERD CSDL" hết hạn vào ngày mai.',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM `notifications`
  WHERE `user_id` = @demo_user_id AND `title` = 'Sắp đến hạn!'
);

INSERT INTO `notifications` (
  `user_id`, `type`, `title`, `message`, `read_at`
)
SELECT
  @demo_user_id,
  'info',
  'Nhắc nhở lịch học',
  'Lịch học môn Lập trình Web diễn ra vào 07:30 sáng Thứ Hai tại A2-301.',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM `notifications`
  WHERE `user_id` = @demo_user_id AND `title` = 'Nhắc nhở lịch học'
);

INSERT INTO `notifications` (
  `user_id`, `type`, `title`, `message`, `read_at`
)
SELECT
  @demo_user_id,
  'success',
  'Chúc mừng!',
  'Bạn đã hoàn thành 100% nhiệm vụ Báo cáo thực hành RSA.',
  UTC_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `notifications`
  WHERE `user_id` = @demo_user_id AND `title` = 'Chúc mừng!'
);
