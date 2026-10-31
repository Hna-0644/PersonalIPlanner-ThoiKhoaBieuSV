# PersonalPlanner — Sơ đồ sản phẩm và hệ thống

Các sơ đồ dưới đây phân biệt **frontend prototype hiện có** với **kiến trúc mục tiêu**. ERD là mô hình khái niệm, cần chốt trường và ràng buộc trước khi tạo migration.

> Quy ước field, enum, ngày giờ, API và quy tắc nghiệp vụ dùng chung được quản lý tập trung tại [shared-contract.md](./shared-contract.md). Khi sơ đồ và code không khớp, xem mục trạng thái triển khai trong hợp đồng trước khi thay đổi.

## 0. UML Use Case

Sơ đồ thể hiện phạm vi sản phẩm mục tiêu; đăng nhập thật, email và backend chưa có trong prototype.

```plantuml
@startuml
left to right direction
actor "Sinh viên" as Student
actor "Dịch vụ email\n(sau MVP)" as Email

rectangle "PersonalPlanner" {
  usecase "Đăng ký / đăng nhập" as UC_Auth
  usecase "Xem dashboard" as UC_Dashboard
  usecase "Quản lý hồ sơ\nvà giờ rảnh" as UC_Profile
  usecase "Quản lý thời khóa biểu" as UC_Class
  usecase "Kiểm tra trùng lịch" as UC_Conflict
  usecase "Quản lý công việc" as UC_Task
  usecase "Tạo đề xuất\nlịch học/làm việc" as UC_Generate
  usecase "Xem và chọn\nphương án" as UC_Review
  usecase "Áp dụng phương án" as UC_Apply
  usecase "Xem thống kê\nvà tiến độ" as UC_Stats
  usecase "Xem thông báo" as UC_Notifications
  usecase "Gửi nhắc lịch" as UC_Reminder
}

Student --> UC_Auth
Student --> UC_Dashboard
Student --> UC_Profile
Student --> UC_Class
Student --> UC_Task
Student --> UC_Generate
Student --> UC_Review
Student --> UC_Apply
Student --> UC_Stats
Student --> UC_Notifications
Email --> UC_Reminder

UC_Class ..> UC_Conflict : <<include>>
UC_Generate ..> UC_Profile : <<include>>
UC_Generate ..> UC_Class : <<include>>
UC_Generate ..> UC_Task : <<include>>
UC_Review ..> UC_Generate : <<extend>>
UC_Apply ..> UC_Review : <<include>>
UC_Reminder ..> UC_Notifications : <<include>>
@enduml
```

## 0.1 UML Class Diagram — mô hình miền nghiệp vụ

Các lớp dưới đây mô tả mô hình mục tiêu và quan hệ dữ liệu, không khẳng định backend đã được tạo. Field chuẩn và kiểu dữ liệu được định nghĩa tại [shared-contract.md](./shared-contract.md).

```plantuml
@startuml
hide methods
skinparam classAttributeIconSize 0

class User {
  +id: Id
  +fullName: string
  +email: string
  +studentId: string
  +major: string
  +university: string
}

class StudyPreference {
  +userId: Id
  +preferredHours: PreferredHours
  +breakMinutes: integer
  +timezone: string
  +emailReminder: boolean
  +browserReminder: boolean
}

class ClassEntry {
  +id: Id
  +title: string
  +code: string
  +room: string
  +lecturer: string
  +dayOfWeek: integer
  +startTime: LocalTime
  +endTime: LocalTime
  +semesterStart: LocalDate
  +semesterEnd: LocalDate
}

class Task {
  +id: Id
  +title: string
  +subject: string
  +priority: Priority
  +status: TaskStatus
  +progress: integer
  +estimatedHours: number
  +deadline: Instant
}

class ScheduledEvent {
  +id: Id
  +taskId: Id
  +start: Instant
  +end: Instant
  +source: ScheduleSource
}

class Notification {
  +id: Id
  +type: NotificationType
  +title: string
  +message: string
  +read: boolean
  +createdAt: Instant
}

User "1" *-- "1" StudyPreference : cấu hình
User "1" *-- "0..*" ClassEntry : sở hữu
User "1" *-- "0..*" Task : sở hữu
User "1" *-- "0..*" ScheduledEvent : sở hữu
User "1" *-- "0..*" Notification : nhận
Task "1" <-- "0..*" ScheduledEvent : được xếp vào
@enduml
```

## 0.2 UML Sequence Diagram — đề xuất và áp dụng lịch

Đề xuất chỉ đọc dữ liệu để tính toán; chỉ thao tác áp dụng mới ghi lịch và cập nhật trạng thái liên quan.

```plantuml
@startuml
actor "Sinh viên" as Student
boundary "Giao diện" as UI
control "ApiService" as API
control "ScheduleService" as Scheduler
database "CSDL / AppStore" as Store

Student -> UI: Chọn công việc, số ngày,\nthời gian nghỉ
UI -> API: generateAutoSchedule(params)
API -> Scheduler: generate(taskIds, days, breakMinutes)
Scheduler -> Store: Đọc task, lớp học,\ngiờ rảnh, lịch đã áp dụng
Store --> Scheduler: Dữ liệu lịch và công việc
Scheduler --> API: plan + unscheduled + reasons
API --> UI: Kết quả đề xuất
UI --> Student: Hiển thị để xem/chọn

alt Người dùng hủy
  Student -> UI: Hủy đề xuất
  UI --> Student: Không thay đổi lịch đã lưu
else Người dùng xác nhận
  Student -> UI: Xác nhận phương án đã chọn
  UI -> API: applyAutoSchedule(plan)
  API -> Scheduler: Validate và áp dụng
  Scheduler -> Store: Kiểm tra xung đột lần cuối
  alt Phương án còn hợp lệ
    Scheduler -> Store: Lưu ScheduledEvent\nvà cập nhật Task
    Store --> Scheduler: Kết quả lưu
    Scheduler --> API: Kết quả thành công
    API --> UI: Lịch đã cập nhật
    UI --> Student: Thông báo thành công
  else Có xung đột hoặc dữ liệu đã đổi
    Scheduler --> API: Conflict / validation error
    API --> UI: Lỗi có mã và thông tin chi tiết
    UI --> Student: Báo lỗi, yêu cầu tạo lại đề xuất
  end
end
@enduml
```

## 1. Luồng người dùng chính

```mermaid
flowchart TD
    A[Truy cập PersonalPlanner] --> B{Đã đăng nhập?}
    B -- Chưa --> C[Đăng nhập hoặc đăng ký]
    C --> D{Thông tin hợp lệ?}
    D -- Không --> C
    D -- Có --> E[Dashboard]
    B -- Rồi --> E

    E --> F[Xem lịch, deadline và tiến độ]
    E --> G[Quản lý thời khóa biểu]
    E --> H[Quản lý công việc]
    E --> I[Cấu hình hồ sơ và giờ rảnh]

    G --> G1[Thêm / sửa / xóa lớp]
    G1 --> G2{Trùng giờ?}
    G2 -- Có --> G3[Hiển thị cảnh báo và lớp liên quan]
    G2 -- Không --> E
    G3 --> E

    H --> H1[Tạo việc với deadline, ưu tiên, thời lượng]
    H1 --> H2[Cập nhật trạng thái và tiến độ]
    H2 --> J[Chọn việc cần xếp lịch]

    I --> J
    G --> J
    J --> K[Tạo phương án từ lịch học và giờ khả dụng]
    K --> L{Có khoảng trống phù hợp?}
    L -- Không --> M[Hiển thị việc chưa xếp và lý do]
    M --> I
    L -- Có --> N[Xem trước / điều chỉnh phương án]
    N --> O{Người dùng xác nhận?}
    O -- Không --> P[Bỏ phương án, dữ liệu lịch giữ nguyên]
    O -- Có --> Q[Lưu lịch đã áp dụng và cập nhật công việc]
    Q --> R[Theo dõi trên lịch, dashboard và thống kê]
    P --> E
    R --> E

    E --> S[Đọc thông báo]
    S --> T[Đánh dấu đã đọc]
    T --> E
```

### Quy tắc cho luồng

- Tạo đề xuất không đồng nghĩa với áp dụng; dữ liệu lịch chỉ đổi sau xác nhận.
- Không có slot khả dụng là kết quả nghiệp vụ bình thường, cần nêu nguyên nhân và gợi ý hành động.
- Frontend hiện có các màn hình và một số hành vi demo; trạng thái xác thực thật, nhắc email và API cần backend.

## 2. Kiến trúc hiện tại và đích đến

```mermaid
flowchart LR
    subgraph Browser["Trình duyệt"]
        UI["Trang HTML hiện có<br/>Dashboard · Lịch · Công việc<br/>Auto-schedule · Thống kê · Hồ sơ"]
        LIB["Bootstrap · FullCalendar<br/>Chart.js · SweetAlert2"]
        API["ApiService<br/>giao diện gọi dữ liệu"]
        STORE["AppStore<br/>dữ liệu mẫu và nghiệp vụ frontend"]
        LS[("localStorage<br/>prototype hiện tại")]
        UI --> LIB
        UI --> API
        API -->|"USE_MOCK hiện bật"| STORE
        STORE <--> LS
    end

    API -. "Giai đoạn tích hợp: REST/JSON" .-> ROUTER

    subgraph Server["Backend mục tiêu — Express / Node.js"]
        ROUTER["REST routes"]
        AUTH["Middleware<br/>xác thực · phân quyền · validation"]
        CTRL["Controllers"]
        SVC["Services<br/>lập lịch · nghiệp vụ"]
        REPO["Models / repositories"]
        ROUTER --> AUTH --> CTRL --> SVC --> REPO
    end

    REPO --> DB[("MySQL")]

    subgraph Later["Sau MVP"]
        WORKER["Worker / tác vụ định kỳ"]
        MAIL["Dịch vụ email"]
        NOTIF["Thông báo trong ứng dụng"]
        WORKER --> DB
        WORKER --> MAIL
        WORKER --> NOTIF
    end

    SVC -. "tạo nhắc lịch khi được triển khai" .-> WORKER
```

### Trạng thái kiến trúc

- **Đang có ở frontend:** các trang tĩnh, `AppStore`, localStorage và `ApiService` với mock bật.
- **Đã có code backend ban đầu:** Express routes/services, middleware JWT, schema và migration MySQL. Cần cấu hình MySQL để chạy đầy đủ; chưa có bằng chứng triển khai production.
- **Chưa triển khai:** worker/cron, gửi email và refresh-token/session revocation.
- **Nguyên tắc chuyển đổi:** giữ `ApiService` làm ranh giới dữ liệu; thống nhất response/error contract trước khi chuyển khỏi mock.
- Khi tích hợp, server phải kiểm tra quyền sở hữu từng bản ghi; token và secrets không được xem là an toàn chỉ vì được lưu phía client.

## 3. ERD khái niệm

```mermaid
erDiagram
    USER ||--|| STUDY_PREFERENCE : configures
    USER ||--o{ CLASS : owns
    USER ||--o{ TASK : owns
    USER ||--o{ SCHEDULED_EVENT : owns
    USER ||--o{ NOTIFICATION : receives
    TASK ||--o{ SCHEDULED_EVENT : can_be_planned_as

    USER {
        bigint id PK
        string full_name
        string email UK
        string password_hash
        string student_id
        string major
        string university
        datetime created_at
        datetime updated_at
    }

    STUDY_PREFERENCE {
        bigint id PK
        bigint user_id FK
        json preferred_windows
        int break_minutes
        string timezone
        boolean email_reminder
        boolean browser_reminder
    }

    CLASS {
        bigint id PK
        bigint user_id FK
        string title
        string code
        string room
        string lecturer
        int day_of_week
        time start_time
        time end_time
        date semester_start
        date semester_end
        string notes
        string color
    }

    TASK {
        bigint id PK
        bigint user_id FK
        string title
        string subject
        text description
        string priority
        string status
        int progress
        decimal estimated_hours
        datetime deadline
        datetime created_at
        datetime updated_at
    }

    SCHEDULED_EVENT {
        bigint id PK
        bigint user_id FK
        bigint task_id FK
        datetime start_at
        datetime end_at
        string status
        string source
        datetime created_at
    }

    NOTIFICATION {
        bigint id PK
        bigint user_id FK
        string type
        string title
        text message
        datetime scheduled_at
        datetime read_at
        string delivery_status
    }
```

### Ghi chú thiết kế dữ liệu

- `CLASS` là buổi học lặp theo thứ trong tuần trong một khoảng học kỳ; cần xác nhận quy tắc tuần nghỉ/ngoại lệ trước khi thiết kế đầy đủ.
- `STUDY_PREFERENCE.preferred_windows` có thể được chuẩn hóa thành bảng khung giờ nếu cần truy vấn/phân tích riêng; sơ đồ giữ JSON để thể hiện cấu hình MVP hiện tại mà không khóa cách triển khai.
- `SCHEDULED_EVENT` chỉ biểu diễn lịch đã được áp dụng. Phương án xem trước nên là dữ liệu tạm hoặc một thực thể proposal riêng nếu cần lưu lịch sử/duyệt nhiều lần.
- Cần ràng buộc quyền sở hữu qua `user_id`, kiểm tra `start_at < end_at`, trạng thái/priority hợp lệ và chống xung đột ở tầng nghiệp vụ.
- Không lưu mật khẩu rõ; `password_hash` chỉ lưu giá trị đã băm ở backend. Refresh token/session, nếu triển khai, cần mô hình và chính sách thu hồi riêng.
