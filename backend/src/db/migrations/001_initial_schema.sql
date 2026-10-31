CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  student_id VARCHAR(50) NULL,
  major VARCHAR(500) NULL,
  university VARCHAR(500) NULL,
  avatar VARCHAR(2048) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS study_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  preferred_hours JSON NOT NULL,
  break_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  email_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  browser_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_study_preferences_user (user_id),
  CONSTRAINT fk_study_preferences_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  code VARCHAR(500) NULL,
  room VARCHAR(500) NULL,
  lecturer VARCHAR(500) NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  semester_start DATE NULL,
  semester_end DATE NULL,
  color CHAR(7) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_classes_user_weekday (user_id, day_of_week),
  CONSTRAINT fk_classes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_classes_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_classes_time_order CHECK (start_time < end_time),
  CONSTRAINT chk_classes_semester_order CHECK (semester_start IS NULL OR semester_end IS NULL OR semester_start <= semester_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  subject VARCHAR(500) NULL,
  description TEXT NULL,
  priority ENUM('urgent', 'high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  status ENUM('todo', 'inprogress', 'done') NOT NULL DEFAULT 'todo',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  estimated_hours DECIMAL(7,2) NULL,
  deadline DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_tasks_user_status_deadline (user_id, status, deadline),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_tasks_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT chk_tasks_estimated_hours CHECK (estimated_hours IS NULL OR estimated_hours > 0),
  CONSTRAINT chk_tasks_done_progress CHECK (status <> 'done' OR progress = 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS scheduled_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  subject VARCHAR(500) NULL,
  start_at DATETIME(3) NOT NULL,
  end_at DATETIME(3) NOT NULL,
  source ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
  color CHAR(7) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_scheduled_events_user_time (user_id, start_at, end_at),
  UNIQUE KEY uq_scheduled_events_task (task_id),
  CONSTRAINT fk_scheduled_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_scheduled_events_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
  CONSTRAINT chk_scheduled_events_time_order CHECK (start_at < end_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('urgent', 'info', 'success') NOT NULL DEFAULT 'info',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  read_at DATETIME(3) NULL,
  scheduled_at DATETIME(3) NULL,
  delivery_status VARCHAR(30) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_notifications_user_created (user_id, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
