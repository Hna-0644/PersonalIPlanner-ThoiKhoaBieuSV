CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_code VARCHAR(50) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  school_code VARCHAR(50) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_course_code (course_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE classes
  ADD COLUMN subject_id BIGINT UNSIGNED NULL AFTER code,
  ADD KEY ix_classes_subject_id (subject_id),
  ADD CONSTRAINT fk_classes_subject
    FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS class_sections (
  class_code VARCHAR(50) NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (class_code),
  UNIQUE KEY uq_class_sections_code_subject (class_code, subject_id),
  CONSTRAINT fk_class_sections_subject
    FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS course_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  lecturer_name VARCHAR(150) NULL,
  rating TINYINT UNSIGNED NOT NULL,
  difficulty TINYINT UNSIGNED NOT NULL,
  attendance_required BOOLEAN NOT NULL,
  grading_notes TEXT NULL,
  materials_notes TEXT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_reviews_user_subject (user_id, subject_id),
  KEY ix_course_reviews_subject_created (subject_id, created_at DESC),
  CONSTRAINT fk_course_reviews_subject
    FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_course_reviews_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_course_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_course_reviews_difficulty CHECK (difficulty BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS class_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NOT NULL,
  class_code VARCHAR(50) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  upvote_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_class_posts_subject_section_created (subject_id, class_code, created_at DESC),
  KEY ix_class_posts_section_created (class_code, created_at DESC),
  CONSTRAINT fk_class_posts_subject
    FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_class_posts_section
    FOREIGN KEY (class_code, subject_id)
    REFERENCES class_sections (class_code, subject_id) ON DELETE CASCADE,
  CONSTRAINT fk_class_posts_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS post_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  upvote_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_post_comments_post_created (post_id, created_at ASC),
  CONSTRAINT fk_post_comments_post
    FOREIGN KEY (post_id) REFERENCES class_posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS post_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_post_votes_user_post (user_id, post_id),
  CONSTRAINT fk_post_votes_post
    FOREIGN KEY (post_id) REFERENCES class_posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_votes_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS comment_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_comment_votes_user_comment (user_id, comment_id),
  CONSTRAINT fk_comment_votes_comment
    FOREIGN KEY (comment_id) REFERENCES post_comments (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_votes_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
