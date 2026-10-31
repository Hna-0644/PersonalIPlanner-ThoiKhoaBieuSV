# PersonalPlanner — Ý tưởng sản phẩm và kế hoạch phát triển

## 1. Tầm nhìn

**PersonalPlanner là trợ lý lập kế hoạch học tập dành cho sinh viên:** kết hợp thời khóa biểu cố định với công việc có hạn hoàn thành, giúp người dùng biết cần làm gì tiếp theo và có thể dành thời gian nào để thực hiện.

Thay vì chỉ hiển thị danh sách việc, sản phẩm hỗ trợ đi từ **nhập lịch và công việc → xem mức độ ưu tiên → nhận đề xuất thời gian → duyệt kế hoạch → theo dõi tiến độ**.

### Đối tượng và nhu cầu

- **Người dùng chính:** sinh viên có lịch học theo tuần, nhiều bài tập/dự án và hạn nộp khác nhau.
- **Vấn đề:** lịch học và deadline nằm rải rác; khó nhận biết xung đột; thường để việc quan trọng đến sát hạn.
- **Giá trị:** một lịch tổng hợp dễ xem, việc cần làm được xếp theo mức độ cấp thiết và kế hoạch được đề xuất trong các khoảng trống do người dùng thiết lập.

## 2. Nguyên tắc sản phẩm

1. **Rõ ràng và có thể kiểm soát:** lịch tự động chỉ là đề xuất; người dùng xem trước và xác nhận trước khi áp dụng.
2. **Không tạo xung đột:** tránh giờ học cố định và những khung giờ đã được xếp.
3. **Ưu tiên có giải thích:** dựa trên độ ưu tiên, deadline, thời lượng ước tính và giờ rảnh; cho biết công việc nào chưa xếp được.
4. **Tập trung vào hành động kế tiếp:** dashboard đưa việc sắp đến hạn và lịch trong ngày lên trước.
5. **Phát triển theo giai đoạn:** hoàn thiện trải nghiệm frontend trước, sau đó mới thay nguồn dữ liệu mẫu bằng backend thật.

## 3. Hiện trạng và định hướng

README xác định mục tiêu dài hạn gồm tài khoản, thời khóa biểu, công việc, sắp lịch tự động, nhắc lịch và thống kê; công nghệ dự kiến là HTML/CSS/JavaScript, Bootstrap, FullCalendar, Express, MySQL và JWT.

Frontend hiện đã có:

- Trang tổng quan, thời khóa biểu, công việc, tự động xếp lịch, thống kê, hồ sơ và đăng nhập/đăng ký.
- [`frontend/js/store.js`](../frontend/js/store.js) lưu dữ liệu mẫu trong localStorage, cung cấp thao tác cơ bản cho hồ sơ/lớp học/công việc/thông báo và tạo lịch đề xuất.
- [`frontend/js/api.js`](../frontend/js/api.js) có các hàm dự kiến cho REST API nhưng đang bật `USE_MOCK`.
- Lịch học có cảnh báo trùng; trang công việc hỗ trợ dạng danh sách/kanban, lọc và trạng thái; trang hồ sơ có cấu hình giờ học ưu tiên.

README là [tài liệu định hướng](../README.md); backend và schema MySQL chưa được triển khai tại thời điểm lập kế hoạch. Các thành phần đó trong roadmap là mục tiêu, không phải chức năng đã chạy.

## 4. Phạm vi MVP

### Bao gồm

- Điều hướng nhất quán, responsive cho các màn hình frontend hiện có; có trạng thái rỗng, lỗi và thành công dễ hiểu.
- Quản lý lớp học định kỳ theo ngày trong tuần: thêm, xem, sửa, xóa và cảnh báo giờ bị chồng lấn.
- Quản lý công việc: tiêu đề, môn/chủ đề, mô tả, deadline, thời lượng ước tính, mức ưu tiên, trạng thái và tiến độ; hỗ trợ lọc và đổi trạng thái.
- Lịch tuần/ngày và dashboard cho biết lịch sắp tới, việc gần hạn/quá hạn và tiến độ cơ bản.
- Thiết lập các khung giờ học ưa thích và thời gian nghỉ.
- Tạo đề xuất lịch cho công việc chưa hoàn thành được người dùng chọn; tính đến lớp học, các lịch đã áp dụng, deadline, giờ rảnh, thời lượng và thời gian nghỉ.
- Cho xem trước, chỉnh sửa/chọn lọc và xác nhận áp dụng hoặc bỏ đề xuất. Báo rõ việc chưa thể xếp và nguyên nhân.
- Dùng dữ liệu mẫu/localStorage để hoàn thiện và trình diễn frontend; giữ `ApiService` làm điểm chuyển sang API.

### Để sau MVP

- Gửi email nhắc lịch và tác vụ chạy định kỳ thực tế.
- Quy tắc lập lịch nâng cao, chia một công việc thành nhiều phiên, tối ưu hóa nhiều ràng buộc hoặc cá nhân hóa theo thói quen.
- Đồng bộ đa thiết bị, phân tích chuyên sâu và tích hợp lịch bên ngoài.
- Cơ chế phục hồi mật khẩu, refresh token và quản lý phiên hoàn chỉnh; chỉ triển khai khi backend/bảo mật được thiết kế và kiểm thử.

## 5. User stories và tiêu chí nghiệm thu

| Ưu tiên | User story | Điều kiện nghiệm thu chính |
|---|---|---|
| MVP | Là sinh viên, tôi muốn xem lịch học và việc cần làm trong một dashboard để biết hôm nay cần tập trung vào đâu. | Dữ liệu lịch sắp tới, deadline và tiến độ được hiển thị; trạng thái rỗng có hướng dẫn hành động. |
| MVP | Tôi muốn tạo/sửa/xóa lớp học định kỳ để lịch phản ánh đúng thời khóa biểu. | Dữ liệu hợp lệ được lưu; lớp bị chồng giờ được cảnh báo và chỉ ra lớp liên quan. |
| MVP | Tôi muốn quản lý việc theo hạn, ưu tiên, thời lượng và tiến độ. | Có thể CRUD, tìm/lọc, đổi trạng thái; dữ liệu giữ sau khi tải lại frontend. |
| MVP | Tôi muốn tạo lịch gợi ý trong giờ rảnh mà không trùng lịch học. | Thuật toán chỉ xét công việc được chọn, chưa hoàn thành/chưa xếp; tuân thủ giờ rảnh, deadline và khoảng nghỉ; việc không xếp được có lý do. |
| MVP | Tôi muốn duyệt kế hoạch trước khi ghi vào lịch. | Có thể xem trước và hủy; chỉ xác nhận mới tạo lịch đã áp dụng; lịch/task liên quan được cập nhật đồng bộ. |
| MVP | Tôi muốn điều chỉnh khung giờ học phù hợp thói quen. | Giờ bắt đầu/kết thúc hợp lệ; khung giờ đã tắt không được dùng để đề xuất. |
| Sau MVP | Tôi muốn nhận nhắc việc đúng thời điểm trên nhiều thiết bị. | Cấu hình người dùng, múi giờ, quyền gửi và trạng thái gửi được xử lý ở backend; không chỉ mô phỏng ở trình duyệt. |

## 6. Roadmap phát triển

### Giai đoạn 0 — Chốt nghiệp vụ và thiết kế trải nghiệm

- Đối chiếu từng màn hình hiện tại với user story; thống nhất thuật ngữ, điều hướng, trường dữ liệu và trạng thái.
- Chốt phạm vi MVP, tiêu chí nghiệm thu, cách xử lý xung đột và hành vi khi không xếp hết việc.
- Kiểm tra responsive/accessibility cơ bản, form validation, thông báo và trạng thái rỗng/lỗi/loading.
- Hoàn thiện sơ đồ luồng, kiến trúc mục tiêu và ERD khái niệm trong [diagrams.md](./diagrams.md).

**Đầu ra:** yêu cầu MVP rõ ràng, sơ đồ đã rà soát và danh sách việc theo màn hình.

### Giai đoạn 1 — Hoàn thiện frontend MVP

- Chuẩn hóa dữ liệu lưu cục bộ và luồng đăng nhập demo; ghi rõ giới hạn của mock/localStorage.
- Hoàn thiện CRUD lớp học/công việc, lọc, trạng thái, validation và cảnh báo xung đột.
- Đồng bộ dashboard, lịch, kanban/danh sách và thống kê theo cùng một nguồn dữ liệu.
- Hoàn thiện lập lịch xem trước/xác nhận/hủy; truyền danh sách việc được chọn trực tiếp vào thuật toán.
- Đảm bảo thuật toán không xếp lại lịch đã áp dụng hoặc công việc hoàn tất, kiểm tra mọi sự kiện bận, deadline theo thời điểm và múi giờ nhất quán.
- Kiểm thử các luồng chính trên desktop/mobile và kiểm thử quy tắc nghiệp vụ với dữ liệu biên.

**Đầu ra:** frontend MVP chạy được bằng mock, thao tác nhất quán và có thể trình diễn không cần backend.

### Giai đoạn 2 — Thiết kế hợp đồng API và dữ liệu

- Chốt ERD, kiểu dữ liệu, trạng thái, ràng buộc, chỉ mục và chiến lược migration MySQL.
- Định nghĩa API cho đăng ký/đăng nhập, hồ sơ, lớp học, công việc, lịch đề xuất/áp dụng và thông báo.
- Thống nhất định dạng ngày giờ/múi giờ, phân trang/lọc, mã lỗi, validation và quyền sở hữu dữ liệu.
- Chỉ chuyển `USE_MOCK` sau khi API, cấu hình môi trường và kiểm thử tích hợp sẵn sàng.

**Đầu ra:** schema và hợp đồng API có thể triển khai/kiểm thử độc lập với UI.

### Giai đoạn 3 — Xây dựng backend và tích hợp

- Tổ chức backend Express theo config, routes, controllers, middleware, services và models/repositories như README đề xuất.
- Xây API và ràng buộc dữ liệu theo user; xác thực token ở server và kiểm tra quyền sở hữu trên từng tài nguyên.
- Thay mock bằng API thông qua `ApiService`; thể hiện trạng thái tải, lỗi mạng, phiên hết hạn và lỗi validation.
- Viết kiểm thử unit cho nghiệp vụ, integration/API với Supertest và luồng frontend-backend.

**Đầu ra:** dữ liệu được lưu trên MySQL và các luồng MVP hoạt động qua API.

### Giai đoạn 4 — Lập lịch và nhắc việc đáng tin cậy

- Đặc tả thuật toán quy tắc dễ giải thích: ưu tiên/deadline, khoảng trống, giờ khả dụng, thời lượng, break, lịch đã tồn tại và chính sách khi không thể xếp.
- Lưu kế hoạch đề xuất tách biệt lịch đã áp dụng; bảo đảm áp dụng không tạo trùng lặp khi gửi lại yêu cầu.
- Bổ sung thông báo trong ứng dụng; sau đó mới triển khai worker/cron, email, retry và ghi nhận trạng thái gửi.

**Đầu ra:** lập lịch có thể kiểm chứng và nhắc việc không phụ thuộc vào một tab trình duyệt đang mở.

### Giai đoạn 5 — Hoàn thiện và triển khai

- Kiểm thử hồi quy, bảo mật, accessibility, hiệu năng, xử lý lỗi và khôi phục dữ liệu.
- Chuẩn bị cấu hình môi trường, secrets, HTTPS, backup/restore, logging và hướng dẫn triển khai.
- Thử nghiệm với sinh viên, ghi nhận khó khăn và ưu tiên cải tiến theo dữ liệu sử dụng.

**Đầu ra:** bản triển khai ổn định, tài liệu vận hành và backlog cải tiến có căn cứ.

## 7. Rủi ro và quyết định cần giữ rõ

- **Frontend localStorage không phải kho dữ liệu nhiều người dùng:** chỉ phù hợp prototype/MVP trình diễn; không dùng làm ranh giới bảo mật.
- **Lịch lặp và ngày giờ:** cần chốt học kỳ/ngày bắt đầu-kết thúc, múi giờ, và quy tắc deadline trước khi cố định schema/thuật toán.
- **Không thể xếp mọi công việc:** giữ nguyên đề xuất một phần, nêu việc chưa xếp và lý do thay vì báo thành công toàn bộ.
- **Chọn công việc:** danh sách checkbox của UI phải là đầu vào thuật toán; lọc kết quả sau khi thuật toán đã phân bổ không đảm bảo lựa chọn của người dùng.
- **Thông báo email:** cần backend/worker và quản lý cấu hình an toàn; checkbox UI hoặc cài đặt trình duyệt không tự gửi email.
- **Dữ liệu cá nhân và xác thực:** không đưa secrets vào frontend hoặc JWT payload; API phải xác thực và giới hạn dữ liệu theo user.

## 8. Sơ đồ

Xem [diagrams.md](./diagrams.md) để xem user flow, kiến trúc theo giai đoạn và ERD khái niệm.
