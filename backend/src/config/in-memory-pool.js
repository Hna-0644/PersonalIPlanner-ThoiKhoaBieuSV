const { DateTime } = require('luxon');
const { toSqlUtcString, nowUtc } = require('../utils/timezone');

function parseUtcDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    if (val.endsWith('Z')) return new Date(val);
    const s = val.trim().replace(' ', 'T');
    return new Date(s.endsWith('Z') ? s : `${s}Z`);
  }
  return new Date(val);
}

function cloneState(obj) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // Fallback JSON clone
    }
  }
  return JSON.parse(JSON.stringify(obj));
}

function createInitialState() {
  const nowIso = toSqlUtcString(nowUtc());
  const plus1Day = toSqlUtcString(nowUtc().plus({ days: 1 }));
  const plus2Days = toSqlUtcString(nowUtc().plus({ days: 2 }));
  const plus4Days = toSqlUtcString(nowUtc().plus({ days: 4 }));
  const minus1Day = toSqlUtcString(nowUtc().minus({ days: 1 }));
  const minus2Days = toSqlUtcString(nowUtc().minus({ days: 2 }));
  const minus2DaysPlus2Hours = toSqlUtcString(nowUtc().minus({ days: 2 }).plus({ hours: 2 }));

  return {
    users: [
      {
        id: 1,
        full_name: 'Nguyễn Minh An',
        email: 'demo@personalplanner.local',
        password_hash: '$2a$10$mIgRlNOwEQndso/tFFNO2ez3LWNzk8KkIRNZxhNJBwy4LvQ6FKg/G',
        student_id: '2026000001',
        student_year: 3,
        major: 'Công nghệ thông tin',
        university: 'Trường Đại học Nguyễn Tất Thành',
        avatar: null,
        created_at: nowIso,
        updated_at: nowIso
      }
    ],
    preferences: [
      {
        user_id: 1,
        preferred_hours: {
          morning: { active: true, start: '08:00', end: '11:30' },
          afternoon: { active: true, start: '14:00', end: '17:30' },
          evening: { active: true, start: '19:30', end: '22:00' }
        },
        break_minutes: 15,
        timezone: 'Asia/Ho_Chi_Minh',
        email_reminder: true,
        browser_reminder: true
      }
    ],
    subjects: [
      {
        id: 1,
        course_code: 'IT3020',
        subject_name: 'Lập trình Web (Node.js & React)',
        school_code: 'NTTU',
        created_at: nowIso
      },
      {
        id: 2,
        course_code: 'IT3040',
        subject_name: 'Cơ sở dữ liệu nâng cao',
        school_code: 'NTTU',
        created_at: nowIso
      },
      {
        id: 3,
        course_code: 'IT4010',
        subject_name: 'Trí tuệ nhân tạo (AI)',
        school_code: 'NTTU',
        created_at: nowIso
      },
      {
        id: 4,
        course_code: 'IT4080',
        subject_name: 'An toàn thông tin mạng',
        school_code: 'NTTU',
        created_at: nowIso
      }
    ],
    class_sections: [
      { class_code: 'IT3020', subject_id: 1, created_at: nowIso },
      { class_code: 'IT3020.01', subject_id: 1, created_at: nowIso },
      { class_code: 'IT3040', subject_id: 2, created_at: nowIso },
      { class_code: 'IT3040.01', subject_id: 2, created_at: nowIso },
      { class_code: 'IT4010', subject_id: 3, created_at: nowIso },
      { class_code: 'IT4010.01', subject_id: 3, created_at: nowIso },
      { class_code: 'IT4080', subject_id: 4, created_at: nowIso },
      { class_code: 'IT4080.01', subject_id: 4, created_at: nowIso }
    ],
    classes: [
      {
        id: 1,
        user_id: 1,
        title: 'Lập trình Web (Node.js & React)',
        code: 'IT3020',
        subject_id: 1,
        room: 'L.504',
        lecturer: 'ThS. Bùi Duy Tân',
        day_of_week: 1,
        start_time: '07:30:00',
        end_time: '10:00:00',
        semester_start: null,
        semester_end: null,
        color: '#0d7480',
        notes: 'Mang theo laptop cài sẵn Node.js v20'
      },
      {
        id: 2,
        user_id: 1,
        title: 'Cơ sở dữ liệu nâng cao',
        code: 'IT3040',
        subject_id: 2,
        room: 'L2.124',
        lecturer: 'PGS. TS. Trần Văn Kiên',
        day_of_week: 3,
        start_time: '13:30:00',
        end_time: '16:00:00',
        semester_start: null,
        semester_end: null,
        color: '#1d5bd6',
        notes: 'Thực hành MySQL bài lab 3'
      },
      {
        id: 3,
        user_id: 1,
        title: 'Trí tuệ nhân tạo (AI)',
        code: 'IT4010',
        subject_id: 3,
        room: 'L2.212',
        lecturer: 'TS. Vũ Thu Hà',
        day_of_week: 5,
        start_time: '08:00:00',
        end_time: '11:00:00',
        semester_start: null,
        semester_end: null,
        color: '#1f3038',
        notes: 'Thảo luận chuyên đề Tìm kiếm A* và Heuristic'
      }
    ],
    work_schedules: [
      {
        id: 1,
        user_id: 1,
        title: 'Ca làm thêm Quán Cafe',
        workplace: 'Highlands Coffee Nguyễn Tất Thành',
        day_of_week: 2,
        work_date: null,
        start_time: '18:00:00',
        end_time: '22:00:00',
        start_date: null,
        end_date: null,
        color: '#b45309',
        notes: 'Ca tối Thứ Ba hàng tuần',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 2,
        user_id: 1,
        title: 'Trợ giảng Lab CNTT',
        workplace: 'Phòng Lab L.407B',
        day_of_week: 4,
        work_date: null,
        start_time: '14:00:00',
        end_time: '17:00:00',
        start_date: null,
        end_date: null,
        color: '#0d7480',
        notes: 'Hỗ trợ sinh viên khóa dưới thực hành Web & SQL',
        created_at: nowIso,
        updated_at: nowIso
      }
    ],
    tasks: [
      {
        id: 1,
        user_id: 1,
        title: 'Làm bài tập lớn Web - Xây dựng RESTful API',
        subject: 'Lập trình Web (Node.js & React)',
        description: 'Hoàn thiện chức năng xác thực JWT và bảo vệ route.',
        priority: 'high',
        status: 'inprogress',
        progress: 65,
        estimated_hours: 2.0,
        deadline: plus2Days,
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 2,
        user_id: 1,
        title: 'Thiết kế mô hình quan hệ ERD CSDL',
        subject: 'Cơ sở dữ liệu nâng cao',
        description: 'Vẽ lược đồ ERD chuẩn hóa 3NF cho đồ án hệ thống quản lý.',
        priority: 'urgent',
        status: 'todo',
        progress: 15,
        estimated_hours: 1.5,
        deadline: plus1Day,
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 3,
        user_id: 1,
        title: 'Ôn tập thuật toán A* và Cây trò chơi Minimax',
        subject: 'Trí tuệ nhân tạo (AI)',
        description: 'Làm lại các bài tập tính toán hàm đánh giá f(n).',
        priority: 'medium',
        status: 'todo',
        progress: 0,
        estimated_hours: 2.0,
        deadline: plus4Days,
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 4,
        user_id: 1,
        title: 'Báo cáo thực hành mã hóa bất đối xứng RSA',
        subject: 'An toàn thông tin mạng',
        description: 'Đã nộp file PDF qua cổng LMS.',
        priority: 'high',
        status: 'done',
        progress: 100,
        estimated_hours: 2.0,
        deadline: minus1Day,
        created_at: nowIso,
        updated_at: nowIso
      }
    ],
    scheduled_events: [
      {
        id: 1,
        user_id: 1,
        task_id: 4,
        title: 'Báo cáo thực hành mã hóa bất đối xứng RSA',
        subject: 'An toàn thông tin mạng',
        start_at: minus2Days,
        end_at: minus2DaysPlus2Hours,
        source: 'auto',
        color: '#0f7d45',
        created_at: nowIso
      }
    ],
    notifications: [
      {
        id: 1,
        user_id: 1,
        type: 'urgent',
        title: 'Sắp đến hạn!',
        message: 'Công việc "Thiết kế mô hình quan hệ ERD CSDL" hết hạn vào ngày mai.',
        read_at: null,
        scheduled_at: nowIso,
        delivery_status: 'scheduled',
        created_at: nowIso
      },
      {
        id: 2,
        user_id: 1,
        type: 'info',
        title: 'Nhắc nhở lịch học',
        message: 'Lịch học môn Lập trình Web diễn ra vào 07:30 sáng Thứ Hai tại L.504.',
        read_at: null,
        scheduled_at: nowIso,
        delivery_status: 'scheduled',
        created_at: nowIso
      }
    ],
    course_reviews: [
      {
        id: 1,
        subject_id: 1,
        user_id: 1,
        lecturer_name: 'ThS. Lê Hải Đăng',
        rating: 5,
        difficulty: 3,
        attendance_required: 1,
        grading_notes: 'Điểm danh mỗi buổi 10%, Lab hàng tuần 20%, Đồ án cuối kỳ 70%.',
        materials_notes: 'Repo mẫu của giảng viên NTTU + Sách Fullstack Open.',
        content: 'Khối lượng bài tập tuần tại Đại học Nguyễn Tất Thành khá vừa sức và giúp chắc tay code. Cần chú ý xử lý lỗi validation và phân quyền ở Backend.',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 2,
        subject_id: 2,
        user_id: 1,
        lecturer_name: 'PGS. TS. Trần Văn Kiên',
        rating: 5,
        difficulty: 4,
        attendance_required: 1,
        grading_notes: 'Thi viết giữa kỳ 30% (Tối ưu câu lệnh SQL & Indexing), Thi cuối kỳ 70%.',
        materials_notes: 'Giáo trình Cơ sở dữ liệu nâng cao + Slide Transaction & Concurrency Control.',
        content: 'Phần B-Tree Index, Query Execution Plan và Isolation Levels rất hay, đi phỏng vấn Backend gần như chắc chắn được hỏi.',
        created_at: nowIso,
        updated_at: nowIso
      }
    ],
    class_posts: [
      {
        id: 1,
        subject_id: 1,
        class_code: 'IT3020',
        user_id: 1,
        title: 'Cách xử lý làm mới Access Token tự động khi gọi API?',
        content: 'Mọi người cho mình hỏi trong bài tập lớn phần xác thực JWT, nên xử lý refresh token ở interceptor hay middleware thế nào để tránh lặp vô hạn khi token hết hạn?',
        upvote_count: 3,
        created_at: nowIso
      },
      {
        id: 2,
        subject_id: 2,
        class_code: 'IT3040',
        user_id: 1,
        title: 'Kinh nghiệm thiết kế Composite Index cho bài Lab 3',
        content: 'Khi truy vấn kết hợp WHERE status = ? AND subject_tag = ? ORDER BY created_at DESC thì thứ tự cột trong Composite Index nên đặt thế nào để tránh Using filesort?',
        upvote_count: 5,
        created_at: nowIso
      }
    ],
    post_comments: [
      {
        id: 1,
        post_id: 1,
        user_id: 1,
        content: 'Mình đã giải quyết được bằng cách dùng cờ _retry trên request config và hàng đợi Promise cho các request đồng thời!',
        upvote_count: 2,
        created_at: nowIso
      },
      {
        id: 2,
        post_id: 2,
        user_id: 1,
        content: 'Đặt các cột lọc bằng (=) trước rồi đến cột ORDER BY: INDEX (status, subject_tag, created_at DESC) giúp EXPLAIN đạt chuẩn index scan.',
        upvote_count: 4,
        created_at: nowIso
      }
    ],
    post_votes: [],
    comment_votes: [],
    marketplace_items: [
      {
        id: 1,
        user_id: 1,
        subject_id: 2,
        subject_tag: 'IT3040 - Cơ sở dữ liệu nâng cao',
        title: 'Giáo trình Database System Concepts (7th Edition)',
        description: 'Sách in màu bìa cứng còn mới 95%, có đánh dấu highlight các chương Indexing, B+Tree và Transaction.',
        category: 'textbook',
        price: 120000,
        contact_info: 'Zalo: 0912345678 (Minh An)',
        image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
        status: 'available',
        created_at: nowIso,
        updated_at: nowIso
      },
      {
        id: 2,
        user_id: 1,
        subject_id: 1,
        subject_tag: 'IT3020 - Lập trình Web',
        title: '[MIỄN PHÍ] Bộ Slide & Sổ tay tổng hợp RESTful API + JWT Security',
        description: 'Tặng miễn phí bộ ghi chú chi tiết các mẫu thiết kế kiến trúc Node.js, Express và checklist bảo mật OWASP.',
        category: 'slides',
        price: 0,
        contact_info: 'Email: demo@personalplanner.local',
        image_url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80',
        status: 'available',
        created_at: nowIso,
        updated_at: nowIso
      }
    ],
    study_documents: [
      {
        id: 1,
        user_id: 1,
        university: 'Trường Đại học Nguyễn Tất Thành',
        academic_year: '2025-2026',
        source_url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
        subject_code: 'IT3020',
        subject_name: 'Lập trình Web (Node.js & React)',
        title: 'Tài liệu tổng hợp kiến trúc RESTful API, Express.js & Bảo mật JWT',
        description: 'Tổng hợp chuẩn thiết kế REST API, phân tầng Controller-Service-Repository, xác thực JWT và phòng chống IDOR.',
        category: 'lecture_notes',
        original_name: null,
        storage_name: null,
        mime_type: null,
        file_size: null,
        created_at: nowIso
      },
      {
        id: 2,
        user_id: 1,
        university: 'Trường Đại học Nguyễn Tất Thành',
        academic_year: '2025-2026',
        source_url: 'https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html',
        subject_code: 'IT3040',
        subject_name: 'Cơ sở dữ liệu nâng cao',
        title: 'Đề cương ôn tập Tối ưu hóa truy vấn SQL, B+Tree Index & Transaction Isolation',
        description: 'Tóm tắt lý thuyết kèm 30 bài tập phân tích EXPLAIN Plan và khóa giao dịch SELECT ... FOR UPDATE.',
        category: 'summaries',
        original_name: null,
        storage_name: null,
        mime_type: null,
        file_size: null,
        created_at: nowIso
      },
      {
        id: 3,
        user_id: 1,
        university: 'Đại học Quốc gia Hà Nội',
        academic_year: '2025-2026',
        source_url: 'https://aima.cs.berkeley.edu/',
        subject_code: 'IT4010',
        subject_name: 'Trí tuệ nhân tạo (AI)',
        title: 'Tuyển tập đề thi cuối kỳ & lời giải chi tiết Giải thuật tìm kiếm A*, Minimax, Alpha-Beta',
        description: 'Bộ đề thi các năm kèm hướng dẫn từng bước duyệt cây tìm kiếm và tính hàm Heuristic.',
        category: 'past_exams',
        original_name: null,
        storage_name: null,
        mime_type: null,
        file_size: null,
        created_at: nowIso
      }
    ],
    study_document_bookmarks: []
  };
}

function createInMemoryPool() {
  const state = createInitialState();
  const nextIds = {
    users: 10,
    classes: 10,
    work_schedules: 10,
    tasks: 10,
    scheduled_events: 10,
    notifications: 10,
    course_reviews: 10,
    class_posts: 10,
    post_comments: 10,
    post_votes: 10,
    comment_votes: 10,
    marketplace_items: 10,
    study_documents: 10
  };

  function getUser(userId) {
    return state.users.find(u => Number(u.id) === Number(userId)) || null;
  }

  function enrichWithUploader(doc, currentUserId = null) {
    const uploader = getUser(doc.user_id);
    const isBookmarked = currentUserId
      ? state.study_document_bookmarks.some(
          b => Number(b.user_id) === Number(currentUserId) && Number(b.document_id) === Number(doc.id)
        )
      : false;
    return {
      ...doc,
      uploader_name: uploader ? uploader.full_name : 'Sinh viên',
      uploader_university: uploader ? uploader.university : doc.university,
      uploader_student_year: uploader ? uploader.student_year : null,
      is_bookmarked: isBookmarked ? 1 : 0
    };
  }

  function filterStudyDocuments(params, hasBookmarkedCheck) {
    // When hasBookmarkedCheck is true (the main SELECT rows query), params[0] is userId for is_bookmarked,
    // and the last two params are limit and offset.
    return state.study_documents;
  }

  async function execute(sql, params = []) {
    const s = String(sql || '').toLowerCase().replace(/\s+/g, ' ').trim();

    if (s.startsWith('select 1')) {
      return [[{ 1: 1 }], []];
    }

    // User row lock
    if (s.includes('select id from users') && s.includes('for update')) {
      const userId = Number(params[0]);
      const user = getUser(userId);
      return [user ? [{ id: user.id }] : [], []];
    }

    // Auth & Profile
    if (s.includes('from users u') && s.includes('join study_preferences p')) {
      const userId = Number(params[0]);
      const user = getUser(userId);
      if (!user) return [[], []];
      const pref = state.preferences.find(p => Number(p.user_id) === userId) || state.preferences[0];
      return [[{
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        student_id: user.student_id,
        student_year: user.student_year ?? null,
        major: user.major,
        university: user.university,
        avatar: user.avatar,
        preferred_hours: pref.preferred_hours,
        break_minutes: pref.break_minutes,
        timezone: pref.timezone,
        email_reminder: pref.email_reminder,
        browser_reminder: pref.browser_reminder
      }], []];
    }

    if (s.includes('from users where email =')) {
      const email = String(params[0] || '').trim().toLowerCase();
      const user = state.users.find(u => String(u.email).toLowerCase() === email);
      return [user ? [user] : [], []];
    }

    if (s.includes('select university from users where id =')) {
      const user = getUser(params[0]);
      return [user ? [{ university: user.university }] : [], []];
    }

    if (s.startsWith('insert into users')) {
      const [fullName, email, passwordHash, studentId] = params;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (state.users.some(u => String(u.email).toLowerCase() === cleanEmail)) {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      const id = nextIds.users++;
      const nowIso = toSqlUtcString(nowUtc());
      state.users.push({
        id,
        full_name: fullName,
        email: cleanEmail,
        password_hash: passwordHash,
        student_id: studentId || null,
        student_year: null,
        major: null,
        university: 'Trường Đại học Nguyễn Tất Thành',
        avatar: null,
        created_at: nowIso,
        updated_at: nowIso
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('insert into study_preferences')) {
      const [userId, prefHours] = params;
      const parsedHours = typeof prefHours === 'string' ? JSON.parse(prefHours) : prefHours;
      state.preferences.push({
        user_id: Number(userId),
        preferred_hours: parsedHours,
        break_minutes: 15,
        timezone: 'Asia/Ho_Chi_Minh',
        email_reminder: true,
        browser_reminder: true
      });
      return [{ affectedRows: 1 }, []];
    }

    if (s.startsWith('update users set')) {
      const userId = Number(params[params.length - 1]);
      const user = getUser(userId);
      if (!user) return [{ affectedRows: 0 }, []];
      const setPart = sql.match(/update users set (.+) where id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        if (col in user) {
          user[col] = params[idx];
        }
      });
      user.updated_at = toSqlUtcString(nowUtc());
      return [{ affectedRows: 1 }, []];
    }

    if (s.startsWith('update study_preferences set')) {
      const userId = Number(params[params.length - 1]);
      let pref = state.preferences.find(p => Number(p.user_id) === userId);
      if (!pref) {
        pref = { ...cloneState(state.preferences[0]), user_id: userId };
        state.preferences.push(pref);
      }
      const setPart = sql.match(/update study_preferences set (.+) where user_id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        const val = params[idx];
        if (col === 'preferred_hours') {
          pref.preferred_hours = typeof val === 'string' ? JSON.parse(val) : val;
        } else if (col in pref) {
          pref[col] = val;
        }
      });
      return [{ affectedRows: 1 }, []];
    }

    if (s.includes('from study_preferences')) {
      const userId = Number(params[0]);
      const pref = state.preferences.find(p => Number(p.user_id) === userId) || state.preferences[0];
      return [[pref], []];
    }

    // Classes
    if (s.includes('from classes')) {
      if (s.startsWith('delete from classes')) {
        const [classId, userId] = params.map(Number);
        const before = state.classes.length;
        state.classes = state.classes.filter(c => !(Number(c.id) === classId && Number(c.user_id) === userId));
        return [{ affectedRows: before - state.classes.length }, []];
      }
      if (s.includes('where id = ? and user_id = ?')) {
        const [classId, userId] = params.map(Number);
        const found = state.classes.find(c => Number(c.id) === classId && Number(c.user_id) === userId);
        return [found ? [found] : [], []];
      }
      if (s.includes('day_of_week = ?') && s.includes('start_time < ?')) {
        const userId = Number(params[0]);
        const dayOfWeek = Number(params[1]);
        const endTime = String(params[2]);
        const startTime = String(params[3]);
        const excludeId = params[params.length - 1];
        const conflicts = state.classes.filter(c => {
          if (Number(c.user_id) !== userId || Number(c.day_of_week) !== dayOfWeek) return false;
          if (excludeId !== null && excludeId !== undefined && Number(c.id) === Number(excludeId)) return false;
          return String(c.start_time).slice(0, 5) < endTime.slice(0, 5) &&
            String(c.end_time).slice(0, 5) > startTime.slice(0, 5);
        });
        return [conflicts, []];
      }
      const userId = Number(params[0]);
      const rows = state.classes
        .filter(c => Number(c.user_id) === userId)
        .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)));
      return [rows, []];
    }

    if (s.startsWith('insert into classes')) {
      const id = nextIds.classes++;
      const [userId, title, code, room, lecturer, dayOfWeek, startTime, endTime, semStart, semEnd, color, notes] = params;
      state.classes.push({
        id,
        user_id: Number(userId),
        title,
        code: code || null,
        room: room || null,
        lecturer: lecturer || null,
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        semester_start: semStart || null,
        semester_end: semEnd || null,
        color: color || '#0d7480',
        notes: notes || null
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update classes set')) {
      const userId = Number(params[params.length - 1]);
      const classId = Number(params[params.length - 2]);
      const cls = state.classes.find(c => Number(c.id) === classId && Number(c.user_id) === userId);
      if (!cls) return [{ affectedRows: 0 }, []];
      const setPart = sql.match(/update classes set (.+) where id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        cls[col] = params[idx];
      });
      return [{ affectedRows: 1 }, []];
    }

    // Work schedules
    if (s.includes('from work_schedules')) {
      if (s.startsWith('delete from work_schedules')) {
        const [workId, userId] = params.map(Number);
        const before = state.work_schedules.length;
        state.work_schedules = state.work_schedules.filter(w => !(Number(w.id) === workId && Number(w.user_id) === userId));
        return [{ affectedRows: before - state.work_schedules.length }, []];
      }
      if (s.includes('where id = ? and user_id = ?')) {
        const [workId, userId] = params.map(Number);
        const found = state.work_schedules.find(w => Number(w.id) === workId && Number(w.user_id) === userId);
        return [found ? [found] : [], []];
      }
      const userId = Number(params[0]);
      const rows = state.work_schedules.filter(w => Number(w.user_id) === userId);
      return [rows, []];
    }

    if (s.startsWith('insert into work_schedules')) {
      const id = nextIds.work_schedules++;
      const [userId, title, workplace, dayOfWeek, workDate, startTime, endTime, startDate, endDate, color, notes] = params;
      const nowIso = toSqlUtcString(nowUtc());
      state.work_schedules.push({
        id,
        user_id: Number(userId),
        title,
        workplace: workplace || null,
        day_of_week: dayOfWeek !== null && dayOfWeek !== undefined ? Number(dayOfWeek) : null,
        work_date: workDate || null,
        start_time: startTime,
        end_time: endTime,
        start_date: startDate || null,
        end_date: endDate || null,
        color: color || '#b45309',
        notes: notes || null,
        created_at: nowIso,
        updated_at: nowIso
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update work_schedules set')) {
      const userId = Number(params[params.length - 1]);
      const workId = Number(params[params.length - 2]);
      const wrk = state.work_schedules.find(w => Number(w.id) === workId && Number(w.user_id) === userId);
      if (!wrk) return [{ affectedRows: 0 }, []];
      const setPart = sql.match(/update work_schedules set (.+) where id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        wrk[col] = params[idx];
      });
      wrk.updated_at = toSqlUtcString(nowUtc());
      return [{ affectedRows: 1 }, []];
    }

    // Tasks
    if (s.includes('from tasks')) {
      if (s.startsWith('delete from tasks')) {
        const [taskId, userId] = params.map(Number);
        const before = state.tasks.length;
        state.tasks = state.tasks.filter(t => !(Number(t.id) === taskId && Number(t.user_id) === userId));
        return [{ affectedRows: before - state.tasks.length }, []];
      }
      if (s.includes('where id = ? and user_id = ?')) {
        const [taskId, userId] = params.map(Number);
        const found = state.tasks.find(t => Number(t.id) === taskId && Number(t.user_id) === userId);
        return [found ? [found] : [], []];
      }
      if (s.includes('id in (')) {
        const userId = Number(params[0]);
        const ids = params.slice(1).map(Number);
        const rows = state.tasks.filter(t => Number(t.user_id) === userId && ids.includes(Number(t.id)));
        return [rows, []];
      }
      if (s.includes("status in ('todo', 'inprogress')") && s.includes('deadline >=')) {
        const userId = Number(params[0]);
        const lower = parseUtcDate(params[1]).getTime();
        const upper = parseUtcDate(params[2]).getTime();
        const rows = state.tasks.filter(t => {
          if (Number(t.user_id) !== userId) return false;
          if (!['todo', 'inprogress'].includes(t.status) || !t.deadline) return false;
          const dl = parseUtcDate(t.deadline).getTime();
          return dl >= lower && dl <= upper;
        });
        return [rows, []];
      }
      const userId = Number(params[0]);
      const rows = state.tasks.filter(t => Number(t.user_id) === userId);
      return [rows, []];
    }

    if (s.startsWith('insert into tasks')) {
      const id = nextIds.tasks++;
      const colMatch = sql.match(/insert into tasks\s*\(([^)]+)\)/i);
      const cols = colMatch ? colMatch[1].split(',').map(c => c.trim().toLowerCase()) : [];
      const nowIso = toSqlUtcString(nowUtc());
      const record = {
        id,
        user_id: Number(params[0]),
        title: '',
        subject: null,
        description: null,
        priority: 'medium',
        status: 'todo',
        progress: 0,
        estimated_hours: 1.5,
        deadline: null,
        created_at: nowIso,
        updated_at: nowIso
      };
      cols.forEach((col, idx) => {
        const val = params[idx];
        if (col === 'user_id') record.user_id = Number(val);
        else if (col === 'deadline') record.deadline = val ? toSqlUtcString(parseUtcDate(val)) : null;
        else if (col in record) record[col] = val;
      });
      state.tasks.push(record);
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update tasks set')) {
      const userId = Number(params[params.length - 1]);
      const taskId = Number(params[params.length - 2]);
      const task = state.tasks.find(t => Number(t.id) === taskId && Number(t.user_id) === userId);
      if (!task) return [{ affectedRows: 0 }, []];
      const setPart = sql.match(/update tasks set (.+) where id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        const val = params[idx];
        if (col === 'deadline') task.deadline = val ? toSqlUtcString(parseUtcDate(val)) : null;
        else if (col in task) task[col] = val;
      });
      task.updated_at = toSqlUtcString(nowUtc());
      return [{ affectedRows: 1 }, []];
    }

    // Scheduled events
    if (s.includes('from scheduled_events')) {
      const userId = Number(params[0]);
      if (s.includes('task_id in (')) {
        const ids = params.slice(1).map(Number);
        const rows = state.scheduled_events
          .filter(e => Number(e.user_id) === userId && ids.includes(Number(e.task_id)))
          .map(e => ({ task_id: e.task_id }));
        return [rows, []];
      }
      const rows = state.scheduled_events.filter(e => Number(e.user_id) === userId);
      return [rows, []];
    }

    if (s.startsWith('insert into scheduled_events')) {
      const id = nextIds.scheduled_events++;
      const [userId, taskId, title, subject, startAt, endAt] = params;
      state.scheduled_events.push({
        id,
        user_id: Number(userId),
        task_id: Number(taskId),
        title,
        subject,
        start_at: startAt,
        end_at: endAt,
        source: 'auto',
        color: '#1f3038',
        created_at: toSqlUtcString(nowUtc())
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    // Notifications
    if (s.includes('from notifications')) {
      const userId = Number(params[0]);
      if (s.includes('where user_id = ? and read_at is null and title = ? and message = ?')) {
        const [, title, message] = params;
        const found = state.notifications.find(
          n => Number(n.user_id) === userId && n.read_at === null && n.title === title && n.message === message
        );
        return [found ? [found] : [], []];
      }
      if (s.includes('where id = ? and user_id = ?')) {
        const [notifId, uId] = params.map(Number);
        const found = state.notifications.find(n => Number(n.id) === notifId && Number(n.user_id) === uId);
        return [found ? [found] : [], []];
      }
      const rows = state.notifications
        .filter(n => Number(n.user_id) === userId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return [rows, []];
    }

    if (s.startsWith('insert into notifications')) {
      const id = nextIds.notifications++;
      const nowIso = toSqlUtcString(nowUtc());
      if (s.includes("'success'")) {
        const [userId, title, message] = params;
        state.notifications.unshift({
          id,
          user_id: Number(userId),
          type: 'success',
          title,
          message,
          read_at: null,
          scheduled_at: nowIso,
          delivery_status: 'scheduled',
          created_at: nowIso
        });
      } else {
        const [userId, type, title, message, scheduledAt, deliveryStatus] = params;
        state.notifications.unshift({
          id,
          user_id: Number(userId),
          type: type || 'info',
          title,
          message,
          read_at: null,
          scheduled_at: scheduledAt || nowIso,
          delivery_status: deliveryStatus || 'scheduled',
          created_at: nowIso
        });
      }
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update notifications set')) {
      const nowIso = toSqlUtcString(nowUtc());
      if (s.includes('where id = ? and user_id = ?')) {
        const [notifId, userId] = params.map(Number);
        const found = state.notifications.find(n => Number(n.id) === notifId && Number(n.user_id) === userId);
        if (found) {
          found.read_at = found.read_at || nowIso;
          return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
      }
      const userId = Number(params[0]);
      let count = 0;
      state.notifications.forEach(n => {
        if (Number(n.user_id) === userId && !n.read_at) {
          n.read_at = nowIso;
          count += 1;
        }
      });
      return [{ affectedRows: count }, []];
    }

    // Subjects & Community Reviews & Q&A
    if (s.includes('from subjects where id =')) {
      const subjectId = Number(params[0]);
      const sub = state.subjects.find(item => Number(item.id) === subjectId);
      return [sub ? [sub] : [], []];
    }

    if (s.includes('avg(rating) as avg_rating') && s.includes('from course_reviews')) {
      const subjectId = Number(params[0]);
      const uniFilter = params[1] ? String(params[1]).trim() : null;
      const list = state.course_reviews.filter(r => {
        if (Number(r.subject_id) !== subjectId) return false;
        if (!uniFilter) return true;
        const u = getUser(r.user_id);
        return (u?.university || '').trim() === uniFilter;
      });
      if (!list.length) {
        return [[{ avg_rating: null, total_reviews: 0, attendance_rate: 0 }], []];
      }
      const avgRating = list.reduce((acc, r) => acc + Number(r.rating), 0) / list.length;
      const attendanceRate = (list.filter(r => Boolean(r.attendance_required)).length / list.length) * 100;
      return [[{
        avg_rating: Number(avgRating.toFixed(2)),
        total_reviews: list.length,
        attendance_rate: Number(attendanceRate.toFixed(2))
      }], []];
    }

    if (s.includes('from course_reviews')) {
      if (s.startsWith('delete from course_reviews')) {
        const [userId, subjectId] = params.map(Number);
        const before = state.course_reviews.length;
        state.course_reviews = state.course_reviews.filter(
          r => !(Number(r.user_id) === userId && Number(r.subject_id) === subjectId)
        );
        return [{ affectedRows: before - state.course_reviews.length }, []];
      }
      if (s.includes('count(*) as total')) {
        const subjectId = Number(params[0]);
        const uniFilter = params[1] ? String(params[1]).trim() : null;
        const total = state.course_reviews.filter(r => {
          if (Number(r.subject_id) !== subjectId) return false;
          if (!uniFilter) return true;
          const u = getUser(r.user_id);
          return (u?.university || '').trim() === uniFilter;
        }).length;
        return [[{ total }], []];
      }
      if (s.includes('where course_reviews.id = ?')) {
        const reviewId = Number(params[0]);
        const found = state.course_reviews.find(r => Number(r.id) === reviewId);
        if (!found) return [[], []];
        const u = getUser(found.user_id);
        return [[{ ...found, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null }], []];
      }
      if (s.includes('where course_reviews.user_id = ? and course_reviews.subject_id = ?')) {
        const [userId, subjectId] = params.map(Number);
        const found = state.course_reviews.find(r => Number(r.user_id) === userId && Number(r.subject_id) === subjectId);
        if (!found) return [[], []];
        const u = getUser(found.user_id);
        return [[{ ...found, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null }], []];
      }
      const subjectId = Number(params[0]);
      const hasUni = s.includes('trim(u.university) = ?');
      const uniFilter = hasUni ? String(params[1]).trim() : null;
      const limit = Number(params[hasUni ? 2 : 1] || 20);
      const offset = Number(params[hasUni ? 3 : 2] || 0);
      const rows = state.course_reviews
        .filter(r => {
          if (Number(r.subject_id) !== subjectId) return false;
          if (!uniFilter) return true;
          const u = getUser(r.user_id);
          return (u?.university || '').trim() === uniFilter;
        })
        .map(r => {
          const u = getUser(r.user_id);
          return { ...r, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null };
        })
        .slice(offset, offset + limit);
      return [rows, []];
    }

    if (s.startsWith('insert into course_reviews')) {
      const [subjectId, userId, lecturerName, rating, difficulty, attendanceRequired, gradingNotes, materialsNotes, content] = params;
      if (state.course_reviews.some(r => Number(r.user_id) === Number(userId) && Number(r.subject_id) === Number(subjectId))) {
        const err = new Error('Duplicate entry for key uq_course_reviews_user_subject');
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
      const id = nextIds.course_reviews++;
      const nowIso = toSqlUtcString(nowUtc());
      state.course_reviews.unshift({
        id,
        subject_id: Number(subjectId),
        user_id: Number(userId),
        lecturer_name: lecturerName,
        rating: Number(rating),
        difficulty: Number(difficulty),
        attendance_required: attendanceRequired ? 1 : 0,
        grading_notes: gradingNotes,
        materials_notes: materialsNotes,
        content,
        created_at: nowIso,
        updated_at: nowIso
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update course_reviews set')) {
      const subjectId = Number(params[params.length - 1]);
      const userId = Number(params[params.length - 2]);
      const rev = state.course_reviews.find(r => Number(r.user_id) === userId && Number(r.subject_id) === subjectId);
      if (!rev) return [{ affectedRows: 0 }, []];
      const setPart = sql.match(/update course_reviews set (.+) where user_id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        rev[col] = params[idx];
      });
      rev.updated_at = toSqlUtcString(nowUtc());
      return [{ affectedRows: 1 }, []];
    }

    // Class sections & Class posts
    if (s.startsWith('insert into class_sections')) {
      const [classCode, subjectId] = params;
      if (!state.class_sections.some(cs => cs.class_code === classCode)) {
        state.class_sections.push({
          class_code: classCode,
          subject_id: Number(subjectId),
          created_at: toSqlUtcString(nowUtc())
        });
      }
      return [{ affectedRows: 1 }, []];
    }

    if (s.includes('from class_sections where class_code =')) {
      const classCode = String(params[0]);
      const found = state.class_sections.find(cs => cs.class_code === classCode);
      return [found ? [found] : [], []];
    }

    if (s.includes('from class_posts')) {
      if (s.startsWith('delete from class_posts')) {
        const [postId, userId] = params.map(Number);
        const before = state.class_posts.length;
        state.class_posts = state.class_posts.filter(p => !(Number(p.id) === postId && Number(p.user_id) === userId));
        return [{ affectedRows: before - state.class_posts.length }, []];
      }
      if (s.includes('count(*) as total')) {
        const classCode = String(params[0]);
        const total = state.class_posts.filter(p => p.class_code === classCode).length;
        return [[{ total }], []];
      }
      if (s.includes('where id = ? and user_id = ?')) {
        const [postId, userId] = params.map(Number);
        const found = state.class_posts.find(p => Number(p.id) === postId && Number(p.user_id) === userId);
        return [found ? [found] : [], []];
      }
      if (s.includes('where class_posts.id = ?') || s.includes('where id = ?')) {
        const postId = Number(params[0]);
        const found = state.class_posts.find(p => Number(p.id) === postId);
        if (!found) return [[], []];
        const u = getUser(found.user_id);
        return [[{ ...found, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null }], []];
      }
      const classCode = String(params[0]);
      const limit = Number(params[1] || 20);
      const offset = Number(params[2] || 0);
      const rows = state.class_posts
        .filter(p => p.class_code === classCode)
        .map(p => {
          const u = getUser(p.user_id);
          return { ...p, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null };
        })
        .slice(offset, offset + limit);
      return [rows, []];
    }

    if (s.startsWith('insert into class_posts')) {
      const [subjectId, classCode, userId, title, content] = params;
      const id = nextIds.class_posts++;
      state.class_posts.unshift({
        id,
        subject_id: Number(subjectId),
        class_code: classCode,
        user_id: Number(userId),
        title,
        content,
        upvote_count: 0,
        created_at: toSqlUtcString(nowUtc())
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update class_posts set upvote_count')) {
      const postId = Number(params[0]);
      const post = state.class_posts.find(p => Number(p.id) === postId);
      if (post) {
        if (s.includes('upvote_count + 1')) post.upvote_count += 1;
        else post.upvote_count = Math.max(0, post.upvote_count - 1);
      }
      return [{ affectedRows: post ? 1 : 0 }, []];
    }

    // Post comments & votes
    if (s.includes('from post_comments')) {
      if (s.includes('count(*) as total')) {
        const postId = Number(params[0]);
        const total = state.post_comments.filter(c => Number(c.post_id) === postId).length;
        return [[{ total }], []];
      }
      if (s.includes('where post_comments.id = ?') || s.includes('where id = ?')) {
        const commentId = Number(params[0]);
        const found = state.post_comments.find(c => Number(c.id) === commentId);
        if (!found) return [[], []];
        const u = getUser(found.user_id);
        return [[{ ...found, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null }], []];
      }
      const postId = Number(params[0]);
      const limit = Number(params[1] || 20);
      const offset = Number(params[2] || 0);
      const rows = state.post_comments
        .filter(c => Number(c.post_id) === postId)
        .map(c => {
          const u = getUser(c.user_id);
          return { ...c, author_name: u?.full_name || 'Sinh viên', author_university: u?.university || null };
        })
        .slice(offset, offset + limit);
      return [rows, []];
    }

    if (s.startsWith('insert into post_comments')) {
      const [postId, userId, content] = params;
      const id = nextIds.post_comments++;
      state.post_comments.push({
        id,
        post_id: Number(postId),
        user_id: Number(userId),
        content,
        upvote_count: 0,
        created_at: toSqlUtcString(nowUtc())
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update post_comments set upvote_count')) {
      const commentId = Number(params[0]);
      const cmt = state.post_comments.find(c => Number(c.id) === commentId);
      if (cmt) {
        if (s.includes('upvote_count + 1')) cmt.upvote_count += 1;
        else cmt.upvote_count = Math.max(0, cmt.upvote_count - 1);
      }
      return [{ affectedRows: cmt ? 1 : 0 }, []];
    }

    if (s.includes('from post_votes')) {
      const [postId, userId] = params.map(Number);
      if (s.startsWith('delete from post_votes')) {
        state.post_votes = state.post_votes.filter(v => !(Number(v.post_id) === postId && Number(v.user_id) === userId));
        return [{ affectedRows: 1 }, []];
      }
      const found = state.post_votes.find(v => Number(v.post_id) === postId && Number(v.user_id) === userId);
      return [found ? [found] : [], []];
    }

    if (s.startsWith('insert into post_votes')) {
      const [postId, userId] = params.map(Number);
      state.post_votes.push({ id: nextIds.post_votes++, post_id: postId, user_id: userId });
      return [{ affectedRows: 1 }, []];
    }

    if (s.includes('from comment_votes')) {
      const [commentId, userId] = params.map(Number);
      if (s.startsWith('delete from comment_votes')) {
        state.comment_votes = state.comment_votes.filter(
          v => !(Number(v.comment_id) === commentId && Number(v.user_id) === userId)
        );
        return [{ affectedRows: 1 }, []];
      }
      const found = state.comment_votes.find(v => Number(v.comment_id) === commentId && Number(v.user_id) === userId);
      return [found ? [found] : [], []];
    }

    if (s.startsWith('insert into comment_votes')) {
      const [commentId, userId] = params.map(Number);
      state.comment_votes.push({ id: nextIds.comment_votes++, comment_id: commentId, user_id: userId });
      return [{ affectedRows: 1 }, []];
    }

    // Marketplace items
    if (s.includes('from marketplace_items')) {
      if (s.startsWith('delete from marketplace_items')) {
        const [itemId, userId] = params.map(Number);
        const before = state.marketplace_items.length;
        state.marketplace_items = state.marketplace_items.filter(
          m => !(Number(m.id) === itemId && Number(m.user_id) === userId)
        );
        return [{ affectedRows: before - state.marketplace_items.length }, []];
      }
      if (s.includes('where m.id = ? and m.user_id = ?')) {
        const [itemId, userId] = params.map(Number);
        const found = state.marketplace_items.find(m => Number(m.id) === itemId && Number(m.user_id) === userId);
        if (!found) return [[], []];
        const u = getUser(found.user_id);
        return [[{ ...found, seller_name: u?.full_name || 'Sinh viên', seller_university: u?.university || null }], []];
      }
      if (s.includes('where m.id = ?')) {
        const itemId = Number(params[0]);
        const found = state.marketplace_items.find(m => Number(m.id) === itemId);
        if (!found) return [[], []];
        const u = getUser(found.user_id);
        return [[{ ...found, seller_name: u?.full_name || 'Sinh viên', seller_university: u?.university || null }], []];
      }
      if (s.includes('where m.user_id = ?')) {
        const userId = Number(params[0]);
        const rows = state.marketplace_items
          .filter(m => Number(m.user_id) === userId)
          .map(m => {
            const u = getUser(m.user_id);
            return { ...m, seller_name: u?.full_name || 'Sinh viên', seller_university: u?.university || null };
          });
        return [rows, []];
      }
      const status = params[0] || 'available';
      const rows = state.marketplace_items
        .filter(m => m.status === status)
        .map(m => {
          const u = getUser(m.user_id);
          return { ...m, seller_name: u?.full_name || 'Sinh viên', seller_university: u?.university || null };
        });
      if (s.includes('count(*) as total')) {
        return [[{ total: rows.length }], []];
      }
      return [rows, []];
    }

    if (s.startsWith('insert into marketplace_items')) {
      const [userId, subjectId, subjectTag, title, description, category, price, contactInfo, imageUrl] = params;
      const id = nextIds.marketplace_items++;
      const nowIso = toSqlUtcString(nowUtc());
      state.marketplace_items.unshift({
        id,
        user_id: Number(userId),
        subject_id: subjectId,
        subject_tag: subjectTag,
        title,
        description,
        category: category || 'textbook',
        price: Number(price || 0),
        contact_info: contactInfo,
        image_url: imageUrl || null,
        status: 'available',
        created_at: nowIso,
        updated_at: nowIso
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('update marketplace_items')) {
      const userId = Number(params[params.length - 1]);
      const itemId = Number(params[params.length - 2]);
      const item = state.marketplace_items.find(m => Number(m.id) === itemId && Number(m.user_id) === userId);
      if (!item) return [{ affectedRows: 0 }, []];
      const setPart = sql.match(/update marketplace_items set (.+) where id =/i)?.[1] || '';
      const cols = setPart.split(',').map(part => part.split('=')[0].trim().toLowerCase());
      cols.forEach((col, idx) => {
        item[col] = params[idx];
      });
      item.updated_at = toSqlUtcString(nowUtc());
      return [{ affectedRows: 1 }, []];
    }

    // Study Documents & Bookmarks
    if (s.includes('select distinct coalesce') && s.includes('from study_documents')) {
      const universities = [...new Set(
        state.study_documents
          .map(d => d.university || getUser(d.user_id)?.university)
          .filter(Boolean)
      )].sort();
      return [universities.map(u => ({ university: u })), []];
    }

    if (s.includes('select distinct academic_year from study_documents')) {
      const years = [...new Set(state.study_documents.map(d => d.academic_year).filter(Boolean))].sort().reverse();
      return [years.map(y => ({ academic_year: y })), []];
    }

    if (s.includes('select subject_code as code, max(subject_name) as name from study_documents')) {
      const map = new Map();
      state.study_documents.forEach(d => {
        if (d.subject_code) map.set(d.subject_code, d.subject_name || d.subject_code);
      });
      const rows = [...map.entries()].map(([code, name]) => ({ code, name }));
      return [rows, []];
    }

    if (s.includes('from study_documents d')) {
      if (s.includes('where d.id = ?')) {
        const docId = Number(params[0]);
        const found = state.study_documents.find(d => Number(d.id) === docId);
        return [found ? [enrichWithUploader(found)] : [], []];
      }

      const isCount = s.includes('count(*) as total');
      const currentUserId = isCount ? null : params[0];
      let idx = isCount ? 0 : 1;

      const filterSubjectCode = s.includes('d.subject_code = ?') ? params[idx++] : null;
      const filterUniversity = s.includes('coalesce(nullif(trim(d.university)') ? params[idx++] : null;
      const filterAcademicYear = s.includes('d.academic_year = ?') ? params[idx++] : null;
      const filterStudentYear = s.includes('u.student_year = ?') ? Number(params[idx++]) : null;
      const filterCategory = s.includes('d.category = ?') ? params[idx++] : null;
      let filterKeyword = null;
      if (s.includes('d.title like ?')) {
        filterKeyword = String(params[idx] || '').replace(/^%|%$/g, '').toLowerCase();
        idx += 8;
      }
      const filterSavedOnlyUserId = s.includes('where b.user_id = ? and b.document_id = d.id') &&
        (isCount || s.indexOf('where b.user_id = ?') !== s.lastIndexOf('where b.user_id = ?'))
        ? Number(params[idx++])
        : null;

      const filtered = state.study_documents.filter(d => {
        const u = getUser(d.user_id);
        const docUni = (d.university || u?.university || '').trim();
        if (filterSubjectCode && d.subject_code !== filterSubjectCode) return false;
        if (filterUniversity && docUni !== filterUniversity) return false;
        if (filterAcademicYear && d.academic_year !== filterAcademicYear) return false;
        if (filterStudentYear && Number(u?.student_year) !== filterStudentYear) return false;
        if (filterCategory && d.category !== filterCategory) return false;
        if (filterKeyword) {
          const hay = [
            d.title, d.description, d.subject_code, d.subject_name,
            d.original_name, d.university, d.academic_year, u?.university
          ].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(filterKeyword)) return false;
        }
        if (filterSavedOnlyUserId) {
          const saved = state.study_document_bookmarks.some(
            b => Number(b.user_id) === filterSavedOnlyUserId && Number(b.document_id) === Number(d.id)
          );
          if (!saved) return false;
        }
        return true;
      });

      if (isCount) {
        return [[{ total: filtered.length }], []];
      }

      const limit = Number(params[params.length - 2] || 12);
      const offset = Number(params[params.length - 1] || 0);
      const rows = filtered
        .map(d => enrichWithUploader(d, currentUserId))
        .slice(offset, offset + limit);
      return [rows, []];
    }

    if (s.startsWith('insert into study_documents')) {
      const [
        userId, university, academicYear, subjectCode, subjectName,
        title, description, category, originalName, storageName, mimeType, fileSize, sourceUrl
      ] = params;
      const id = nextIds.study_documents++;
      state.study_documents.unshift({
        id,
        user_id: Number(userId),
        university,
        academic_year: academicYear,
        subject_code: subjectCode,
        subject_name: subjectName,
        title,
        description,
        category,
        original_name: originalName,
        storage_name: storageName,
        mime_type: mimeType,
        file_size: fileSize,
        source_url: sourceUrl,
        created_at: toSqlUtcString(nowUtc())
      });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (s.startsWith('insert into study_document_bookmarks')) {
      const [userId, documentId] = params.map(Number);
      if (!state.study_document_bookmarks.some(b => Number(b.user_id) === userId && Number(b.document_id) === documentId)) {
        state.study_document_bookmarks.push({
          user_id: userId,
          document_id: documentId,
          created_at: toSqlUtcString(nowUtc())
        });
      }
      return [{ affectedRows: 1 }, []];
    }

    if (s.startsWith('delete from study_document_bookmarks')) {
      const [userId, documentId] = params.map(Number);
      state.study_document_bookmarks = state.study_document_bookmarks.filter(
        b => !(Number(b.user_id) === userId && Number(b.document_id) === documentId)
      );
      return [{ affectedRows: 1 }, []];
    }

    return [[], []];
  }

  return {
    isInMemoryFallback: true,
    execute,
    query: execute,
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        execute,
        query: execute
      };
    },
    async end() {}
  };
}

module.exports = { createInMemoryPool };
