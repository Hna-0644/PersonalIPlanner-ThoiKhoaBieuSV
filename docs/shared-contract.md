# PersonalPlanner — Hợp đồng dùng chung cho nhóm phát triển AI

> **Mục đích:** giữ frontend, backend, database, kiểm thử và tài liệu dùng cùng thuật ngữ, field, enum và quy tắc nghiệp vụ.
>
> **Phiên bản:** 1.1 — chuẩn MVP. Đây là hợp đồng mục tiêu; mục 9 ghi các khác biệt chưa đồng bộ với prototype.

## 1. Cách các AI phối hợp

1. Đọc hợp đồng này và sơ đồ trước khi sửa code: [diagrams.md](./diagrams.md).
2. Dùng đúng tên field, enum, kiểu ngày giờ và quy tắc tại đây; không tự tạo alias hoặc enum tương đương.
3. Frontend/API JSON dùng `camelCase`; cột MySQL dùng `snake_case`. Mapping phải rõ ràng tại lớp persistence.
4. Không đổi cấu trúc response, route, enum hay quan hệ dữ liệu chỉ trong một tầng. Cập nhật hợp đồng, sơ đồ, implementation và tests cùng một thay đổi.
5. Nếu phát hiện mâu thuẫn với code hiện có, không âm thầm coi implementation cũ là đặc tả. Ghi rõ hiện trạng/độ lệch và đề xuất một thay đổi có kiểm thử.
6. Tránh hai nguồn dữ liệu có thể mâu thuẫn. Trạng thái lịch đã áp dụng lấy từ `ScheduledEvent`; các cờ tương thích cũ trên `Task` phải được suy ra hoặc đồng bộ trong giai đoạn chuyển đổi.
7. Không ghi credentials, token thật hoặc thông tin cá nhân thực vào fixture, tài liệu, log hay commit.

## 2. Từ vựng và quy tắc đặt tên

| Khái niệm | Tên chuẩn | Ghi chú |
|---|---|---|
| Người sử dụng hệ thống | `User` | Một user sở hữu hồ sơ, lớp, công việc, sự kiện và thông báo của mình. |
| Buổi học lặp theo tuần | `ClassEntry` / API resource `classes` | `dayOfWeek` xác định thứ; thời gian bắt đầu/kết thúc là giờ địa phương. |
| Công việc cá nhân | `Task` | Có deadline tùy chọn, mức ưu tiên, trạng thái và thời lượng ước tính. |
| Khoảng thời gian đã xác nhận trên lịch | `ScheduledEvent` | Chỉ ghi nhận lịch đã áp dụng, không phải kết quả preview chưa xác nhận. |
| Kết quả thuật toán chưa xác nhận | `SchedulePlan` | Dữ liệu tạm trả về; chưa ghi thành `ScheduledEvent`. |
| Khoảng giờ người dùng cho phép học/làm việc | `preferredHours` | Các khung `morning`, `afternoon`, `evening`; mỗi khung có `active`, `start`, `end`. |
| Định danh | `id` | API dùng chuỗi có prefix (`usr_…`, `cls_…`, `tsk_…`, `sch_…`, `ntf_…`). Client phải giữ nguyên ID, không tự tách prefix/phụ thuộc phần số. ID không phải secret; mọi truy vấn vẫn phải giới hạn theo user đã xác thực. |

## 3. Khai báo entity và field chuẩn

### User

| Field JSON | Kiểu | Bắt buộc | Quy tắc |
|---|---|---:|---|
| `id` | `string` | Có trong response | Do hệ thống cấp; không lấy từ payload client để xác định chủ sở hữu. |
| `fullName` | `string` | Có | Tên hiển thị. |
| `email` | `string` | Có | Chuẩn hóa và duy nhất khi có backend. |
| `studentId` | `string \| null` | Không | Mã sinh viên; lưu dạng chuỗi để giữ số 0 đầu. |
| `major` | `string \| null` | Không | Ngành học. |
| `university` | `string \| null` | Không | Trường học. |
| `avatar` | `string \| null` | Không | URL tuyệt đối hợp lệ hoặc `null`; không chứa nội dung nhạy cảm. |
| `preferredHours` | `PreferredHours` | Có giá trị mặc định | Cấu hình giờ rảnh theo bảng bên dưới. |
| `breakMinutes` | `integer` | Có giá trị mặc định | Số phút nghỉ tối thiểu giữa các phiên; không âm. |
| `timezone` | `string` | Có giá trị mặc định | Tên timezone IANA; ví dụ `Asia/Ho_Chi_Minh`. |
| `emailReminder` | `boolean` | Có giá trị mặc định | Cấu hình mong muốn; không đảm bảo gửi email nếu dịch vụ chưa triển khai. |
| `browserReminder` | `boolean` | Có giá trị mặc định | Cấu hình thông báo trình duyệt/ứng dụng. |

Không trả `passwordHash`, access token hoặc refresh token trong đối tượng hồ sơ. Thông tin xác thực chỉ được xử lý ở luồng auth.

#### PreferredHours

| Key | Kiểu |
|---|---|
| `morning` | `TimeWindow` |
| `afternoon` | `TimeWindow` |
| `evening` | `TimeWindow` |

`TimeWindow = { active: boolean, start: "HH:mm", end: "HH:mm" }`. Khi `active` là `true`, bắt buộc `start < end` trong cùng ngày. Khung tắt vẫn giữ giờ hợp lệ nhưng không được dùng để lập lịch. Các khung đang bật không được chồng lấn; nếu chạm biên thì hợp lệ. Khi cập nhật `preferredHours`, thay toàn bộ object ba khung, không merge từng key con.

### ClassEntry

| Field JSON | Kiểu | Bắt buộc | Quy tắc |
|---|---|---:|---|
| `id` | `string` | Response | ID do hệ thống cấp. |
| `title` | `string` | Có | Tên lớp không rỗng. |
| `code` | `string \| null` | Không | Mã môn học. |
| `room` | `string \| null` | Không | Phòng hoặc địa điểm trực tuyến. |
| `lecturer` | `string \| null` | Không | Giảng viên. |
| `dayOfWeek` | `integer` | Có | `0 = Chủ Nhật`, `1 = Thứ Hai`, ..., `6 = Thứ Bảy`. |
| `startTime` | `LocalTime` | Có | Chuỗi 24 giờ `HH:mm`. |
| `endTime` | `LocalTime` | Có | Phải lớn hơn `startTime`. |
| `semesterStart` | `LocalDate \| null` | Không | Ngày bắt đầu lặp, định dạng `YYYY-MM-DD`. |
| `semesterEnd` | `LocalDate \| null` | Không | Không sớm hơn `semesterStart`. |
| `color` | `string \| null` | Không | Màu hiển thị dạng hex. |
| `notes` | `string \| null` | Không | Ghi chú. |

Hai lớp cùng `dayOfWeek` bị xung đột khi khoảng giờ overlap **và** khoảng học kỳ overlap. Khoảng giờ overlap khi `candidate.startTime < existing.endTime` và `candidate.endTime > existing.startTime`; hai khoảng chỉ chạm biên nhau không bị tính là overlap. Khoảng học kỳ là inclusive; thiếu ngày đầu hoặc cuối được xem là không giới hạn ở phía đó.

### Task

| Field JSON | Kiểu | Bắt buộc | Quy tắc |
|---|---|---:|---|
| `id` | `string` | Response | ID do hệ thống cấp. |
| `title` | `string` | Có | Tiêu đề không rỗng. |
| `subject` | `string \| null` | Không | Môn học/chủ đề. |
| `description` | `string \| null` | Không | Mô tả. |
| `priority` | `Priority` | Có | Mặc định `medium`. |
| `status` | `TaskStatus` | Có | Mặc định `todo`. |
| `progress` | `integer` | Có giá trị mặc định | Trong khoảng 0–100; nếu `done` thì bằng 100. |
| `estimatedHours` | `number \| null` | Không | Lớn hơn 0 nếu có giá trị. |
| `deadline` | `Instant \| null` | Không | ISO 8601 có timezone/offset. |

`done` tương đương tiến độ 100%; các trạng thái còn lại có tiến độ 0–99. Chuyển vào hoặc ra trạng thái `done` phải cập nhật `status` và `progress` cùng một request.

### ScheduledEvent

| Field JSON | Kiểu | Bắt buộc | Quy tắc |
|---|---|---:|---|
| `id` | `string` | Response | ID do hệ thống cấp. |
| `taskId` | `string` | Có | Tham chiếu công việc cùng user. |
| `title` | `string` | Có | Tiêu đề hiển thị snapshot hoặc lấy từ task theo quyết định implementation. |
| `subject` | `string \| null` | Không | Chủ đề hiển thị. |
| `start` | `Instant` | Có | ISO 8601 có timezone/offset. |
| `end` | `Instant` | Có | Phải lớn hơn `start`. |
| `source` | `ScheduleSource` | Có | `auto` hoặc `manual`; MVP có thể chỉ dùng `auto`. |
| `color` | `string \| null` | Không | Màu hiển thị dạng hex. |

### SchedulePlan và kết quả chưa xếp

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `plan[]` | `SchedulePlanItem[]` | Các slot đề xuất, chưa được ghi vào lịch. |
| `breakMinutes` | `integer` | Khoảng nghỉ hiệu lực dùng khi tính plan; phải được gửi lại khi áp dụng. |
| `timezone` | `string` | Timezone IANA dùng để diễn giải `date`, `startTime`, `endTime`. |
| `plan[].taskId` | `string` | Public ID dạng `tsk_<id>` của công việc. |
| `plan[].date` | `LocalDate` | Ngày của slot theo timezone người dùng. |
| `plan[].startTime` | `LocalTime` | Giờ bắt đầu tại timezone người dùng. |
| `plan[].endTime` | `LocalTime` | Giờ kết thúc; lớn hơn giờ bắt đầu. |
| `plan[].durationMinutes` | `integer` | Thời lượng slot; dương. |
| `unscheduled[]` | `UnscheduledTask` | Công việc không có slot khả dụng. |
| `unscheduled[].taskId` | `string` | Công việc chưa được xếp. |
| `unscheduled[].reason` | `UnscheduledReason` | Mã lý do ổn định; UI dùng `message` để hiển thị. |

`SchedulePlanItem` có thể giữ thêm `taskTitle`, `subject`, `priority`, `estimatedHours`, `deadline` để render preview. Đây là dữ liệu hiển thị không đáng tin cậy; lúc áp dụng server phải đọc lại task theo `taskId` và dùng dữ liệu trong DB.

### Notification

| Field JSON | Kiểu | Quy tắc |
|---|---|---|
| `id` | `string` | ID do hệ thống cấp. |
| `type` | `NotificationType` | `urgent`, `info`, hoặc `success`. |
| `title` | `string` | Tiêu đề thông báo. |
| `message` | `string` | Nội dung thông báo. |
| `read` | `boolean` | `true` nếu đã đọc. |
| `createdAt` | `Instant` | ISO 8601 có timezone/offset khi có backend. |

## 4. Enum chuẩn

| Enum | Giá trị cho phép |
|---|---|
| `Priority` | `urgent`, `high`, `medium`, `low` |
| `TaskStatus` | `todo`, `inprogress`, `done` |
| `NotificationType` | `urgent`, `info`, `success` |
| `ScheduleSource` | `auto`, `manual` |
| `UnscheduledReason` | `NO_AVAILABLE_SLOT`, `DEADLINE_PASSED`, `DEADLINE_INFEASIBLE`, `DURATION_EXCEEDS_WINDOW`, `NO_ACTIVE_STUDY_WINDOW` |

Label tiếng Việt chỉ dùng cho hiển thị; lưu và truyền giá trị enum chuẩn ở trên. Không tự tạo các biến thể như `in_progress`, `completed`, `critical` nếu chưa cập nhật hợp đồng. `DEADLINE_PASSED` chỉ dùng khi deadline đã ở quá khứ; `DEADLINE_INFEASIBLE` dùng khi deadline còn tương lai nhưng không đủ slot khả thi trước hạn.

## 5. Quy ước ngày giờ và định dạng

| Kiểu logic | Định dạng chuẩn | Ví dụ |
|---|---|---|
| `LocalDate` | `YYYY-MM-DD` | `2026-10-31` |
| `LocalTime` | 24 giờ `HH:mm` | `08:30` |
| `Instant` | ISO 8601 có `Z` hoặc offset | `2026-10-31T08:30:00+07:00` |
| `timezone` | Tên IANA | `Asia/Ho_Chi_Minh` |

- `dayOfWeek` theo JavaScript `Date.getDay()`: Chủ Nhật bằng 0.
- Lớp học và giờ rảnh là giờ địa phương; phải diễn giải trong timezone của user.
- Deadline và sự kiện đã lưu qua API dùng ISO 8601 có offset; UI chuyển đổi theo timezone user.
- MySQL `DATETIME(3)` cho `deadline`, `start_at`, `end_at`, `created_at`, `updated_at` được lưu theo UTC; driver kết nối phải đặt timezone UTC. `DATE`/`TIME` của lớp học giữ nguyên giá trị địa phương.
- Không dùng chuỗi ngày phụ thuộc locale (`31/10/2026`) trong API hoặc lưu trữ.
- Test boundary cho giờ mùa hè/timezone nếu mở rộng ra ngoài timezone Việt Nam.

## 6. Quy tắc nghiệp vụ lập lịch

1. API nhận `taskIds` rõ ràng; chỉ xếp các task được yêu cầu, chưa `done`, và thuộc user hiện tại.
2. Thứ tự ưu tiên: `urgent` → `high` → `medium` → `low`; trong cùng mức ưu tiên, deadline gần hơn trước; không deadline xếp sau task có deadline. Hòa hoàn toàn thì giữ thứ tự ID tăng dần để kết quả ổn định.
3. Slot phải nằm hoàn toàn trong một khung `preferredHours` đang active.
4. Không overlap lớp học, `ScheduledEvent` đã áp dụng hoặc slot khác trong cùng phương án.
5. `breakMinutes` là khoảng nghỉ tối thiểu **giữa hai hoạt động**; slot liền kề chỉ hợp lệ nếu có ít nhất đúng số phút đó ở giữa. Khi nhiều slot cùng nằm cạnh một hoạt động, không cộng break hai lần.
6. Toàn bộ slot phải kết thúc tại hoặc trước deadline; deadline là thời điểm, không chỉ so sánh ngày. Task thiếu deadline không bị loại vì deadline.
7. Horizon gồm `days` ngày địa phương, bắt đầu từ hôm nay và có tính cả hôm nay. Nếu không truyền `days`, mặc định 7; miền hợp lệ 1–30.
8. Task không có `estimatedHours` dùng mặc định 1.5 giờ; thời lượng quy đổi sang phút và làm tròn đến phút gần nhất, tối thiểu 1 phút.
9. Slot hôm nay không bắt đầu sớm hơn hiện tại cộng 15 phút. Thuật toán thử các thời điểm bắt đầu theo bước 30 phút trong từng khung giờ.
10. Nếu task không thể xếp, trả trong `unscheduled` với reason; có thể trả phương án một phần.
11. Nếu `breakMinutes` có trong request generate, giá trị đó ghi đè cấu hình user chỉ cho phương án hiện tại; nếu bỏ qua thì dùng `User.breakMinutes`. Cùng giá trị hiệu lực phải được gửi lại khi apply.
12. Sinh đề xuất là thao tác không ghi dữ liệu. Áp dụng phải kiểm tra lại quyền sở hữu, xung đột, timezone/khung giờ, deadline và trạng thái task để tránh lưu kế hoạch đã lỗi thời.
13. Mỗi task chỉ có tối đa một `ScheduledEvent` đang hoạt động trong MVP. Áp dụng lặp lại không tạo duplicate; nếu task đã có event, trả `409 CONFLICT` và client cần tải lại lịch, không giả định request retry là thành công idempotent.
14. Không được âm thầm lên lịch lại task đã xếp hoặc task hoàn tất. MVP chưa hỗ trợ sửa/xóa `ScheduledEvent`; reschedule phải được thiết kế thành thao tác riêng trước khi triển khai.

## 7. API contract mục tiêu

Prefix API: `/api`. Tên endpoint dưới đây khớp với các operation đã khai báo trong `frontend/js/api.js`; response shape là quy ước đề xuất cần dùng chung khi triển khai backend.

| Method | Endpoint | Auth | Request/response chính |
|---|---|---:|---|
| `POST` | `/auth/register` | Không | Request `{ fullName, email, password }` (mật khẩu tối thiểu 8 ký tự, tối đa 72 byte); trả `{ data: { user, accessToken, tokenType } }`. |
| `POST` | `/auth/login` | Không | Request `{ email, password }`; trả `{ data: { user, accessToken, tokenType } }`. |
| `GET` | `/user/profile` | Có | Trả `{ data: user }` của user trong token. |
| `PATCH` | `/user/profile` | Có | Partial update; chỉ ghi field gửi lên. `PUT` hiện là alias tương thích, không mang nghĩa replace toàn bộ resource. |
| `GET` | `/classes` | Có | Trả `{ data: ClassEntry[] }` thuộc user hiện tại. |
| `POST` | `/classes` | Có | Nhận `ClassEntry` không có `id`; trả `{ data: ClassEntry }`; nếu trùng lịch trả `409 CONFLICT`, không lưu và đưa các lớp xung đột vào `error.details`. |
| `PATCH` | `/classes/{id}` | Có | Partial update; field bỏ qua giữ nguyên, field `null` xóa giá trị nullable. `PUT` hiện là alias tương thích, không mang nghĩa replace toàn bộ resource. |
| `DELETE` | `/classes/{id}` | Có | Xóa lớp thuộc user hiện tại; trả `{ data: { id, deleted: true } }`. |
| `GET` | `/tasks` | Có | Trả `{ data: Task[] }` thuộc user hiện tại. |
| `POST` | `/tasks` | Có | Nhận task không có `id`; trả `{ data: Task }`. |
| `PATCH` | `/tasks/{id}` | Có | Partial update; field bỏ qua giữ nguyên, field `null` xóa giá trị nullable. `PUT` hiện là alias tương thích, không mang nghĩa replace toàn bộ resource. |
| `DELETE` | `/tasks/{id}` | Có | Xóa task thuộc user hiện tại; chính sách event liên quan phải nhất quán; trả `{ data: { id, deleted: true } }`. |
| `GET` | `/schedule/events` | Có | Trả `{ data: ScheduledEvent[] }` thuộc user hiện tại, theo thứ tự thời gian bắt đầu. |
| `POST` | `/schedule/auto-generate` | Có | Request `{ taskIds, days?, breakMinutes? }`; trả `{ data: { plan, unscheduled, breakMinutes, timezone } }`. |
| `POST` | `/schedule/apply` | Có | Request `{ plan, breakMinutes, timezone }`; kiểm tra lại quyền sở hữu/xung đột rồi trả `{ data: { events } }`. Client gửi lại cấu hình nhận từ generate; server kiểm tra timezone khớp hồ sơ và revalidate toàn bộ slot. MVP không lưu/signed proposal nên server không thể chứng minh `breakMinutes` gửi lại chính là giá trị từ lần generate; giá trị vẫn bị giới hạn 0–180 và dùng nhất quán khi revalidate. |
| `GET` | `/notifications` | Có | Trả tối đa 100 thông báo gần nhất của user. |
| `PATCH` | `/notifications/{id}` | Có | Request `{ read: true }`; đánh dấu đã đọc, thao tác lặp lại thành công. `PUT /notifications/{id}/read` là alias cũ. |
| `PATCH` | `/notifications` | Có | Request `{ readAll: true }`; đánh dấu toàn bộ đã đọc, trả số bản ghi thực sự thay đổi. `PUT /notifications/read-all` là alias cũ. |

### Response và lỗi

- Mọi response thành công dùng `{ "data": ... }`, bao gồm list, auth, update và delete; không trộn response bọc với response raw. Request body là JSON UTF-8; endpoint được bảo vệ dùng `Authorization: Bearer <accessToken>`.
- Lỗi dùng cấu trúc `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }`.
- Mã lỗi chuẩn ban đầu: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.
- HTTP status tương ứng: `400`, `401`, `403`, `404`, `409`, `500`; `409` dùng cho xung đột lịch hoặc trạng thái tài nguyên. Không biến lỗi thành response thành công giả.
- Mọi truy vấn tài nguyên phải giới hạn theo user đã xác thực; không tin `userId` gửi từ client.
- Mọi thao tác cập nhật hồ sơ/lớp/task là partial merge: field bỏ qua giữ nguyên, field nullable gửi `null` sẽ xóa giá trị, field không nullable không nhận `null`. `PATCH` là method chuẩn; `PUT` chỉ là alias tương thích tạm thời và có cùng semantics partial.
- `/auth/register` trả `409 CONFLICT` nếu email đã được đăng ký. Login không tiết lộ email hay mật khẩu sai cụ thể.
- Access token ký `HS256`, subject là public user ID, hết hạn theo cấu hình server. MVP không có refresh/revocation; logout phía client chỉ xóa token nên token bị lộ còn hiệu lực đến khi hết hạn.
- `/notifications` list trả `{ data: Notification[] }`, giới hạn 100 mục mới nhất. `PATCH /notifications/{id}` nhận `{ read: true }`; `PATCH /notifications` nhận `{ readAll: true }`. PUT endpoint cũ chỉ duy trì alias trong thời gian chuyển đổi.
- Lớp học trùng lịch trả `409 CONFLICT` và giữ danh sách lớp xung đột trong `error.details`; không lưu lớp conflict trong MVP.

## 8. Mapping database

API/JavaScript dùng `camelCase`; cột MySQL dùng `snake_case`. Ví dụ:

| JSON / JavaScript | MySQL |
|---|---|
| `userId` | `user_id` |
| `dayOfWeek` | `day_of_week` |
| `startTime` | `start_time` |
| `estimatedHours` | `estimated_hours` |
| `createdAt` | `created_at` |

Không đưa tên cột SQL vào payload frontend; chỉ mapper/repository chịu trách nhiệm chuyển đổi.

Mọi cột MySQL `DATETIME(3)` biểu diễn instant được ghi/đọc dưới dạng UTC. `created_at`/`updated_at` do DB tạo cũng được serialize thành ISO 8601 UTC. Mọi ID BIGINT phải được chuyển sang public ID có prefix ở ranh giới API; việc prefix không thay thế authorization.

`scheduled_events.task_id` là unique trong MVP: một task chỉ có tối đa một event áp dụng. Xóa task xóa event liên quan theo cascade. Trước khi hỗ trợ chia task thành nhiều phiên, cần migration/thay đổi hợp đồng riêng.

## 9. Hiện trạng frontend và các điểm cần đồng bộ

Hợp đồng trên là chuẩn mục tiêu. Prototype hiện có một số khác biệt cần xử lý có chủ đích khi làm frontend/backend:

| Khu vực | Hiện trạng đã quan sát | Hướng xử lý để khớp hợp đồng |
|---|---|---|
| Auth | `ApiService.USE_MOCK` bật; token mock được lưu ở localStorage. | Chỉ dùng demo; không coi là xác thực an toàn. Backend phải xác thực token và giới hạn tài nguyên theo user. |
| Auth response | Mock hiện trả `{ success, message, token, user }`; màn hình đăng nhập đọc `res.success` và `res.user`. | Backend dùng response envelope `{ data: { user, accessToken, tokenType } }`; `ApiService` cần chuyển response sang view model frontend hoặc cập nhật màn hình đăng nhập đồng bộ. |
| Cập nhật resource | Prototype dùng `PUT` cho update local/API wrapper. | `PATCH` là method chuẩn partial; `PUT` backend giữ alias tạm cho tương thích. Khi nối API, chuyển client sang `PATCH`. |
| Nối frontend với API | Frontend hiện gọi trực tiếp `AppStore` ở nhiều màn hình và không xử lý envelope `data`. | Chưa đổi `USE_MOCK` trước khi adapter `ApiService` chuẩn hóa response/auth, ánh xạ public IDs và cập nhật CRUD/schedule/notification trên tất cả màn hình. |
| Task chọn để lập lịch | UI lọc kết quả sau khi `AppStore.generateAutoSchedule()` đã sinh lịch cho toàn bộ task chưa hoàn thành. | Truyền `taskIds` vào thuật toán/API trước khi lập lịch. |
| Task đã được xếp | `generateAutoSchedule()` hiện lấy mọi task chưa hoàn thành, không loại task đã scheduled. | Loại event/task đã có khỏi slot và không tạo event lặp; reschedule phải explicit. |
| Slot bận | Thuật toán hiện đưa lớp học vào danh sách bận; cần xác nhận/đồng bộ đầy đủ scheduled event đã áp dụng. | Tất cả lớp, event đã lưu và slot mới đều tham gia kiểm tra overlap. |
| Việc không xếp được | Hiện tại kết quả là một plan, thiếu danh sách nguyên nhân cho task không xếp được. | Trả `{ plan, unscheduled }` với reason ổn định. |
| Ngày giờ | Prototype kết hợp `Date`, local time và `toISOString()`; có thể lệch ngày theo timezone. | Chuẩn hóa cách xử lý timezone trước khi dùng API/DB thật; thêm test boundary. |
| Lưu lịch | Prototype giữ `scheduled`/`scheduledTime` trên Task cùng danh sách ScheduledEvent. | Dùng ScheduledEvent làm nguồn sự thật; field cũ chỉ tương thích/chuyển đổi, tránh cập nhật lệch. |

## 10. Checklist trước khi hoàn tất một thay đổi

- [ ] Đã đọc hợp đồng và sơ đồ liên quan.
- [ ] Không tạo field, enum, route hoặc kiểu ngày giờ trùng nghĩa nhưng khác tên.
- [ ] Đã cập nhật các tầng bị ảnh hưởng: UI/API/service/database.
- [ ] Đã thêm hoặc điều chỉnh test cho validation, quyền sở hữu, trạng thái và timezone liên quan.
- [ ] Đã cập nhật tài liệu/hợp đồng nếu có quyết định nghiệp vụ mới.
- [ ] Đã chạy các kiểm thử phù hợp và báo rõ kiểm thử nào chưa chạy.
