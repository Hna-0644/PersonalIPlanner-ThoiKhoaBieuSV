-- PersonalPlanner demo data for the schema in src/db/migrations/.
-- Demo login: demo@personalplanner.local / 12345678
-- Re-running this script does not add duplicate sample records.

USE `personal_planner`;

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

-- Subjects (005_add_course_reviews_and_qa.sql)
INSERT INTO `subjects` (`course_code`, `subject_name`, `school_code`)
VALUES ('IT3020', 'Lập trình Web (Node.js & React)', 'VNU-UET')
ON DUPLICATE KEY UPDATE `subject_name` = VALUES(`subject_name`), `school_code` = VALUES(`school_code`);

INSERT INTO `subjects` (`course_code`, `subject_name`, `school_code`)
VALUES ('IT3040', 'Cơ sở dữ liệu nâng cao', 'VNU-UET')
ON DUPLICATE KEY UPDATE `subject_name` = VALUES(`subject_name`), `school_code` = VALUES(`school_code`);

INSERT INTO `subjects` (`course_code`, `subject_name`, `school_code`)
VALUES ('IT4010', 'Trí tuệ nhân tạo (AI)', 'VNU-UET')
ON DUPLICATE KEY UPDATE `subject_name` = VALUES(`subject_name`), `school_code` = VALUES(`school_code`);

INSERT INTO `subjects` (`course_code`, `subject_name`, `school_code`)
VALUES ('IT4080', 'An toàn thông tin mạng', 'VNU-UET')
ON DUPLICATE KEY UPDATE `subject_name` = VALUES(`subject_name`), `school_code` = VALUES(`school_code`);

SET @sub_it3020 := (SELECT `id` FROM `subjects` WHERE `course_code` = 'IT3020');
SET @sub_it3040 := (SELECT `id` FROM `subjects` WHERE `course_code` = 'IT3040');
SET @sub_it4010 := (SELECT `id` FROM `subjects` WHERE `course_code` = 'IT4010');
SET @sub_it4080 := (SELECT `id` FROM `subjects` WHERE `course_code` = 'IT4080');

-- Class Sections
INSERT INTO `class_sections` (`class_code`, `subject_id`)
VALUES ('IT3020', @sub_it3020)
ON DUPLICATE KEY UPDATE `subject_id` = VALUES(`subject_id`);

INSERT INTO `class_sections` (`class_code`, `subject_id`)
VALUES ('IT3040', @sub_it3040)
ON DUPLICATE KEY UPDATE `subject_id` = VALUES(`subject_id`);

INSERT INTO `class_sections` (`class_code`, `subject_id`)
VALUES ('IT4010', @sub_it4010)
ON DUPLICATE KEY UPDATE `subject_id` = VALUES(`subject_id`);

INSERT INTO `class_sections` (`class_code`, `subject_id`)
VALUES ('IT4080', @sub_it4080)
ON DUPLICATE KEY UPDATE `subject_id` = VALUES(`subject_id`);

-- Classes
INSERT INTO `classes` (
  `user_id`, `title`, `code`, `subject_id`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Lập trình Web (Node.js & React)', 'IT3020', @sub_it3020, 'A2-301',
  'ThS. Nguyễn Văn A', 1, '07:30:00', '10:00:00', '#4f46e5',
  'Mang theo laptop cài sẵn Node.js v20'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT3020'
);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `subject_id`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Cơ sở dữ liệu nâng cao', 'IT3040', @sub_it3040, 'B1-204',
  'TS. Trần Thị B', 3, '13:30:00', '16:00:00', '#06b6d4',
  'Thực hành MySQL bài lab 3'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT3040'
);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `subject_id`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Trí tuệ nhân tạo (AI)', 'IT4010', @sub_it4010, 'C3-501',
  'PGS. TS. Lê Văn C', 5, '08:00:00', '11:00:00', '#8b5cf6',
  'Thảo luận chuyên đề Tìm kiếm A* và Heuristic'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT4010'
);

INSERT INTO `classes` (
  `user_id`, `title`, `code`, `subject_id`, `room`, `lecturer`, `day_of_week`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'An toàn thông tin mạng', 'IT4080', @sub_it4080, 'MS Teams Online',
  'TS. Phạm Văn D', 6, '09:00:00', '11:30:00', '#10b981',
  'Kiểm tra trắc nghiệm 15 phút đầu giờ'
WHERE NOT EXISTS (
  SELECT 1 FROM `classes` WHERE `user_id` = @demo_user_id AND `code` = 'IT4080'
);

-- Work Schedules (003_work_schedules.sql)
INSERT INTO `work_schedules` (
  `user_id`, `title`, `workplace`, `day_of_week`, `work_date`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Ca làm thêm Quán Cafe', 'Highlands Coffee Xuân Thủy', 2, NULL,
  '18:00:00', '22:00:00', '#0d7480', 'Ca tối Thứ Ba hàng tuần'
WHERE NOT EXISTS (
  SELECT 1 FROM `work_schedules`
  WHERE `user_id` = @demo_user_id AND `title` = 'Ca làm thêm Quán Cafe'
);

INSERT INTO `work_schedules` (
  `user_id`, `title`, `workplace`, `day_of_week`, `work_date`,
  `start_time`, `end_time`, `color`, `notes`
)
SELECT
  @demo_user_id, 'Trợ giảng Lab CNTT', 'Phòng Lab 302 - Nhà E3', 4, NULL,
  '14:00:00', '17:00:00', '#0284c7', 'Hỗ trợ sinh viên khóa dưới thực hành Web & SQL'
WHERE NOT EXISTS (
  SELECT 1 FROM `work_schedules`
  WHERE `user_id` = @demo_user_id AND `title` = 'Trợ giảng Lab CNTT'
);

-- Tasks
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

-- Course Reviews (005_add_course_reviews_and_qa.sql)
INSERT INTO `course_reviews` (
  `subject_id`, `user_id`, `lecturer_name`, `rating`, `difficulty`,
  `attendance_required`, `grading_notes`, `materials_notes`, `content`
)
VALUES (
  @sub_it3020,
  @demo_user_id,
  'ThS. Nguyễn Văn A',
  5,
  3,
  TRUE,
  'Điểm chuyên cần 10%, Bài tập lớn 40%, Thi cuối kỳ 50%.',
  'Slide bài giảng trên Canvas + Repo mẫu Node.js/Express trên GitHub.',
  'Môn học rất thực tế, giảng viên hướng dẫn tận tình cách thiết kế RESTful API và bảo mật JWT.'
)
ON DUPLICATE KEY UPDATE
  `rating` = VALUES(`rating`),
  `difficulty` = VALUES(`difficulty`),
  `content` = VALUES(`content`);

INSERT INTO `course_reviews` (
  `subject_id`, `user_id`, `lecturer_name`, `rating`, `difficulty`,
  `attendance_required`, `grading_notes`, `materials_notes`, `content`
)
VALUES (
  @sub_it3040,
  @demo_user_id,
  'TS. Trần Thị B',
  4,
  4,
  TRUE,
  'Kiểm tra thực hành Lab 30%, Đồ án tối ưu truy vấn 30%, Thi viết 40%.',
  'Sách Database System Concepts (Silberschatz) và tài liệu MySQL 8.0 InnoDB.',
  'Kiến thức chuyên sâu về đánh chỉ mục B+Tree, Transaction Isolation và tối ưu câu lệnh SQL phức tạp.'
)
ON DUPLICATE KEY UPDATE
  `rating` = VALUES(`rating`),
  `difficulty` = VALUES(`difficulty`),
  `content` = VALUES(`content`);

-- Class Posts & Comments (Q&A)
INSERT INTO `class_posts` (
  `subject_id`, `class_code`, `user_id`, `title`, `content`, `upvote_count`
)
SELECT
  @sub_it3020, 'IT3020', @demo_user_id,
  'Cách xử lý làm mới Access Token tự động khi gọi API?',
  'Mọi người cho mình hỏi trong bài tập lớn phần xác thực JWT, nên xử lý refresh token ở interceptor hay middleware thế nào để tránh lặp vô hạn khi token hết hạn?',
  3
WHERE NOT EXISTS (
  SELECT 1 FROM `class_posts`
  WHERE `subject_id` = @sub_it3020
    AND `user_id` = @demo_user_id
    AND `title` = 'Cách xử lý làm mới Access Token tự động khi gọi API?'
);

INSERT INTO `class_posts` (
  `subject_id`, `class_code`, `user_id`, `title`, `content`, `upvote_count`
)
SELECT
  @sub_it3040, 'IT3040', @demo_user_id,
  'Kinh nghiệm thiết kế Composite Index cho bài Lab 3',
  'Khi truy vấn kết hợp WHERE status = ? AND subject_tag = ? ORDER BY created_at DESC thì thứ tự cột trong Composite Index nên đặt thế nào để tránh Using filesort?',
  5
WHERE NOT EXISTS (
  SELECT 1 FROM `class_posts`
  WHERE `subject_id` = @sub_it3040
    AND `user_id` = @demo_user_id
    AND `title` = 'Kinh nghiệm thiết kế Composite Index cho bài Lab 3'
);

SET @post_it3020 := (
  SELECT `id` FROM `class_posts`
  WHERE `subject_id` = @sub_it3020
    AND `title` = 'Cách xử lý làm mới Access Token tự động khi gọi API?'
  LIMIT 1
);

SET @post_it3040 := (
  SELECT `id` FROM `class_posts`
  WHERE `subject_id` = @sub_it3040
    AND `title` = 'Kinh nghiệm thiết kế Composite Index cho bài Lab 3'
  LIMIT 1
);

INSERT INTO `post_comments` (
  `post_id`, `user_id`, `content`, `upvote_count`
)
SELECT
  @post_it3020, @demo_user_id,
  'Mình đã giải quyết được bằng cách dùng cờ _retry trên request config và hàng đợi Promise cho các request đồng thời!',
  2
WHERE @post_it3020 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `post_comments`
    WHERE `post_id` = @post_it3020
      AND `user_id` = @demo_user_id
  );

INSERT INTO `post_comments` (
  `post_id`, `user_id`, `content`, `upvote_count`
)
SELECT
  @post_it3040, @demo_user_id,
  'Đặt các cột lọc bằng (=) trước rồi đến cột ORDER BY: INDEX (status, subject_tag, created_at DESC) giúp EXPLAIN đạt chuẩn index scan.',
  4
WHERE @post_it3040 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `post_comments`
    WHERE `post_id` = @post_it3040
      AND `user_id` = @demo_user_id
  );

-- Marketplace Items (004_add_marketplace_items.sql)
INSERT INTO `marketplace_items` (
  `user_id`, `subject_id`, `subject_tag`, `title`, `description`,
  `category`, `price`, `contact_info`, `status`
)
SELECT
  @demo_user_id, @sub_it3040, 'IT3040',
  'Giáo trình Database System Concepts (7th Edition)',
  'Sách in màu bìa cứng còn mới 95%, có đánh dấu highlight các chương Indexing, B+Tree và Transaction.',
  'textbook', 120000, 'Zalo: 0912345678 (Minh An)', 'available'
WHERE NOT EXISTS (
  SELECT 1 FROM `marketplace_items`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Giáo trình Database System Concepts (7th Edition)'
);

INSERT INTO `marketplace_items` (
  `user_id`, `subject_id`, `subject_tag`, `title`, `description`,
  `category`, `price`, `contact_info`, `status`
)
SELECT
  @demo_user_id, @sub_it3020, 'IT3020',
  'Bộ Slide & Sổ tay tổng hợp RESTful API + JWT Security',
  'Tặng miễn phí bộ ghi chú chi tiết các mẫu thiết kế kiến trúc Node.js, Express và checklist bảo mật OWASP.',
  'notes', 0, 'Email: demo@personalplanner.local', 'available'
WHERE NOT EXISTS (
  SELECT 1 FROM `marketplace_items`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Bộ Slide & Sổ tay tổng hợp RESTful API + JWT Security'
);

INSERT INTO `marketplace_items` (
  `user_id`, `subject_id`, `subject_tag`, `title`, `description`,
  `category`, `price`, `contact_info`, `status`
)
SELECT
  @demo_user_id, @sub_it4010, 'IT4010',
  'Máy tính khoa học Casio fx-580VN X hỗ trợ tính ma trận',
  'Máy chính hãng còn bảo hành, dùng rất tốt cho môn Trí tuệ nhân tạo và Đại số tuyến tính.',
  'supplies', 350000, 'Zalo: 0912345678 (Minh An)', 'available'
WHERE NOT EXISTS (
  SELECT 1 FROM `marketplace_items`
  WHERE `user_id` = @demo_user_id
    AND `title` = 'Máy tính khoa học Casio fx-580VN X hỗ trợ tính ma trận'
);

-- Notifications
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
