-- Tối ưu hóa Composite Indexes để tránh Full Table Scan khi Cache Miss
CREATE INDEX idx_classes_user_day_time ON classes (user_id, day_of_week, start_time);

CREATE INDEX idx_tasks_user_deadline ON tasks (user_id, deadline);

CREATE INDEX idx_tasks_user_status_priority ON tasks (user_id, status, priority);

CREATE INDEX idx_notifications_user_read ON notifications (user_id, read_at, created_at);

