/**
 * PersonalPlanner - Data Store & LocalStorage Engine
 * Quản lý dữ liệu thời khóa biểu, công việc, người dùng và thuật toán tự động sắp xếp
 */

const STORAGE_KEYS = {
  USER: 'pp_user_data',
  CLASSES: 'pp_classes_data',
  TASKS: 'pp_tasks_data',
  SCHEDULED_EVENTS: 'pp_scheduled_events',
  NOTIFICATIONS: 'pp_notifications_data',
  AUTH_TOKEN: 'pp_jwt_token'
};

// Dữ liệu mẫu ban đầu
const INITIAL_DATA = {
  user: {
    id: 'usr_001',
    fullName: 'Dương Văn Thanh',
    email: 'td863166@gmail.com',
    studentId: '2022600123',
    major: 'Công nghệ thông tin',
    university: 'Đại học Quốc gia',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    preferredHours: {
      morning: { start: '08:00', end: '11:30', active: true },
      afternoon: { start: '14:00', end: '17:30', active: true },
      evening: { start: '19:30', end: '22:00', active: true }
    },
    breakMinutes: 15,
    emailReminder: true,
    browserReminder: true
  },

  classes: [
    {
      id: 'cls_001',
      title: 'Lập trình Web (Node.js & React)',
      code: 'IT3020',
      room: 'A2-301',
      lecturer: 'ThS. Nguyễn Văn A',
      dayOfWeek: 1, // Thứ 2 (0 = CN, 1 = T2, ...)
      startTime: '07:30',
      endTime: '10:00',
      color: '#4f46e5',
      notes: 'Mang theo laptop cài sẵn Node.js v20'
    },
    {
      id: 'cls_002',
      title: 'Cơ sở dữ liệu nâng cao',
      code: 'IT3040',
      room: 'B1-204',
      lecturer: 'TS. Trần Thị B',
      dayOfWeek: 3, // Thứ 4
      startTime: '13:30',
      endTime: '16:00',
      color: '#06b6d4',
      notes: 'Thực hành MySQL Workbench bài lab 3'
    },
    {
      id: 'cls_003',
      title: 'Trí tuệ nhân tạo (AI)',
      code: 'IT4010',
      room: 'C3-501',
      lecturer: 'PGS. TS. Lê Văn C',
      dayOfWeek: 5, // Thứ 6
      startTime: '08:00',
      endTime: '11:00',
      color: '#8b5cf6',
      notes: 'Thảo luận chuyên đề Tìm kiếm A* và Heuristic'
    },
    {
      id: 'cls_004',
      title: 'An toàn thông tin mạng',
      code: 'IT4080',
      room: 'Online MS Teams',
      lecturer: 'TS. Phạm Văn D',
      dayOfWeek: 6, // Thứ 7
      startTime: '09:00',
      endTime: '11:30',
      color: '#10b981',
      notes: 'Kiểm tra trắc nghiệm 15 phút đầu giờ'
    }
  ],

  tasks: [
    {
      id: 'tsk_001',
      title: 'Làm bài tập lớn Web - Xây dựng RESTful API',
      subject: 'Lập trình Web (Node.js & React)',
      priority: 'high', // urgent, high, medium, low
      status: 'inprogress', // todo, inprogress, done
      progress: 65,
      estimatedHours: 3.5,
      deadline: getRelativeDate(2, '23:59'),
      scheduled: false,
      scheduledTime: null,
      description: 'Hoàn thiện chức năng xác thực JWT, hash password bcrypt và middleware bảo vệ route.'
    },
    {
      id: 'tsk_002',
      title: 'Thiết kế mô hình quan hệ ERD CSDL',
      subject: 'Cơ sở dữ liệu nâng cao',
      priority: 'urgent',
      status: 'todo',
      progress: 15,
      estimatedHours: 2.0,
      deadline: getRelativeDate(1, '18:00'),
      scheduled: false,
      scheduledTime: null,
      description: 'Vẽ lược đồ ERD chuẩn hóa 3NF cho đồ án hệ thống quản lý kho hàng.'
    },
    {
      id: 'tsk_003',
      title: 'Ôn tập thuật toán A* và Cây trò chơi Minimax',
      subject: 'Trí tuệ nhân tạo (AI)',
      priority: 'medium',
      status: 'todo',
      progress: 0,
      estimatedHours: 2.5,
      deadline: getRelativeDate(4, '21:00'),
      scheduled: false,
      scheduledTime: null,
      description: 'Làm lại các bài tập tính toán hàm đánh giá f(n) = g(n) + h(n).'
    },
    {
      id: 'tsk_004',
      title: 'Báo cáo thực hành mã hóa bất đối xứng RSA',
      subject: 'An toàn thông tin mạng',
      priority: 'high',
      status: 'done',
      progress: 100,
      estimatedHours: 2.0,
      deadline: getRelativeDate(-1, '23:59'),
      scheduled: true,
      scheduledTime: { date: getRelativeDate(-2, '14:00'), duration: 2 },
      description: 'Đã nộp file PDF qua cổng LMS trường.'
    },
    {
      id: 'tsk_005',
      title: 'Đọc tài liệu React Query & Zustand state management',
      subject: 'Tự học',
      priority: 'low',
      status: 'todo',
      progress: 0,
      estimatedHours: 1.5,
      deadline: getRelativeDate(6, '22:00'),
      scheduled: false,
      scheduledTime: null,
      description: 'Tìm hiểu cách cache dữ liệu client và quản lý state không cần Redux.'
    }
  ],

  notifications: [
    {
      id: 'notif_001',
      title: 'Sắp đến hạn!',
      message: 'Công việc "Thiết kế mô hình quan hệ ERD CSDL" hết hạn vào ngày mai.',
      type: 'urgent',
      time: '15 phút trước',
      read: false
    },
    {
      id: 'notif_002',
      title: 'Nhắc nhở lịch học',
      message: 'Lịch học môn Lập trình Web diễn ra vào 07:30 sáng Thứ Hai tại A2-301.',
      type: 'info',
      time: '1 giờ trước',
      read: false
    },
    {
      id: 'notif_003',
      title: 'Chúc mừng!',
      message: 'Bạn đã hoàn thành 100% nhiệm vụ Báo cáo thực hành RSA.',
      type: 'success',
      time: '1 ngày trước',
      read: true
    }
  ]
};

// Utility tạo ngày tương đối định dạng ISO 'YYYY-MM-DDTHH:mm:ss'
function getRelativeDate(dayOffset, timeStr = '12:00') {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T${timeStr}:00`;
}

// Khởi tạo LocalStorage nếu chưa có
function initStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.USER)) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(INITIAL_DATA.user));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_DATA.classes));
  }
  if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_DATA.tasks));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_DATA.notifications));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SCHEDULED_EVENTS)) {
    localStorage.setItem(STORAGE_KEYS.SCHEDULED_EVENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'mock_jwt_token_session_active_123456');
  }
}

// Chạy khởi tạo ngay
initStorage();

const AppStore = {
  // === USER ===
  getUser() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER)) || INITIAL_DATA.user;
  },
  updateUser(userData) {
    const current = this.getUser();
    const updated = { ...current, ...userData };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
    return updated;
  },

  // === CLASSES (THỜI KHÓA BIỂU) ===
  getClasses() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES)) || [];
  },
  getClassById(id) {
    return this.getClasses().find(c => c.id === id);
  },
  addClass(classData) {
    const list = this.getClasses();
    const newClass = {
      id: 'cls_' + Date.now(),
      color: classData.color || '#4f46e5',
      ...classData
    };

    // Kiểm tra trùng lịch
    const conflict = this.checkClassConflict(newClass);
    if (conflict.hasConflict) {
      newClass.warning = `Trùng lịch với: ${conflict.conflictingEvent.title} (${conflict.conflictingEvent.startTime} - ${conflict.conflictingEvent.endTime})`;
    }

    list.push(newClass);
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(list));
    return { class: newClass, conflict };
  },
  updateClass(id, updatedData) {
    let list = this.getClasses();
    const index = list.findIndex(c => c.id === id);
    if (index === -1) return null;

    const merged = { ...list[index], ...updatedData };
    const conflict = this.checkClassConflict(merged, id);
    if (conflict.hasConflict) {
      merged.warning = `Trùng lịch với: ${conflict.conflictingEvent.title} (${conflict.conflictingEvent.startTime} - ${conflict.conflictingEvent.endTime})`;
    } else {
      delete merged.warning;
    }

    list[index] = merged;
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(list));
    return { class: merged, conflict };
  },
  deleteClass(id) {
    const list = this.getClasses().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(list));
    return true;
  },

  // Kiểm tra trùng lịch học
  checkClassConflict(classToCheck, excludeId = null) {
    const list = this.getClasses().filter(c => c.id !== excludeId);
    for (const c of list) {
      if (parseInt(c.dayOfWeek) === parseInt(classToCheck.dayOfWeek)) {
        // Kiểm tra overlap giữa [c.startTime, c.endTime] và [classToCheck.startTime, classToCheck.endTime]
        if (classToCheck.startTime < c.endTime && classToCheck.endTime > c.startTime) {
          return {
            hasConflict: true,
            conflictingEvent: c
          };
        }
      }
    }
    return { hasConflict: false };
  },

  // === TASKS (KẾ HOẠCH & CÔNG VIỆC) ===
  getTasks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || [];
  },
  getTaskById(id) {
    return this.getTasks().find(t => t.id === id);
  },
  addTask(taskData) {
    const tasks = this.getTasks();
    const newTask = {
      id: 'tsk_' + Date.now(),
      progress: parseInt(taskData.progress) || 0,
      priority: taskData.priority || 'medium',
      status: taskData.status || 'todo',
      scheduled: false,
      scheduledTime: null,
      ...taskData
    };
    tasks.unshift(newTask);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return newTask;
  },
  updateTask(id, updatedData) {
    let tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...updatedData };
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return tasks[index];
  },
  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return true;
  },

  // === NOTIFICATIONS ===
  getNotifications() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) || [];
  },
  markNotificationRead(id) {
    const list = this.getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    return list;
  },
  markAllNotificationsRead() {
    const list = this.getNotifications().map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    return list;
  },

  // === SCHEDULED EVENTS (CÔNG VIỆC ĐÃ TỰ ĐỘNG LÊN LỊCH) ===
  getScheduledEvents() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULED_EVENTS)) || [];
  },
  saveScheduledEvents(events) {
    localStorage.setItem(STORAGE_KEYS.SCHEDULED_EVENTS, JSON.stringify(events));
  },

  // === THUẬT TOÁN TỰ ĐỘNG SẮP XẾP LỊCH TRÌNH THÔNG MINH (SMART AUTO-SCHEDULING) ===
  /**
   * 1. Lọc công việc chưa hoàn thành và chưa được xếp lịch (hoặc xếp lại tất cả)
   * 2. Sắp xếp thứ tự ưu tiên (Urgent -> High -> Medium -> Low) & Hạn chót (Deadline gần nhất trước)
   * 3. Lấy toàn bộ thời khóa biểu cố định trong tuần để tránh trùng
   * 4. Tìm các khoảng thời gian trống theo khung giờ ưa thích của người dùng (sáng/chiều/tối)
   * 5. Phân bổ công việc vào các khoảng trống phù hợp với thời lượng (estimatedHours)
   */
  generateAutoSchedule(options = {}) {
    const daysToSchedule = options.days || 7; // Mặc định sắp xếp cho 7 ngày tới
    const breakMinutes = options.breakMinutes || 15;
    const user = this.getUser();
    const classes = this.getClasses();
    const tasks = this.getTasks().filter(t => t.status !== 'done');

    // Trọng số ưu tiên
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    // Sort tasks: Trọng số ưu tiên cao trước, sau đó đến Deadline sớm nhất
    const sortedTasks = [...tasks].sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return new Date(a.deadline || '2099-01-01') - new Date(b.deadline || '2099-01-01');
    });

    const proposedPlan = [];
    const occupiedSlotsByDate = {}; // 'YYYY-MM-DD': [{start: minutes, end: minutes, reason}]

    const now = new Date();
    // Khởi tạo các ngày cần xếp
    for (let i = 0; i < daysToSchedule; i++) {
      const cur = new Date(now);
      cur.setDate(now.getDate() + i);
      const dateStr = cur.toISOString().split('T')[0];
      const dayOfWeek = cur.getDay(); // 0 = CN, 1 = T2...

      occupiedSlotsByDate[dateStr] = [];

      // Thêm các lớp học cố định của ngày đó vào danh sách bận
      classes.forEach(cls => {
        if (parseInt(cls.dayOfWeek) === dayOfWeek) {
          occupiedSlotsByDate[dateStr].push({
            start: timeStringToMinutes(cls.startTime),
            end: timeStringToMinutes(cls.endTime),
            title: cls.title,
            type: 'class'
          });
        }
      });
    }

    // Các khung giờ rảnh theo cấu hình người dùng
    const studyWindows = [];
    if (user.preferredHours?.morning?.active) {
      studyWindows.push({
        start: timeStringToMinutes(user.preferredHours.morning.start),
        end: timeStringToMinutes(user.preferredHours.morning.end),
        label: 'Sáng'
      });
    }
    if (user.preferredHours?.afternoon?.active) {
      studyWindows.push({
        start: timeStringToMinutes(user.preferredHours.afternoon.start),
        end: timeStringToMinutes(user.preferredHours.afternoon.end),
        label: 'Chiều'
      });
    }
    if (user.preferredHours?.evening?.active) {
      studyWindows.push({
        start: timeStringToMinutes(user.preferredHours.evening.start),
        end: timeStringToMinutes(user.preferredHours.evening.end),
        label: 'Tối'
      });
    }

    // Thuật toán gán task vào slot
    for (const task of sortedTasks) {
      const taskDurationMinutes = Math.round((task.estimatedHours || 1.5) * 60);
      let scheduled = false;

      // Duyệt qua từng ngày từ hôm nay trở đi
      for (let i = 0; i < daysToSchedule; i++) {
        if (scheduled) break;

        const curDate = new Date(now);
        curDate.setDate(now.getDate() + i);
        const dateStr = curDate.toISOString().split('T')[0];

        // Nếu có deadline, không được xếp sau deadline
        if (task.deadline) {
          const taskDeadlineDate = new Date(task.deadline);
          if (curDate > taskDeadlineDate) {
            continue; // Bỏ qua nếu ngày này đã quá hạn
          }
        }

        const busyList = occupiedSlotsByDate[dateStr] || [];

        // Duyệt qua từng khung giờ học ưa thích trong ngày
        for (const window of studyWindows) {
          if (scheduled) break;

          // Tìm khoảng trống trong window
          let pointer = window.start;
          
          // Nếu là ngày hôm nay, pointer không được bắt đầu trước giờ hiện tại
          if (i === 0) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes() + 15;
            if (pointer < currentMinutes) {
              pointer = currentMinutes;
            }
          }

          while (pointer + taskDurationMinutes <= window.end) {
            const candidateEnd = pointer + taskDurationMinutes;

            // Kiểm tra xem khoảng [pointer, candidateEnd] có chạm vào busy slot nào không
            const isOverlap = busyList.some(busy => {
              return pointer < (busy.end + breakMinutes) && candidateEnd > (busy.start - breakMinutes);
            });

            if (!isOverlap) {
              // Tìm thấy khoảng trống hợp lệ!
              const startTimeStr = minutesToTimeString(pointer);
              const endTimeStr = minutesToTimeString(candidateEnd);

              proposedPlan.push({
                taskId: task.id,
                taskTitle: task.title,
                subject: task.subject,
                priority: task.priority,
                date: dateStr,
                startTime: startTimeStr,
                endTime: endTimeStr,
                durationMinutes: taskDurationMinutes,
                estimatedHours: task.estimatedHours,
                deadline: task.deadline
              });

              // Đánh dấu slot này đã bị chiếm
              busyList.push({
                start: pointer,
                end: candidateEnd,
                title: task.title,
                type: 'task'
              });

              scheduled = true;
              break;
            } else {
              // Dịch chuyển pointer lên 30 phút để tìm tiếp
              pointer += 30;
            }
          }
        }
      }
    }

    return proposedPlan;
  },

  // Áp dụng kết quả sắp xếp vào hệ thống
  applyProposedSchedule(proposedPlan) {
    const scheduledEvents = this.getScheduledEvents();
    const tasks = this.getTasks();

    proposedPlan.forEach(item => {
      // 1. Thêm vào danh sách sự kiện lên lịch
      const newEvent = {
        id: 'sch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        taskId: item.taskId,
        title: item.taskTitle,
        subject: item.subject,
        start: `${item.date}T${item.startTime}:00`,
        end: `${item.date}T${item.endTime}:00`,
        color: '#8b5cf6',
        isAutoScheduled: true
      };
      scheduledEvents.push(newEvent);

      // 2. Cập nhật task trạng thái scheduled
      const tIndex = tasks.findIndex(t => t.id === item.taskId);
      if (tIndex !== -1) {
        tasks[tIndex].scheduled = true;
        tasks[tIndex].scheduledTime = {
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime
        };
      }
    });

    this.saveScheduledEvents(scheduledEvents);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));

    // Thêm thông báo
    const notifs = this.getNotifications();
    notifs.unshift({
      id: 'notif_' + Date.now(),
      title: 'Tự động sắp xếp thành công!',
      message: `Đã tự động phân bổ ${proposedPlan.length} công việc vào thời khóa biểu thông minh.`,
      type: 'success',
      time: 'Vừa xong',
      read: false
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));

    return true;
  },

  // === AI VISION SCANNER - QUÉT THỜI KHÓA BIỂU TỪ ẢNH ===
  batchAddClasses(classList) {
    const added = [];
    const conflicts = [];
    classList.forEach(c => {
      const res = this.addClass(c);
      added.push(res.class);
      if (res.conflict && res.conflict.hasConflict) {
        conflicts.push({ class: res.class, conflictingWith: res.conflict.conflictingEvent });
      }
    });

    const notifs = this.getNotifications();
    notifs.unshift({
      id: 'notif_' + Date.now(),
      title: 'Nhập TKB từ AI thành công!',
      message: `Đã thêm thành công ${added.length} môn học từ ảnh vào Thời khóa biểu.`,
      type: 'success',
      time: 'Vừa xong',
      read: false
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));

    return { added, conflicts };
  },

  // Mô phỏng trí tuệ nhân tạo OCR nhận diện bảng thời khóa biểu từ ảnh
  async simulateAIScanSchedule(imageSrc) {
    // Giả lập độ trễ AI phân tích ảnh thị giác máy tính
    await new Promise(r => setTimeout(r, 1600));

    // Kết quả nhận diện cấu trúc các môn học phổ biến từ ảnh TKB
    const mockRecognizedClasses = [
      {
        tempId: 'ai_' + Math.random().toString(36).substr(2, 5),
        title: 'Phát triển ứng dụng di động (Flutter / Android)',
        code: 'IT4520',
        room: 'B2-405',
        lecturer: 'TS. Hoàng Minh Đức',
        dayOfWeek: 2, // Thứ 3
        startTime: '07:30',
        endTime: '10:00',
        color: '#6366f1',
        confidence: 98,
        selected: true
      },
      {
        tempId: 'ai_' + Math.random().toString(36).substr(2, 5),
        title: 'Khai phá dữ liệu & Học máy (Machine Learning)',
        code: 'IT4220',
        room: 'C1-302',
        lecturer: 'PGS. TS. Trần Văn Kiên',
        dayOfWeek: 4, // Thứ 5
        startTime: '09:45',
        endTime: '12:15',
        color: '#ec4899',
        confidence: 96,
        selected: true
      },
      {
        tempId: 'ai_' + Math.random().toString(36).substr(2, 5),
        title: 'Hệ điều hành mã nguồn mở Linux',
        code: 'IT3180',
        room: 'Lab 5-PM',
        lecturer: 'ThS. Đỗ Quang Linh',
        dayOfWeek: 5, // Thứ 6
        startTime: '13:30',
        endTime: '16:00',
        color: '#14b8a6',
        confidence: 94,
        selected: true
      },
      {
        tempId: 'ai_' + Math.random().toString(36).substr(2, 5),
        title: 'Kỹ nghệ phần mềm ứng dụng',
        code: 'IT3090',
        room: 'A3-102',
        lecturer: 'TS. Vũ Thu Hà',
        dayOfWeek: 6, // Thứ 7
        startTime: '13:00',
        endTime: '15:30',
        color: '#f59e0b',
        confidence: 92,
        selected: true
      }
    ];

    return {
      success: true,
      rawText: 'Thời khóa biểu Học kỳ 1 - Năm học 2026-2027\nNgành: Công nghệ thông tin\nNhận diện 4 lớp học phần...',
      classes: mockRecognizedClasses
    };
  }
};

// Hàm phụ trợ chuyển đổi giờ
function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Export cho browser global
window.AppStore = AppStore;

