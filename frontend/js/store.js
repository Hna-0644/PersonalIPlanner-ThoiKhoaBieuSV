/**
 * PersonalPlanner - Per-User Data Store & Backend Sync Engine
 * Quản lý dữ liệu phân tách riêng biệt theo từng tài khoản người dùng (Không dùng Mock Data chung)
 */

const LEGACY_SHARED_KEYS = [
  'pp_user_data',
  'pp_classes_data',
  'pp_tasks_data',
  'pp_scheduled_events',
  'pp_notifications_data'
];

const ACTIVE_USER_SCOPE_KEY = 'pp_active_user_scope';
const ACCOUNTS_REGISTRY_KEY = 'pp_accounts_registry';
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

function getAccountsRegistry() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_REGISTRY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAccountsRegistry(list) {
  try {
    localStorage.setItem(ACCOUNTS_REGISTRY_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

function encodeBase64Url(obj) {
  const str = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildClientJwtToken(userId) {
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    sub: String(userId),
    iss: 'personalplanner-api',
    aud: 'personalplanner-client',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  });
  return `${header}.${payload}.local_sig`;
}

const DEFAULT_PREFERRED_HOURS = {
  morning: { start: '08:00', end: '11:30', active: true },
  afternoon: { start: '14:00', end: '17:30', active: true },
  evening: { start: '19:30', end: '22:00', active: true }
};

// Xóa dữ liệu Mock dùng chung cũ để đảm bảo mỗi người dùng có không gian dữ liệu độc lập
function purgeLegacyMockData() {
  try {
    LEGACY_SHARED_KEYS.forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

purgeLegacyMockData();

// Chuẩn hóa bảng màu Design Taste (loại bỏ tím violet)
function sanitizeColor(hex) {
  if (!hex || typeof hex !== 'string') return '#0d7480';
  const low = hex.toLowerCase();
  if (/^#(4f46|6366)/.test(low)) return '#0d7480';
  if (/^#(8b5c|7c3a|a855)/.test(low)) return '#1f3038';
  return hex;
}

// Giải mã JWT token để lấy định danh người dùng (sub: 'usr_1', 'usr_2', ...)
function extractScopeFromToken() {
  try {
    const token =
      localStorage.getItem('pp_jwt_token') ||
      sessionStorage.getItem('pp_jwt_token') ||
      '';
    if (!token) return '';
    const parts = token.split('.');
    if (parts.length < 2) return '';
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return json && json.sub ? String(json.sub) : '';
  } catch {
    return '';
  }
}

function getCurrentUserScope() {
  const fromToken = extractScopeFromToken();
  if (fromToken) {
    try {
      localStorage.setItem(ACTIVE_USER_SCOPE_KEY, fromToken);
    } catch { /* ignore */ }
    return fromToken;
  }
  try {
    return localStorage.getItem(ACTIVE_USER_SCOPE_KEY) || 'guest';
  } catch {
    return 'guest';
  }
}

function getScopedKey(entity, customScope = null) {
  const scope = customScope || getCurrentUserScope();
  return `pp_u_${scope}_${entity}`;
}

function readScopedJson(entity, fallback) {
  const scope = getCurrentUserScope();
  if (scope === 'guest') return fallback;
  try {
    const raw = localStorage.getItem(getScopedKey(entity, scope));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeScopedJson(entity, value, customScope = null) {
  const scope = customScope || getCurrentUserScope();
  if (scope === 'guest') return;
  try {
    localStorage.setItem(getScopedKey(entity, scope), JSON.stringify(value));
  } catch (err) {
    console.error(`Lỗi lưu trữ dữ liệu [${entity}]:`, err);
  }
}

function formatRelativeNotificationTime(isoStr) {
  if (!isoStr) return 'Vừa xong';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return String(isoStr);
  const diffMinutes = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function toIsoDeadlineForApi(deadlineVal) {
  if (!deadlineVal) return null;
  const d = new Date(deadlineVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalDeadlineForUI(isoVal) {
  if (!isoVal) return null;
  const d = new Date(isoVal);
  if (Number.isNaN(d.getTime())) return isoVal;
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 19);
}

function isBackendOnlineSession() {
  return Boolean(
    window.ApiService &&
      ApiService.isAuthenticated() &&
      !String(ApiService.getToken()).endsWith('.local_sig')
  );
}

// Làm mới giao diện trang hiện tại sau khi đồng bộ dữ liệu người dùng từ Server
function triggerPageRefresh() {
  try {
    if (typeof window.initUserUI === 'function') window.initUserUI();
    if (typeof window.renderNotifications === 'function') window.renderNotifications();
    if (typeof window.renderDashboardData === 'function') {
      const searchEl = document.getElementById('globalSearchInput');
      window.renderDashboardData(searchEl ? searchEl.value.trim() : '');
    }
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.populateSubjectFilter === 'function') {
      const select = document.getElementById('filterSubjectSelect');
      if (select) {
        const currentVal = select.value;
        select.innerHTML = '<option value="all">Tất cả môn học</option>';
        window.populateSubjectFilter();
        select.value = currentVal;
      }
    }
    if (typeof window.loadProfileData === 'function') window.loadProfileData();
    if (typeof window.loadUserHoursPreview === 'function') window.loadUserHoursPreview();
    if (typeof window.renderUnassignedTasks === 'function') window.renderUnassignedTasks();
    if (window.calendar && typeof window.calendar.refetchEvents === 'function') {
      window.calendar.refetchEvents();
    }
    if (typeof window.checkBannerConflict === 'function') window.checkBannerConflict();
    window.dispatchEvent(new CustomEvent('pp:store-synced'));
  } catch (err) {
    console.warn('UI refresh error:', err);
  }
}

const AppStore = {
  // === QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG ĐỘC LẬP (HỖ TRỢ ĐỒNG BỘ SERVER & OFFLINE FALLBACK) ===
  registerLocalAccount({ fullName, email, studentId, password }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const accounts = getAccountsRegistry();
    if (accounts.some(acc => acc.email === cleanEmail)) {
      const err = new Error('Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.');
      err.status = 409;
      throw err;
    }

    const userId = 'usr_' + Date.now();
    const newUser = {
      id: userId,
      fullName: String(fullName || '').trim() || 'Người dùng',
      email: cleanEmail,
      studentId: studentId ? String(studentId).trim() : '',
      major: '',
      university: '',
      avatar: DEFAULT_AVATAR,
      preferredHours: DEFAULT_PREFERRED_HOURS,
      breakMinutes: 15,
      timezone: 'Asia/Ho_Chi_Minh',
      emailReminder: true,
      browserReminder: true
    };

    accounts.push({
      id: userId,
      email: cleanEmail,
      password: String(password),
      user: newUser
    });
    saveAccountsRegistry(accounts);

    this.setCurrentUserSession(newUser, { isNewUser: true });
    const accessToken = buildClientJwtToken(userId);
    return { user: newUser, accessToken, tokenType: 'Bearer' };
  },

  loginLocalAccount(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const accounts = getAccountsRegistry();
    const found = accounts.find(acc => acc.email === cleanEmail);
    if (!found || found.password !== String(password)) {
      const err = new Error('Email hoặc mật khẩu không chính xác.');
      err.status = 401;
      throw err;
    }

    const storedUser = readScopedJson('user', found.user);
    this.setCurrentUserSession(storedUser || found.user);
    const accessToken = buildClientJwtToken(found.id);
    return { user: storedUser || found.user, accessToken, tokenType: 'Bearer' };
  },

  syncAccountRegistryUser(userObj, rawPassword = null) {
    if (!userObj || !userObj.email) return;
    const cleanEmail = String(userObj.email).trim().toLowerCase();
    const accounts = getAccountsRegistry();
    const idx = accounts.findIndex(acc => acc.email === cleanEmail || acc.id === userObj.id);
    if (idx === -1) {
      accounts.push({
        id: userObj.id,
        email: cleanEmail,
        password: rawPassword || '',
        user: userObj
      });
    } else {
      accounts[idx] = {
        ...accounts[idx],
        id: userObj.id || accounts[idx].id,
        email: cleanEmail,
        ...(rawPassword ? { password: rawPassword } : {}),
        user: { ...accounts[idx].user, ...userObj }
      };
    }
    saveAccountsRegistry(accounts);
  },

  // === QUẢN LÝ PHIÊN NGƯỜI DÙNG & ĐỒNG BỘ SERVER ===
  setCurrentUserSession(userObj, options = {}) {
    if (!userObj) return;
    const scope = userObj.id || extractScopeFromToken() || userObj.email || 'user';
    try {
      localStorage.setItem(ACTIVE_USER_SCOPE_KEY, String(scope));
    } catch { /* ignore */ }

    const normalizedUser = {
      id: userObj.id || scope,
      fullName: userObj.fullName || 'Người dùng',
      email: userObj.email || '',
      studentId: userObj.studentId || '',
      major: userObj.major || '',
      university: userObj.university || '',
      avatar: userObj.avatar || DEFAULT_AVATAR,
      preferredHours: userObj.preferredHours || DEFAULT_PREFERRED_HOURS,
      breakMinutes: userObj.breakMinutes ?? 15,
      timezone: userObj.timezone || 'Asia/Ho_Chi_Minh',
      emailReminder: userObj.emailReminder !== false,
      browserReminder: userObj.browserReminder !== false
    };

    writeScopedJson('user', normalizedUser, scope);

    if (options.isNewUser) {
      writeScopedJson('classes', [], scope);
      writeScopedJson('tasks', [], scope);
      writeScopedJson('scheduled_events', [], scope);
      writeScopedJson('notifications', [], scope);
    }
  },

  clearCurrentUserSession() {
    try {
      localStorage.removeItem(ACTIVE_USER_SCOPE_KEY);
    } catch { /* ignore */ }
  },

  async syncFromServer() {
    if (!window.ApiService || !ApiService.isAuthenticated()) return false;
    const token = ApiService.getToken();
    if (String(token).endsWith('.local_sig')) {
      triggerPageRefresh();
      return true;
    }
    try {
      const [profile, classes, tasks, events, notifications, workSchedules] = await Promise.all([
        ApiService.getProfile({ silent: true }).catch(() => null),
        ApiService.getClasses({ silent: true }).catch(() => null),
        ApiService.getTasks({ silent: true }).catch(() => null),
        ApiService.getScheduledEvents({ silent: true }).catch(() => null),
        ApiService.getNotifications({ silent: true }).catch(() => null),
        (ApiService.getWorkSchedules ? ApiService.getWorkSchedules({ silent: true }) : Promise.resolve(null)).catch(() => null)
      ]);

      const scope = (profile && profile.id) || getCurrentUserScope();
      if (scope && scope !== 'guest') {
        localStorage.setItem(ACTIVE_USER_SCOPE_KEY, scope);
      }

      if (profile) {
        const existingLocalUser = readScopedJson('user', {});
        const localAvatar =
          existingLocalUser &&
          existingLocalUser.avatar &&
          existingLocalUser.avatar.startsWith('data:image/')
            ? existingLocalUser.avatar
            : null;

        writeScopedJson('user', {
          ...profile,
          avatar: profile.avatar || localAvatar || DEFAULT_AVATAR,
          preferredHours: profile.preferredHours || DEFAULT_PREFERRED_HOURS
        }, scope);
      }

      let mappedEvents = [];
      if (Array.isArray(events)) {
        mappedEvents = events.map(ev => ({
          id: ev.id,
          taskId: ev.taskId,
          title: ev.title,
          subject: ev.subject || '',
          start: toLocalDeadlineForUI(ev.start) || ev.start,
          end: toLocalDeadlineForUI(ev.end) || ev.end,
          color: sanitizeColor(ev.color || '#1f3038'),
          isAutoScheduled: ev.source === 'auto'
        }));
        writeScopedJson('scheduled_events', mappedEvents, scope);
      }

      if (Array.isArray(classes)) {
        const mappedClasses = classes.map(c => {
          const item = {
            id: c.id,
            title: c.title,
            code: c.code || '',
            room: c.room || '',
            lecturer: c.lecturer || '',
            dayOfWeek: Number(c.dayOfWeek),
            startTime: String(c.startTime || '07:30').slice(0, 5),
            endTime: String(c.endTime || '10:00').slice(0, 5),
            color: sanitizeColor(c.color || '#0d7480'),
            notes: c.notes || ''
          };
          return item;
        });
        writeScopedJson('classes', mappedClasses, scope);
      }

      if (Array.isArray(tasks)) {
        const scheduledByTaskId = new Map(mappedEvents.map(ev => [ev.taskId, ev]));
        const mappedTasks = tasks.map(t => {
          const ev = scheduledByTaskId.get(t.id);
          return {
            id: t.id,
            title: t.title,
            subject: t.subject || '',
            description: t.description || '',
            priority: t.priority || 'medium',
            status: t.status || 'todo',
            progress: Number(t.progress ?? 0),
            estimatedHours: t.estimatedHours !== null && t.estimatedHours !== undefined ? Number(t.estimatedHours) : 2.0,
            deadline: toLocalDeadlineForUI(t.deadline),
            scheduled: Boolean(ev),
            scheduledTime: ev
              ? {
                  date: String(ev.start).slice(0, 10),
                  startTime: String(ev.start).slice(11, 16),
                  endTime: String(ev.end).slice(11, 16)
                }
              : null
          };
        });
        writeScopedJson('tasks', mappedTasks, scope);
      }

      if (Array.isArray(notifications)) {
        const mappedNotifs = notifications.map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type || 'info',
          read: Boolean(n.read),
          time: formatRelativeNotificationTime(n.createdAt)
        }));
        writeScopedJson('notifications', mappedNotifs, scope);
      }

      if (Array.isArray(workSchedules)) {
        const mappedShifts = workSchedules.map(w => ({
          id: w.id,
          title: w.title,
          workplace: w.workplace || '',
          dayOfWeek: w.dayOfWeek !== null && w.dayOfWeek !== undefined ? Number(w.dayOfWeek) : null,
          workDate: w.workDate || null,
          startTime: String(w.startTime || '08:00').slice(0, 5),
          endTime: String(w.endTime || '12:00').slice(0, 5),
          startDate: w.startDate || null,
          endDate: w.endDate || null,
          color: sanitizeColor(w.color || '#b45309'),
          notes: w.notes || ''
        }));
        writeScopedJson('work_schedules', mappedShifts, scope);
      }

      triggerPageRefresh();
      return true;
    } catch (err) {
      console.warn('Không thể đồng bộ từ máy chủ:', err);
      return false;
    }
  },

  // === USER ===
  getUser() {
    const fallbackUser = {
      id: getCurrentUserScope(),
      fullName: 'Người dùng',
      email: '',
      studentId: '',
      major: '',
      university: '',
      avatar: DEFAULT_AVATAR,
      preferredHours: DEFAULT_PREFERRED_HOURS,
      breakMinutes: 15,
      timezone: 'Asia/Ho_Chi_Minh',
      emailReminder: true,
      browserReminder: true
    };
    return readScopedJson('user', fallbackUser) || fallbackUser;
  },

  updateUser(userData) {
    const current = this.getUser();
    const updated = { ...current, ...userData };
    writeScopedJson('user', updated);
    this.syncAccountRegistryUser(updated);

    if (isBackendOnlineSession()) {
      const apiPayload = {};
      if (userData.fullName !== undefined) apiPayload.fullName = userData.fullName;
      if (userData.email !== undefined && userData.email) apiPayload.email = userData.email;
      if (userData.studentId !== undefined) apiPayload.studentId = userData.studentId || null;
      if (userData.major !== undefined) apiPayload.major = userData.major || null;
      if (userData.university !== undefined) apiPayload.university = userData.university || null;
      if (userData.avatar !== undefined) apiPayload.avatar = userData.avatar || null;
      if (userData.preferredHours !== undefined) apiPayload.preferredHours = userData.preferredHours;
      if (userData.breakMinutes !== undefined) apiPayload.breakMinutes = Number(userData.breakMinutes);
      if (userData.emailReminder !== undefined) apiPayload.emailReminder = Boolean(userData.emailReminder);
      if (userData.browserReminder !== undefined) apiPayload.browserReminder = Boolean(userData.browserReminder);

      if (Object.keys(apiPayload).length > 0) {
        ApiService.updateProfile(apiPayload, { silent: true })
          .then(serverUser => {
            if (serverUser) {
              writeScopedJson('user', { ...updated, ...serverUser, avatar: updated.avatar || serverUser.avatar || DEFAULT_AVATAR });
            }
          })
          .catch(err => console.warn('Lưu hồ sơ lên server thất bại:', err));
      }
    }

    return updated;
  },

  // === CLASSES (THỜI KHÓA BIỂU) ===
  getClasses() {
    return readScopedJson('classes', []);
  },
  getClassById(id) {
    return this.getClasses().find(c => c.id === id);
  },
  addClass(classData) {
    const list = this.getClasses();
    const tempId = 'cls_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newClass = {
      id: tempId,
      title: classData.title,
      code: classData.code || '',
      room: classData.room || '',
      lecturer: classData.lecturer || '',
      dayOfWeek: Number(classData.dayOfWeek),
      startTime: String(classData.startTime || '07:30').slice(0, 5),
      endTime: String(classData.endTime || '10:00').slice(0, 5),
      color: sanitizeColor(classData.color || '#0d7480'),
      notes: classData.notes || ''
    };

    const conflict = this.checkClassConflict(newClass);
    if (conflict.hasConflict) {
      newClass.warning = `Trùng lịch với: ${conflict.conflictingEvent.title} (${conflict.conflictingEvent.startTime} - ${conflict.conflictingEvent.endTime})`;
    }

    list.push(newClass);
    writeScopedJson('classes', list);

    if (isBackendOnlineSession()) {
      ApiService.createClass({
        title: newClass.title,
        code: newClass.code || null,
        room: newClass.room || null,
        lecturer: newClass.lecturer || null,
        dayOfWeek: Number(newClass.dayOfWeek),
        startTime: newClass.startTime,
        endTime: newClass.endTime,
        color: newClass.color,
        notes: newClass.notes || null
      }, { silent: true })
        .then(serverClass => {
          if (serverClass && serverClass.id) {
            const currentList = this.getClasses().map(item =>
              item.id === tempId ? { ...item, id: serverClass.id } : item
            );
            writeScopedJson('classes', currentList);
            if (window.calendar && typeof window.calendar.refetchEvents === 'function') {
              window.calendar.refetchEvents();
            }
          }
        })
        .catch(err => console.warn('Không thể lưu môn học lên server:', err));
    }

    return { class: newClass, conflict };
  },

  updateClass(id, updatedData) {
    const list = this.getClasses();
    const index = list.findIndex(c => c.id === id);
    if (index === -1) return null;

    const merged = {
      ...list[index],
      ...updatedData,
      dayOfWeek: Number(updatedData.dayOfWeek ?? list[index].dayOfWeek),
      startTime: String(updatedData.startTime || list[index].startTime).slice(0, 5),
      endTime: String(updatedData.endTime || list[index].endTime).slice(0, 5),
      color: sanitizeColor(updatedData.color || list[index].color)
    };
    const conflict = this.checkClassConflict(merged, id);
    if (conflict.hasConflict) {
      merged.warning = `Trùng lịch với: ${conflict.conflictingEvent.title} (${conflict.conflictingEvent.startTime} - ${conflict.conflictingEvent.endTime})`;
    } else {
      delete merged.warning;
    }

    list[index] = merged;
    writeScopedJson('classes', list);

    if (isBackendOnlineSession() && /^cls_[1-9]\d*$/.test(id)) {
      ApiService.updateClass(id, {
        title: merged.title,
        code: merged.code || null,
        room: merged.room || null,
        lecturer: merged.lecturer || null,
        dayOfWeek: Number(merged.dayOfWeek),
        startTime: merged.startTime,
        endTime: merged.endTime,
        color: merged.color,
        notes: merged.notes || null
      }, { silent: true }).catch(err => console.warn('Không thể cập nhật môn học trên server:', err));
    }

    return { class: merged, conflict };
  },

  deleteClass(id) {
    const list = this.getClasses().filter(c => c.id !== id);
    writeScopedJson('classes', list);

    if (isBackendOnlineSession() && /^cls_[1-9]\d*$/.test(id)) {
      ApiService.deleteClass(id, { silent: true }).catch(err =>
        console.warn('Không thể xóa môn học trên server:', err)
      );
    }
    return true;
  },

  checkClassConflict(classToCheck, excludeId = null) {
    const list = this.getClasses().filter(c => c.id !== excludeId);
    for (const c of list) {
      if (parseInt(c.dayOfWeek) === parseInt(classToCheck.dayOfWeek)) {
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

  // === WORK SCHEDULES (LỊCH LÀM VIỆC / CA LÀM) ===
  getWorkSchedules() {
    return readScopedJson('work_schedules', []);
  },
  getWorkScheduleById(id) {
    return this.getWorkSchedules().find(s => s.id === id);
  },
  addWorkSchedule(shiftData) {
    const list = this.getWorkSchedules();
    const tempId = 'wrk_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newShift = {
      id: tempId,
      title: shiftData.title,
      workplace: shiftData.workplace || '',
      dayOfWeek: shiftData.dayOfWeek !== null && shiftData.dayOfWeek !== undefined && shiftData.dayOfWeek !== ''
        ? Number(shiftData.dayOfWeek)
        : null,
      workDate: shiftData.workDate || null,
      startTime: String(shiftData.startTime || '08:00').slice(0, 5),
      endTime: String(shiftData.endTime || '12:00').slice(0, 5),
      startDate: shiftData.startDate || null,
      endDate: shiftData.endDate || null,
      color: sanitizeColor(shiftData.color || '#b45309'),
      notes: shiftData.notes || ''
    };

    const conflict = this.checkWorkShiftConflict(newShift);
    if (conflict.hasConflict) {
      newShift.warning = `Trùng lịch với: ${conflict.conflictingEvent.title} (${conflict.conflictingEvent.startTime} - ${conflict.conflictingEvent.endTime})`;
    }

    list.push(newShift);
    writeScopedJson('work_schedules', list);

    if (isBackendOnlineSession()) {
      ApiService.createWorkSchedule({
        title: newShift.title,
        workplace: newShift.workplace || null,
        dayOfWeek: newShift.dayOfWeek !== null ? Number(newShift.dayOfWeek) : null,
        workDate: newShift.workDate || null,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        startDate: newShift.startDate || null,
        endDate: newShift.endDate || null,
        color: newShift.color,
        notes: newShift.notes || null
      }, { silent: true })
        .then(serverShift => {
          if (serverShift && serverShift.id) {
            const currentList = this.getWorkSchedules().map(item =>
              item.id === tempId ? { ...item, id: serverShift.id } : item
            );
            writeScopedJson('work_schedules', currentList);
            if (window.calendar && typeof window.calendar.refetchEvents === 'function') {
              window.calendar.refetchEvents();
            }
          }
        })
        .catch(err => console.warn('Không thể lưu ca làm việc lên server:', err));
    }

    return { shift: newShift, conflict };
  },

  updateWorkSchedule(id, updatedData) {
    const list = this.getWorkSchedules();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) return null;

    const merged = {
      ...list[index],
      ...updatedData,
      dayOfWeek: updatedData.dayOfWeek !== undefined
        ? (updatedData.dayOfWeek !== null && updatedData.dayOfWeek !== '' ? Number(updatedData.dayOfWeek) : null)
        : list[index].dayOfWeek,
      workDate: updatedData.workDate !== undefined ? (updatedData.workDate || null) : list[index].workDate,
      startTime: String(updatedData.startTime || list[index].startTime).slice(0, 5),
      endTime: String(updatedData.endTime || list[index].endTime).slice(0, 5),
      startDate: updatedData.startDate !== undefined ? (updatedData.startDate || null) : list[index].startDate,
      endDate: updatedData.endDate !== undefined ? (updatedData.endDate || null) : list[index].endDate,
      color: sanitizeColor(updatedData.color || list[index].color)
    };

    const conflict = this.checkWorkShiftConflict(merged, id);
    if (conflict.hasConflict) {
      merged.warning = `Trùng lịch với: ${conflict.conflictingEvent.title} (${conflict.conflictingEvent.startTime} - ${conflict.conflictingEvent.endTime})`;
    } else {
      delete merged.warning;
    }

    list[index] = merged;
    writeScopedJson('work_schedules', list);

    if (isBackendOnlineSession() && /^wrk_[1-9]\d*$/.test(id)) {
      ApiService.updateWorkSchedule(id, {
        title: merged.title,
        workplace: merged.workplace || null,
        dayOfWeek: merged.dayOfWeek !== null ? Number(merged.dayOfWeek) : null,
        workDate: merged.workDate || null,
        startTime: merged.startTime,
        endTime: merged.endTime,
        startDate: merged.startDate || null,
        endDate: merged.endDate || null,
        color: merged.color,
        notes: merged.notes || null
      }, { silent: true }).catch(err => console.warn('Không thể cập nhật ca làm việc trên server:', err));
    }

    return { shift: merged, conflict };
  },

  deleteWorkSchedule(id) {
    const list = this.getWorkSchedules().filter(s => s.id !== id);
    writeScopedJson('work_schedules', list);

    if (isBackendOnlineSession() && /^wrk_[1-9]\d*$/.test(id)) {
      ApiService.deleteWorkSchedule(id, { silent: true }).catch(err =>
        console.warn('Không thể xóa ca làm việc trên server:', err)
      );
    }
    return true;
  },

  checkWorkShiftConflict(shiftToCheck, excludeId = null) {
    const list = this.getWorkSchedules().filter(s => s.id !== excludeId);
    for (const s of list) {
      if (checkShiftsOverlap(shiftToCheck, s)) {
        return {
          hasConflict: true,
          conflictingEvent: s,
          conflictType: 'shift'
        };
      }
    }

    const classes = this.getClasses();
    for (const c of classes) {
      const classAsShift = {
        title: c.title,
        dayOfWeek: Number(c.dayOfWeek),
        startTime: c.startTime,
        endTime: c.endTime
      };
      if (checkShiftsOverlap(shiftToCheck, classAsShift)) {
        return {
          hasConflict: true,
          conflictingEvent: c,
          conflictType: 'class'
        };
      }
    }

    return { hasConflict: false };
  },

  // === TASKS (KẾ HOẠCH & CÔNG VIỆC) ===
  getTasks() {
    return readScopedJson('tasks', []);
  },
  getTaskById(id) {
    return this.getTasks().find(t => t.id === id);
  },
  addTask(taskData) {
    const tasks = this.getTasks();
    const tempId = 'tsk_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    let status = taskData.status || 'todo';
    let progress = parseInt(taskData.progress);
    if (Number.isNaN(progress)) progress = status === 'done' ? 100 : 0;
    if (status === 'done') progress = 100;
    if (progress === 100) status = 'done';

    const newTask = {
      id: tempId,
      title: taskData.title,
      subject: taskData.subject || '',
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      status,
      progress,
      estimatedHours: parseFloat(taskData.estimatedHours) || 2.0,
      deadline: taskData.deadline || null,
      scheduled: false,
      scheduledTime: null
    };

    tasks.unshift(newTask);
    writeScopedJson('tasks', tasks);

    if (isBackendOnlineSession()) {
      ApiService.createTask({
        title: newTask.title,
        subject: newTask.subject || null,
        description: newTask.description || null,
        priority: newTask.priority,
        status: newTask.status,
        progress: newTask.progress,
        estimatedHours: newTask.estimatedHours,
        deadline: toIsoDeadlineForApi(newTask.deadline)
      }, { silent: true })
        .then(serverTask => {
          if (serverTask && serverTask.id) {
            const currentTasks = this.getTasks().map(t =>
              t.id === tempId ? { ...t, id: serverTask.id } : t
            );
            writeScopedJson('tasks', currentTasks);
            triggerPageRefresh();
          }
        })
        .catch(err => console.warn('Không thể lưu công việc lên server:', err));
    }

    return newTask;
  },

  updateTask(id, updatedData) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const current = tasks[index];
    const next = { ...current, ...updatedData };

    // Đảm bảo quy tắc nhất quán giữa status 'done' và progress 100%
    if (updatedData.status === 'done') {
      next.progress = 100;
    } else if (updatedData.progress !== undefined && Number(updatedData.progress) === 100) {
      next.status = 'done';
      next.progress = 100;
    } else if (updatedData.status && updatedData.status !== 'done' && current.progress === 100) {
      next.progress = updatedData.status === 'todo' ? 0 : 50;
    } else if (updatedData.progress !== undefined && Number(updatedData.progress) < 100 && current.status === 'done') {
      next.status = Number(updatedData.progress) === 0 ? 'todo' : 'inprogress';
    }

    tasks[index] = next;
    writeScopedJson('tasks', tasks);

    if (isBackendOnlineSession() && /^tsk_[1-9]\d*$/.test(id)) {
      const apiPatch = {};
      if (updatedData.title !== undefined) apiPatch.title = next.title;
      if (updatedData.subject !== undefined) apiPatch.subject = next.subject || null;
      if (updatedData.description !== undefined) apiPatch.description = next.description || null;
      if (updatedData.priority !== undefined) apiPatch.priority = next.priority;
      if (updatedData.estimatedHours !== undefined) apiPatch.estimatedHours = Number(next.estimatedHours);
      if (updatedData.deadline !== undefined) apiPatch.deadline = toIsoDeadlineForApi(next.deadline);
      if (updatedData.status !== undefined || updatedData.progress !== undefined) {
        apiPatch.status = next.status;
        apiPatch.progress = Number(next.progress);
      }

      if (Object.keys(apiPatch).length > 0) {
        ApiService.updateTask(id, apiPatch, { silent: true }).catch(err =>
          console.warn('Không thể cập nhật công việc trên server:', err)
        );
      }
    }

    return tasks[index];
  },

  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    writeScopedJson('tasks', tasks);

    const events = this.getScheduledEvents().filter(ev => ev.taskId !== id);
    this.saveScheduledEvents(events);

    if (isBackendOnlineSession() && /^tsk_[1-9]\d*$/.test(id)) {
      ApiService.deleteTask(id, { silent: true }).catch(err =>
        console.warn('Không thể xóa công việc trên server:', err)
      );
    }
    return true;
  },

  // === NOTIFICATIONS ===
  getNotifications() {
    return readScopedJson('notifications', []);
  },
  markNotificationRead(id) {
    const list = this.getNotifications().map(n => (n.id === id ? { ...n, read: true } : n));
    writeScopedJson('notifications', list);
    if (isBackendOnlineSession() && /^ntf_[1-9]\d*$/.test(id)) {
      ApiService.markNotificationRead(id, { silent: true }).catch(() => {});
    }
    return list;
  },
  markAllNotificationsRead() {
    const list = this.getNotifications().map(n => ({ ...n, read: true }));
    writeScopedJson('notifications', list);
    if (isBackendOnlineSession()) {
      ApiService.markAllNotificationsRead({ silent: true }).catch(() => {});
    }
    return list;
  },

  // === SCHEDULED EVENTS (CÔNG VIỆC ĐÃ TỰ ĐỘNG LÊN LỊCH) ===
  getScheduledEvents() {
    return readScopedJson('scheduled_events', []);
  },
  getAutoSchedule() {
    return this.getScheduledEvents();
  },
  saveScheduledEvents(events) {
    writeScopedJson('scheduled_events', events);
  },

  // === THUẬT TOÁN TỰ ĐỘNG SẮP XẾP LỊCH TRÌNH THÔNG MINH (SMART AUTO-SCHEDULING) ===
  generateAutoSchedule(options = {}) {
    const daysToSchedule = options.days || 7;
    const breakMinutes = options.breakMinutes || 15;
    const user = this.getUser();
    const classes = this.getClasses();
    const workSchedules = this.getWorkSchedules();
    const existingEvents = this.getScheduledEvents();
    let tasks = this.getTasks().filter(t => t.status !== 'done' && !t.scheduled);
    if (Array.isArray(options.taskIds) && options.taskIds.length > 0) {
      tasks = tasks.filter(t => options.taskIds.includes(t.id));
    }

    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

    const sortedTasks = [...tasks].sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return new Date(a.deadline || '2099-01-01') - new Date(b.deadline || '2099-01-01');
    });

    const proposedPlan = [];
    const occupiedSlotsByDate = {};

    const now = new Date();
    for (let i = 0; i < daysToSchedule; i++) {
      const cur = new Date(now);
      cur.setDate(now.getDate() + i);
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = cur.getDay();

      occupiedSlotsByDate[dateStr] = [];

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

      workSchedules.forEach(ws => {
        let activeOnDate = false;
        if (ws.workDate) {
          activeOnDate = (String(ws.workDate).slice(0, 10) === dateStr);
        } else if (ws.dayOfWeek !== null && ws.dayOfWeek !== undefined && ws.dayOfWeek !== '') {
          if (parseInt(ws.dayOfWeek) === dayOfWeek) {
            const startOk = !ws.startDate || String(ws.startDate).slice(0, 10) <= dateStr;
            const endOk = !ws.endDate || String(ws.endDate).slice(0, 10) >= dateStr;
            activeOnDate = startOk && endOk;
          }
        }
        if (activeOnDate) {
          occupiedSlotsByDate[dateStr].push({
            start: timeStringToMinutes(ws.startTime),
            end: timeStringToMinutes(ws.endTime),
            title: ws.title,
            type: 'work_shift'
          });
        }
      });

      existingEvents.forEach(ev => {
        if (String(ev.start).startsWith(dateStr)) {
          occupiedSlotsByDate[dateStr].push({
            start: timeStringToMinutes(String(ev.start).slice(11, 16)),
            end: timeStringToMinutes(String(ev.end).slice(11, 16)),
            title: ev.title,
            type: 'event'
          });
        }
      });
    }

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

    const maxWindowDuration = studyWindows.reduce((max, w) => Math.max(max, w.end - w.start), 0);
    const unscheduled = [];
    const reasonMessages = {
      NO_AVAILABLE_SLOT: 'Không còn khoảng thời gian trống phù hợp.',
      DEADLINE_PASSED: 'Deadline của công việc đã qua.',
      DEADLINE_INFEASIBLE: 'Không còn đủ khung giờ để hoàn thành trước deadline.',
      DURATION_EXCEEDS_WINDOW: 'Thời lượng công việc dài hơn mọi khung giờ học.',
      NO_ACTIVE_STUDY_WINDOW: 'Bạn chưa bật khung giờ học phù hợp.'
    };

    for (const task of sortedTasks) {
      const taskDurationMinutes = Math.round((task.estimatedHours || 1.5) * 60);
      let scheduled = false;
      let hadCandidateBeforeDeadline = false;
      const taskDeadlineTime = task.deadline ? new Date(task.deadline).getTime() : null;

      for (let i = 0; i < daysToSchedule; i++) {
        if (scheduled) break;

        const curDate = new Date(now);
        curDate.setDate(now.getDate() + i);
        const yyyy = curDate.getFullYear();
        const mm = String(curDate.getMonth() + 1).padStart(2, '0');
        const dd = String(curDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const busyList = occupiedSlotsByDate[dateStr] || [];

        for (const window of studyWindows) {
          if (scheduled) break;

          let pointer = window.start;
          if (i === 0) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes() + 15;
            if (pointer < currentMinutes) {
              pointer = currentMinutes;
            }
          }

          while (pointer + taskDurationMinutes <= window.end) {
            const candidateEnd = pointer + taskDurationMinutes;
            const startTimeStr = minutesToTimeString(pointer);
            const endTimeStr = minutesToTimeString(candidateEnd);
            const candidateEndMillis = new Date(`${dateStr}T${endTimeStr}:00`).getTime();

            if (taskDeadlineTime && candidateEndMillis > taskDeadlineTime) {
              pointer += 30;
              continue;
            }

            hadCandidateBeforeDeadline = true;

            const isOverlap = busyList.some(busy => {
              return pointer < busy.end + breakMinutes && candidateEnd > busy.start - breakMinutes;
            });

            if (!isOverlap) {
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

              busyList.push({
                start: pointer,
                end: candidateEnd,
                title: task.title,
                type: 'task'
              });

              scheduled = true;
              break;
            } else {
              pointer += 30;
            }
          }
        }
      }

      if (!scheduled) {
        let reason = 'NO_AVAILABLE_SLOT';
        if (taskDeadlineTime && taskDeadlineTime <= now.getTime()) {
          reason = 'DEADLINE_PASSED';
        } else if (studyWindows.length === 0) {
          reason = 'NO_ACTIVE_STUDY_WINDOW';
        } else if (taskDurationMinutes > maxWindowDuration) {
          reason = 'DURATION_EXCEEDS_WINDOW';
        } else if (!hadCandidateBeforeDeadline && taskDeadlineTime) {
          reason = 'DEADLINE_INFEASIBLE';
        }
        unscheduled.push({
          taskId: task.id,
          taskTitle: task.title,
          reason,
          message: reasonMessages[reason] || 'Không thể xếp lịch.'
        });
      }
    }

    const result = [...proposedPlan];
    result.plan = proposedPlan;
    result.unscheduled = unscheduled;
    result.breakMinutes = breakMinutes;
    result.timezone = user.timezone || 'Asia/Ho_Chi_Minh';
    return result;
  },

  applyProposedSchedule(proposedPlan, breakMinutes = 15) {
    const scheduledEvents = this.getScheduledEvents();
    const tasks = this.getTasks();
    const user = this.getUser();

    proposedPlan.forEach(item => {
      const newEvent = {
        id: 'sch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        taskId: item.taskId,
        title: item.taskTitle,
        subject: item.subject,
        start: `${item.date}T${item.startTime}:00`,
        end: `${item.date}T${item.endTime}:00`,
        color: '#1f3038',
        isAutoScheduled: true
      };
      scheduledEvents.push(newEvent);

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
    writeScopedJson('tasks', tasks);

    const notifs = this.getNotifications();
    notifs.unshift({
      id: 'notif_' + Date.now(),
      title: 'Tự động sắp xếp thành công!',
      message: `Đã tự động phân bổ ${proposedPlan.length} công việc vào thời khóa biểu thông minh.`,
      type: 'success',
      time: 'Vừa xong',
      read: false
    });
    writeScopedJson('notifications', notifs);

    if (isBackendOnlineSession()) {
      const validPlan = proposedPlan
        .filter(item => /^tsk_[1-9]\d*$/.test(item.taskId))
        .map(item => ({
          taskId: item.taskId,
          date: item.date,
          startTime: String(item.startTime).slice(0, 5),
          endTime: String(item.endTime).slice(0, 5)
        }));

      if (validPlan.length > 0) {
        ApiService.applyAutoSchedule(
          validPlan,
          Number(breakMinutes || user.breakMinutes || 15),
          user.timezone || 'Asia/Ho_Chi_Minh',
          { silent: true }
        )
          .then(() => this.syncFromServer())
          .catch(err => console.warn('Không thể đồng bộ lịch tự động lên server:', err));
      }
    }

    return true;
  },

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
    writeScopedJson('notifications', notifs);

    return { added, conflicts };
  },

  async simulateAIScanSchedule() {
    await new Promise(r => setTimeout(r, 1200));
    const prompt = `
Bạn là trợ lý trích xuất Thời khóa biểu sinh viên từ hình ảnh.
Hãy đọc toàn bộ các ô môn học trong bảng và trả về DUY NHẤT một mảng JSON (không bọc trong markdown) theo cấu trúc:
[
  {
    "subject_name": "Tên môn học",
    "class_code": "Mã lớp / Mã học phần",
    "day_of_week": 2, // Thứ 2 = 2, Thứ 3 = 3, ..., Thứ 7 = 7, Chủ nhật = 8 (hoặc 0 tùy schema của bạn)
    "date": "YYYY-MM-DD", // Ngày cụ thể ở tiêu đề cột, ví dụ 2026-11-10
    "start_time": "HH:mm",
    "end_time": "HH:mm",
    "room": "Tên phòng học",
    "lecturer": "Tên giảng viên"
  }
]

QUY TẮC QUY ĐỔI TIẾT HỌC SANG GIỜ (Nếu ảnh chỉ ghi số Tiết):
- Tiết 1: 06:45 - 07:30 | Tiết 2: 07:30 - 08:15 | Tiết 3: 08:15 - 09:00
- Tiết 4: 09:15 - 10:00 | Tiết 5: 10:00 - 10:45 | Tiết 6: 10:45 - 11:30
- Tiết 7: 12:30 - 13:15 | Tiết 8: 13:15 - 14:00 | Tiết 9: 14:00 - 14:45
- Tiết 10: 15:00 - 15:45 | Tiết 11: 15:45 - 16:30 | Tiết 12: 16:30 - 17:15
- Tiết 13: 18:00 - 18:45 | Tiết 14: 18:45 - 19:30 | Tiết 15: 19:30 - 20:15
Ví dụ: "Tiết: 4 - 6" -> start_time: "09:15", end_time: "11:30".
Ví dụ: "Tiết: 14 - 14" -> start_time: "18:45", end_time: "19:30".
`;
    return {
      success: true,
      promptUsed: prompt,
      rawText: 'Thời khóa biểu Học kỳ 1 - Năm học 2026-2027 (Chuẩn 15 tiết)',
      classes: [
        {
          tempId: 'ai_' + Math.random().toString(36).slice(2, 7),
          subject_name: 'Phát triển ứng dụng di động (Flutter / Android)',
          class_code: 'IT4520',
          day_of_week: 3, // Thứ 3 (Tiết 1 - 3)
          date: '2026-11-10',
          start_time: '06:45',
          end_time: '09:00',
          room: 'B2-405',
          lecturer: 'TS. Hoàng Minh Đức',
          color: '#0d7480',
          confidence: 98,
          selected: true
        },
        {
          tempId: 'ai_' + Math.random().toString(36).slice(2, 7),
          subject_name: 'Khai phá dữ liệu & Học máy (Machine Learning)',
          class_code: 'IT4220',
          day_of_week: 5, // Thứ 5 (Tiết 4 - 6)
          date: '2026-11-12',
          start_time: '09:15',
          end_time: '11:30',
          room: 'C1-302',
          lecturer: 'PGS. TS. Trần Văn Kiên',
          color: '#1d5bd6',
          confidence: 96,
          selected: true
        },
        {
          tempId: 'ai_' + Math.random().toString(36).slice(2, 7),
          subject_name: 'Hệ điều hành mã nguồn mở Linux',
          class_code: 'IT3180',
          day_of_week: 6, // Thứ 6 (Tiết 7 - 9)
          date: '2026-11-13',
          start_time: '12:30',
          end_time: '14:45',
          room: 'Lab 5-PM',
          lecturer: 'ThS. Đỗ Quang Linh',
          color: '#1f3038',
          confidence: 94,
          selected: true
        },
        {
          tempId: 'ai_' + Math.random().toString(36).slice(2, 7),
          subject_name: 'Kỹ nghệ phần mềm ứng dụng',
          class_code: 'IT3090',
          day_of_week: 7, // Thứ 7 (Tiết 10 - 12)
          date: '2026-11-14',
          start_time: '15:00',
          end_time: '17:15',
          room: 'A3-102',
          lecturer: 'TS. Vũ Thu Hà',
          color: '#0f7d45',
          confidence: 92,
          selected: true
        }
      ]
    };
  }
};

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

function checkShiftsOverlap(shiftA, shiftB) {
  const dateA = shiftA.workDate ? String(shiftA.workDate).slice(0, 10) : null;
  const dateB = shiftB.workDate ? String(shiftB.workDate).slice(0, 10) : null;
  const dayA = shiftA.dayOfWeek !== null && shiftA.dayOfWeek !== undefined && shiftA.dayOfWeek !== '' ? Number(shiftA.dayOfWeek) : null;
  const dayB = shiftB.dayOfWeek !== null && shiftB.dayOfWeek !== undefined && shiftB.dayOfWeek !== '' ? Number(shiftB.dayOfWeek) : null;

  let sameDayPossible = false;

  const formatDateOnly = (val) => {
    if (!val) return null;
    return String(val).slice(0, 10);
  };

  const startA = formatDateOnly(shiftA.startDate);
  const endA = formatDateOnly(shiftA.endDate);
  const startB = formatDateOnly(shiftB.startDate);
  const endB = formatDateOnly(shiftB.endDate);

  if (dateA && dateB) {
    sameDayPossible = dateA === dateB;
  } else if (dayA !== null && dayB !== null) {
    if (dayA === dayB) {
      const dateOverlap = (!startA || !endB || startA <= endB) && (!endA || !startB || endA >= startB);
      sameDayPossible = dateOverlap;
    }
  } else if (dateA && dayB !== null) {
    const dt = new Date(`${dateA}T00:00:00`);
    if (!isNaN(dt.getTime()) && dt.getDay() === dayB) {
      sameDayPossible = (!startB || startB <= dateA) && (!endB || endB >= dateA);
    }
  } else if (dateB && dayA !== null) {
    const dt = new Date(`${dateB}T00:00:00`);
    if (!isNaN(dt.getTime()) && dt.getDay() === dayA) {
      sameDayPossible = (!startA || startA <= dateB) && (!endA || endA >= dateB);
    }
  }

  if (!sameDayPossible) return false;

  const startAMin = timeStringToMinutes(String(shiftA.startTime).slice(0, 5));
  const endAMin = timeStringToMinutes(String(shiftA.endTime).slice(0, 5));
  const startBMin = timeStringToMinutes(String(shiftB.startTime).slice(0, 5));
  const endBMin = timeStringToMinutes(String(shiftB.endTime).slice(0, 5));

  return startAMin < endBMin && endAMin > startBMin;
}

window.AppStore = AppStore;
