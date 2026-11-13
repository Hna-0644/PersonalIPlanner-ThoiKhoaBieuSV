# Thiết kế cache cho API thời khóa biểu

- **Mục tiêu:** Giảm truy vấn MySQL cho `GET /api/schedule/events` và tránh phục vụ lịch cũ sau khi áp dụng lịch.
- **Phạm vi:** Cache-Aside theo từng user trong `schedule-service`, key có namespace và generation riêng, TTL 3600 giây. Khi cache miss hoặc Redis lỗi, đọc MySQL; nếu Redis chưa sẵn sàng thì bỏ qua Redis, còn lỗi thao tác cache được ghi log. Sau khi `POST /api/schedule/apply` commit, tăng generation và xóa cache key generation cũ để GET đang chạy không thể làm cache cũ hoạt động lại. Hiện không có route PUT/DELETE cho sự kiện lịch để nối invalidation.
- **Ràng buộc:** Dùng Redis dependency, Docker Compose và `backend/src/config/redis.js` hiện có; truyền Redis client qua dependency injection, quản lý kết nối trong vòng đời server và tắt offline command queue để yêu cầu Redis thất bại nhanh khi reconnecting. Không thay đổi các sửa đổi sẵn có ở `backend/package.json` và `backend/package-lock.json`.
- **Phương án:** (1) Cache trong service với Redis được inject — được chọn vì giữ logic gần truy vấn và có thể kiểm thử độc lập. (2) Cache trong router — không chọn vì trộn cache với HTTP và có thể bị bỏ qua khi service được gọi nơi khác.
- **Ngoài phạm vi:** Thêm thao tác PUT/DELETE, cache các endpoint tạo đề xuất lịch, hoặc thay đổi hình dạng response hiện tại.
- **Phần còn lại cho triển khai:** Thêm test cho hit, miss/TTL, fallback Redis lỗi và invalidation sau commit; chạy bộ test backend hiện có.
