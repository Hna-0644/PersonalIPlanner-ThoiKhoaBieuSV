# PersonalPlanner
## Website quản lý thời khóa biểu và kế hoạch cá nhân tích hợp sắp xếp lịch trình tự động

### 1. Thông tin dự án
Đề tài: Thiết kế và xây dựng website quản lý thời khóa biểu
và kế hoạch cá nhân tích hợp sắp xếp lịch trình tự động.

### 2. Thành viên nhóm
- Dương Văn Thanh - td863166@gmail.com
- Dương Minh Tân - tanduonga9@gmail.com

3. Chức năng dự kiến
3.1. Quản lý tài khoản người dùng
Đăng ký tài khoản.
Đăng nhập và đăng xuất.
Xác thực người dùng bằng JWT.
Quản lý và cập nhật thông tin cá nhân.
Bảo vệ dữ liệu riêng tư của từng người dùng.
3.2. Quản lý thời khóa biểu
Thêm, xem, chỉnh sửa và xóa lịch học.
Hiển thị lịch theo ngày, tuần và tháng.
Quản lý thời gian, địa điểm và thông tin buổi học.
Phát hiện và cảnh báo các lịch trình bị trùng.
3.3. Quản lý kế hoạch và công việc cá nhân
Tạo và chỉnh sửa công việc.
Thiết lập thời hạn hoàn thành.
Phân loại công việc theo mức độ ưu tiên.
Theo dõi trạng thái: chưa thực hiện, đang thực hiện và đã hoàn thành.
Ghi nhận tiến độ và lịch sử hoàn thành công việc.
3.4. Tự động sắp xếp lịch trình
Xác định các khoảng thời gian trống trong lịch cá nhân.
Tránh trùng lặp với thời khóa biểu và các công việc đã được lên lịch.
Ưu tiên công việc dựa trên thời hạn và mức độ quan trọng.
Phân bổ thời gian theo thời lượng dự kiến của từng công việc.
Đề xuất lịch trình phù hợp với các ràng buộc của người dùng.
3.5. Nhắc lịch tự động
Kiểm tra các công việc sắp đến hạn theo lịch định kỳ.
Gửi email nhắc nhở về các lịch trình quan trọng.
Thông báo về công việc quá hạn hoặc sắp đến thời điểm thực hiện.
3.6. Thống kê và tổng quan
Hiển thị các công việc sắp tới.
Thống kê số lượng công việc đã hoàn thành và chưa hoàn thành.
Theo dõi tiến độ thực hiện kế hoạch.
Cung cấp thông tin tổng quan về lịch trình cá nhân.
4. Công nghệ sử dụng
4.1. Frontend – Giao diện người dùng
HTML5: Xây dựng cấu trúc các trang web.
CSS3: Thiết kế giao diện và bố cục website.
JavaScript: Xử lý logic phía client và tương tác với người dùng.
Bootstrap 5: Xây dựng giao diện responsive, tương thích với máy tính, máy tính bảng và điện thoại.
FullCalendar: Hiển thị và tương tác với lịch trình theo ngày, tuần và tháng.
4.2. Backend – Máy chủ và API
Node.js: Môi trường thực thi JavaScript phía máy chủ.
Express.js: Xây dựng RESTful API và xử lý các nghiệp vụ của hệ thống.
jsonwebtoken: Tạo và xác minh JSON Web Token phục vụ xác thực người dùng.
bcrypt: Băm mật khẩu trước khi lưu vào cơ sở dữ liệu.
Middleware: Xác thực token, kiểm tra quyền truy cập và bảo vệ các API cần đăng nhập.
4.3. Cơ sở dữ liệu
MySQL: Hệ quản trị cơ sở dữ liệu quan hệ, lưu trữ thông tin người dùng, thời khóa biểu, công việc, lịch trình và các dữ liệu liên quan.
MySQL Workbench: Hỗ trợ thiết kế, quản lý và truy vấn cơ sở dữ liệu.
4.4. Xác thực và bảo mật
JWT Access Token: Xác thực các yêu cầu đến API, có thời hạn sử dụng ngắn.
Refresh Token: Hỗ trợ cấp mới access token khi hết hạn và được quản lý theo cơ chế có thể thu hồi.
bcrypt: Băm mật khẩu trước khi lưu trữ.
Environment Variables: Quản lý khóa bí mật JWT, thông tin kết nối database và cấu hình nhạy cảm.
HTTPS: Bảo vệ dữ liệu truyền tải giữa client và server khi triển khai thực tế.
Các API cần đăng nhập phải xác minh token và kiểm tra quyền truy cập dữ liệu của người dùng. Refresh token cần được quản lý an toàn; không lưu mật khẩu hoặc dữ liệu bí mật trong payload JWT.

4.5. Nhắc lịch và gửi thông báo
node-cron: Thực hiện các tác vụ định kỳ để kiểm tra lịch trình và công việc sắp đến hạn.
Nodemailer: Gửi email nhắc nhở và thông báo cho người dùng.
4.6. Kiểm thử
Jest: Kiểm thử các hàm xử lý nghiệp vụ và các thành phần JavaScript.
Supertest: Kiểm thử RESTful API, bao gồm xác thực, quản lý công việc và quản lý thời khóa biểu.
Postman: Gửi yêu cầu HTTP để kiểm tra API trong quá trình phát triển.
4.7. Quản lý mã nguồn và làm việc nhóm
Git: Theo dõi lịch sử thay đổi và quản lý các phiên bản mã nguồn.
GitHub: Lưu trữ repository, quản lý nhánh phát triển, theo dõi lỗi và phối hợp làm việc nhóm.
4.8. Môi trường phát triển và triển khai
Visual Studio Code: Trình soạn thảo mã nguồn.
Node.js và npm: Chạy backend và quản lý thư viện phụ thuộc.
Render hoặc VPS: Triển khai ứng dụng để truy cập qua Internet.
File .env: Lưu cấu hình môi trường; không đưa thông tin bí mật lên GitHub.
4.9. Thuật toán sắp xếp lịch trình
Thuật toán được xây dựng bằng JavaScript và Node.js, dựa trên các tiêu chí:

Tìm khoảng thời gian trống phù hợp.
Đảm bảo không xung đột với các sự kiện đã được lên lịch.
Ưu tiên công việc gần hạn và có mức độ quan trọng cao.
Phân bổ thời lượng thực hiện hợp lý.
Đề xuất lịch trình đáp ứng các ràng buộc thời gian của người dùng.
Trong phiên bản đầu tiên, hệ thống ưu tiên xây dựng thuật toán sắp xếp theo các quy tắc xác định trước. Các thuật toán tối ưu hóa nâng cao có thể được bổ sung trong những giai đoạn tiếp theo.

5. Cấu trúc thư mục dự án

text
PersonalPlanner/
├── frontend/
│   ├── index.html
│   ├── pages/
│   ├── css/
│   ├── js/
│   └── assets/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── app.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── requirements.md
│   ├── database-design.md
│   └── api-documentation.md
├── tests/
├── .gitignore
└── README.md
Mô tả các thư mục chính:

frontend/: Chứa giao diện website, CSS, JavaScript và tài nguyên.
backend/src/config/: Chứa cấu hình database và các dịch vụ.
backend/src/controllers/: Tiếp nhận yêu cầu và điều phối xử lý nghiệp vụ.
backend/src/middleware/: Chứa middleware xác thực JWT, phân quyền và xử lý lỗi.
backend/src/models/: Xử lý truy vấn và dữ liệu.
backend/src/routes/: Khai báo các RESTful API.
backend/src/services/: Chứa logic nghiệp vụ, bao gồm thuật toán sắp xếp lịch.
backend/tests/: Kiểm thử các thành phần backend.
docs/: Lưu tài liệu phân tích, thiết kế và hướng dẫn API.
tests/: Lưu các kịch bản kiểm thử tổng thể.
6. Yêu cầu môi trường
Để phát triển dự án, cần chuẩn bị:

Node.js phiên bản LTS.
npm đi kèm Node.js.
MySQL Server.
MySQL Workbench.
Visual Studio Code hoặc trình soạn thảo tương đương.
Git.
Postman để kiểm thử API.

### 10. Trạng thái
Dự án đang trong giai đoạn khởi tạo.
