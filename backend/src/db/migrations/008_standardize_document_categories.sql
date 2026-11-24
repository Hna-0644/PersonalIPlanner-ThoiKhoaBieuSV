ALTER TABLE study_documents
  MODIFY COLUMN category ENUM(
    'notes', 'slides', 'exam', 'assignment', 'summary', 'other',
    'lecture_notes', 'summaries', 'assignments', 'past_exams'
  ) NOT NULL;

UPDATE study_documents
SET category = CASE category
  WHEN 'notes' THEN 'lecture_notes'
  WHEN 'slides' THEN 'lecture_notes'
  WHEN 'summary' THEN 'summaries'
  WHEN 'assignment' THEN 'assignments'
  WHEN 'exam' THEN 'past_exams'
  ELSE category
END;

ALTER TABLE study_documents
  MODIFY COLUMN category ENUM('lecture_notes', 'summaries', 'assignments', 'past_exams', 'other') NOT NULL;
