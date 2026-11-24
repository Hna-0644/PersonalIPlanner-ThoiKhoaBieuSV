ALTER TABLE study_documents
  ADD COLUMN university VARCHAR(500) NULL AFTER user_id,
  ADD COLUMN academic_year VARCHAR(9) NULL AFTER university,
  ADD COLUMN source_url VARCHAR(2048) NULL AFTER file_size,
  MODIFY COLUMN original_name VARCHAR(255) NULL,
  MODIFY COLUMN storage_name VARCHAR(80) NULL,
  MODIFY COLUMN mime_type VARCHAR(127) NULL,
  MODIFY COLUMN file_size INT UNSIGNED NULL,
  ADD KEY ix_study_documents_university_year (university, academic_year);

ALTER TABLE study_documents
  ADD CONSTRAINT chk_study_documents_single_source
    CHECK ((storage_name IS NULL) <> (source_url IS NULL));
