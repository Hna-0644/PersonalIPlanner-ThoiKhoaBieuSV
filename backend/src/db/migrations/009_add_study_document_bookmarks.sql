CREATE TABLE IF NOT EXISTS study_document_bookmarks (
  user_id BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, document_id),
  KEY ix_study_document_bookmarks_document (document_id),
  CONSTRAINT fk_study_document_bookmarks_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_study_document_bookmarks_document
    FOREIGN KEY (document_id) REFERENCES study_documents (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
