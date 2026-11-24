CREATE TABLE IF NOT EXISTS study_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  subject_name VARCHAR(150) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category ENUM('notes', 'slides', 'exam', 'assignment', 'summary', 'other') NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(80) NOT NULL,
  mime_type VARCHAR(127) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_study_documents_storage_name (storage_name),
  KEY ix_study_documents_subject_created (subject_code, created_at DESC),
  KEY ix_study_documents_category_created (category, created_at DESC),
  CONSTRAINT fk_study_documents_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_study_documents_title_len CHECK (CHAR_LENGTH(title) >= 3),
  CONSTRAINT chk_study_documents_subject_code_not_empty CHECK (CHAR_LENGTH(TRIM(subject_code)) > 0),
  CONSTRAINT chk_study_documents_subject_name_not_empty CHECK (CHAR_LENGTH(TRIM(subject_name)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
