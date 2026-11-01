# Thiết kế: Củng cố quyền sở hữu dữ liệu người dùng

## Mục tiêu

Đảm bảo người dùng chỉ đọc, thay đổi hoặc xóa dữ liệu thuộc tài khoản của mình. Backend hiện xác thực bằng JWT và các service đã lọc theo `user_id`; thay đổi tập trung vào kiểm chứng các ranh giới này và sửa thiếu sót nếu có.

## Phạm vi

- Kiểm tra API hồ sơ, lớp, bài tập, lịch, thông báo và AI: yêu cầu xác thực; danh tính người dùng lấy từ token.
- Bổ sung kiểm thử hồi quy cho truy cập chéo tài khoản qua ID tài nguyên, bao gồm thao tác cập nhật/xóa và áp dụng lịch có task ID của tài khoản khác.
- Nếu kiểm thử phát hiện thiếu bảo vệ, thêm điều kiện sở hữu vào truy vấn liên quan; phản hồi không tiết lộ tài nguyên của tài khoản khác.

## Ngoài phạm vi

- Không thêm vai trò quản trị hoặc thay đổi mô hình phân quyền.
- Không triển khai mã hóa dữ liệu lưu trữ, thay đổi chính sách gửi ảnh tới Gemini, hay thay đổi hạ tầng TLS.
- Không thay đổi API hay hành vi hợp lệ của người dùng sở hữu tài nguyên.

## Ràng buộc và tiêu chí

- Duy trì JWT hiện có; không tin `user_id` do request cung cấp.
- Tiếp tục áp dụng điều kiện `user_id` trực tiếp trong các thao tác dữ liệu; không thay bằng kiểm tra middleware đơn lẻ.
- Người dùng khác không được đọc hoặc sửa tài nguyên; truy cập bằng ID không thuộc quyền sở hữu trả về `404` hiện có hoặc phản hồi tương đương không tiết lộ sự tồn tại.
- Kiểm thử phải xác nhận các thao tác bị từ chối không làm thay đổi dữ liệu.

## Các hướng đã cân nhắc

1. **Giữ kiểm tra quyền sở hữu trong service và thêm kiểm thử hồi quy** — được chọn; phù hợp với kiến trúc hiện tại, ít thay đổi và kiểm chứng trực tiếp các API/tài nguyên.
2. **Thêm lớp phân quyền trung tâm** — không chọn; phải tra cứu tài nguyên riêng, có nguy cơ tạo kiểm tra trùng lặp và không thay thế điều kiện sở hữu ở truy vấn ghi.

## Cách triển khai

Trước tiên kiểm tra các route và service hiện có, sau đó thêm các kiểm thử tập trung theo mẫu test hiện hành của backend. Chỉ sửa mã chạy khi có lỗ hổng cụ thể; chạy bộ test backend để xác minh quyền sở hữu và không hồi quy các chức năng hiện tại.
