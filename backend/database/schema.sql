-- =====================================================================
-- PersonalPlanner - MySQL Database Schema
-- Phiên bản: 1.1 (Đã tối ưu Composite Indexes & chuẩn hóa preferred_hours)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `personal_planner`
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `personal_planner`;

-- Tắt kiểm tra khóa ngoại tạm thời để khởi tạo/reset an toàn
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `scheduled_events`;
DROP TABLE IF EXISTS `tasks`;
DROP TABLE IF EXISTS `classes`;
DROP TABLE IF EXISTS `study_preferences`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. BẢNG USERS (Người dùng)
-- =====================================================================
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `student_id` VARCHAR(50) DEFAULT NULL,
  `student_year` TINYINT UNSIGNED DEFAULT NULL,
  `major` VARCHAR(500) DEFAULT NULL,
  `university` VARCHAR(500) DEFAULT NULL,
  `avatar` VARCHAR(2048) DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. BẢNG STUDY_PREFERENCES (Khung giờ rảnh & Cài đặt lập lịch AI)
-- =====================================================================
CREATE TABLE `study_preferences` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `preferred_hours` JSON NOT NULL COMMENT 'Cấu hình JSON: morning, afternoon, evening kèm active, start, end',
  `break_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  `email_reminder` BOOLEAN NOT NULL DEFAULT TRUE,
  `browser_reminder` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_study_pref_user` (`user_id`),
  CONSTRAINT `fk_study_pref_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_study_pref_break` CHECK (`break_minutes` BETWEEN 0 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. BẢNG CLASSES (Thời khóa biểu / Buổi học định kỳ)
-- =====================================================================
CREATE TABLE `classes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `code` VARCHAR(500) DEFAULT NULL,
  `room` VARCHAR(500) DEFAULT NULL,
  `lecturer` VARCHAR(500) DEFAULT NULL,
  `day_of_week` TINYINT UNSIGNED NOT NULL COMMENT '0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy',
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `semester_start` DATE DEFAULT NULL,
  `semester_end` DATE DEFAULT NULL,
  `color` VARCHAR(20) DEFAULT '#4f46e5',
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_classes_user_day_time` (`user_id`, `day_of_week`, `start_time`),
  CONSTRAINT `fk_classes_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_classes_day_of_week` CHECK (`day_of_week` BETWEEN 0 AND 6),
  CONSTRAINT `chk_classes_time_order` CHECK (`start_time` < `end_time`),
  CONSTRAINT `chk_classes_semester_order` CHECK (`semester_start` IS NULL OR `semester_end` IS NULL OR `semester_start` <= `semester_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4. BẢNG TASKS (Kế hoạch & Công việc cá nhân)
-- =====================================================================
CREATE TABLE `tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `subject` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `priority` ENUM('urgent', 'high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  `status` ENUM('todo', 'inprogress', 'done') NOT NULL DEFAULT 'todo',
  `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 đến 100',
  `estimated_hours` DECIMAL(7, 2) DEFAULT 1.50,
  `deadline` DATETIME(3) DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_tasks_user_status_deadline` (`user_id`, `status`, `deadline`),
  INDEX `idx_tasks_user_status_priority` (`user_id`, `status`, `priority`),
  INDEX `idx_tasks_user_deadline` (`user_id`, `deadline`),
  CONSTRAINT `fk_tasks_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_tasks_progress` CHECK (`progress` BETWEEN 0 AND 100),
  CONSTRAINT `chk_tasks_estimated_hours` CHECK (`estimated_hours` IS NULL OR `estimated_hours` > 0),
  CONSTRAINT `chk_tasks_done_progress` CHECK (`status` <> 'done' OR `progress` = 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5. BẢNG SCHEDULED_EVENTS (Sự kiện đã xác nhận trên lịch)
-- =====================================================================
CREATE TABLE `scheduled_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `task_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `subject` VARCHAR(500) DEFAULT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `source` ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
  `color` VARCHAR(20) DEFAULT '#8b5cf6',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_events_user_time` (`user_id`, `start_at`, `end_at`),
  UNIQUE KEY `uq_events_task` (`task_id`),
  CONSTRAINT `fk_events_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_events_task` FOREIGN KEY (`task_id`) 
    REFERENCES `tasks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_events_time_order` CHECK (`start_at` < `end_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6. BẢNG NOTIFICATIONS (Thông báo nhắc lịch)
-- =====================================================================
CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('urgent', 'info', 'success') NOT NULL DEFAULT 'info',
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `read_at` DATETIME(3) DEFAULT NULL,
  `scheduled_at` DATETIME(3) DEFAULT NULL,
  `delivery_status` VARCHAR(30) DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_notif_user_created` (`user_id`, `created_at`),
  INDEX `idx_notifications_user_read` (`user_id`, `read_at`, `created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 7. BẢNG REFRESH_TOKENS (Quản lý phiên đăng nhập JWT an toàn)
-- =====================================================================
CREATE TABLE `refresh_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_token` (`token`),
  INDEX `idx_refresh_lookup` (`token`, `revoked`),
  INDEX `idx_refresh_user` (`user_id`, `expires_at`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 8. BẢNG WORK_SCHEDULES (Lịch làm việc / ca làm bán thời gian)
-- =====================================================================
CREATE TABLE `work_schedules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `workplace` VARCHAR(500) DEFAULT NULL,
  `day_of_week` TINYINT UNSIGNED DEFAULT NULL,
  `work_date` DATE DEFAULT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `color` VARCHAR(20) DEFAULT '#0d7480',
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_work_schedules_user_day` (`user_id`, `day_of_week`, `start_time`),
  KEY `ix_work_schedules_user_date` (`user_id`, `work_date`, `start_time`),
  CONSTRAINT `fk_work_schedules_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_work_schedules_day_or_date` CHECK (`day_of_week` IS NOT NULL OR `work_date` IS NOT NULL),
  CONSTRAINT `chk_work_schedules_day_of_week` CHECK (`day_of_week` IS NULL OR `day_of_week` BETWEEN 0 AND 6),
  CONSTRAINT `chk_work_schedules_time_order` CHECK (`start_time` < `end_time`),
  CONSTRAINT `chk_work_schedules_date_order` CHECK (`start_date` IS NULL OR `end_date` IS NULL OR `start_date` <= `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
