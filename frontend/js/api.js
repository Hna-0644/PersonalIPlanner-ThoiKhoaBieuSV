/**
 * PersonalPlanner - API Service Client
 * Cầu nối giữa giao diện Frontend và Máy chủ Backend RESTful API (Không dùng Mock Data chung)
 */

const API_CONFIG = {
  USE_MOCK: false,
  BASE_URL:
    window.location.port === '5000'
      ? `${window.location.origin}/api`
      : 'http://localhost:5000/api',
  TIMEOUT: 8000
};

function isNetworkOfflineError(err) {
  if (!err) return false;
  if (err.status && err.status >= 400 && err.status < 500 && err.status !== 404 && err.status !== 405) {
    return false;
  }
  return (
    !err.status ||
    err.status === 404 ||
    err.status === 405 ||
    err.name === 'TypeError' ||
    /Failed to fetch|NetworkError|Load failed/i.test(String(err.message || ''))
  );
}

const ApiService = {
  getToken() {
    return window.AuthService ? AuthService.getToken() : localStorage.getItem('pp_jwt_token') || '';
  },
  setToken(token, remember = true) {
    if (window.AuthService) {
      AuthService.saveToken(token, remember);
    } else {
      localStorage.setItem('pp_jwt_token', token);
    }
  },
  removeToken() {
    if (window.AuthService) {
      AuthService.clearToken();
    } else {
      localStorage.removeItem('pp_jwt_token');
    }
    if (window.AppStore && typeof AppStore.clearCurrentUserSession === 'function') {
      AppStore.clearCurrentUserSession();
    }
  },
  isAuthenticated() {
    return window.AuthService ? AuthService.isAuthenticated() : !!this.getToken();
  },

  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        // Nếu đang dùng token local offline thì không ép đăng xuất
        if (!String(token).endsWith('.local_sig')) {
          this.removeToken();
          if (window.AuthService) {
            AuthService.redirectToLogin();
          } else {
            window.location.href = '/pages/login.html';
          }
        }
        return null;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        let msg =
          (payload && payload.error && payload.error.message) ||
          (payload && payload.message) ||
          'Yêu cầu không thành công.';
        if (response.status === 409 && endpoint === '/auth/register') {
          msg = 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc dùng email khác.';
        }
        const error = new Error(msg);
        error.status = response.status;
        error.details = payload?.error?.details || null;
        throw error;
      }
      return payload;
    } catch (error) {
      if (!options.silent && !options.skipErrorModal && window.UIStates) {
        UIStates.showApiError(error, error.message || 'Không thể hoàn tất yêu cầu đến máy chủ.');
      }
      throw error;
    }
  },

  async login(email, password, remember = true) {
    try {
      const response = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipErrorModal: true
      });
      const data = response && response.data ? response.data : response;
      const token = data && (data.accessToken || data.token);
      if (token) {
        this.setToken(token, remember);
      }
      if (data && data.user && window.AppStore) {
        AppStore.syncAccountRegistryUser(data.user, password);
        AppStore.setCurrentUserSession(data.user);
        await AppStore.syncFromServer();
      }
      return { ...response, ...data, success: true };
    } catch (err) {
      if (isNetworkOfflineError(err) && window.AppStore) {
        try {
          const localRes = AppStore.loginLocalAccount(email, password);
          this.setToken(localRes.accessToken, remember);
          return { ...localRes, success: true };
        } catch (localErr) {
          if (window.UIStates) UIStates.showApiError(localErr);
          throw localErr;
        }
      }
      if (window.UIStates) UIStates.showApiError(err);
      throw err;
    }
  },

  async register(userData) {
    const payload = {
      fullName: userData.fullName,
      email: userData.email,
      password: userData.password,
      ...(userData.studentId ? { studentId: userData.studentId } : {})
    };
    try {
      const response = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipErrorModal: true
      });
      const data = response && response.data ? response.data : response;
      const token = data && (data.accessToken || data.token);
      if (token) {
        this.setToken(token, true);
      }
      if (data && data.user && window.AppStore) {
        AppStore.syncAccountRegistryUser(data.user, userData.password);
        AppStore.setCurrentUserSession(data.user, { isNewUser: true });
        await AppStore.syncFromServer();
      }
      return { ...response, ...data, success: true };
    } catch (err) {
      if (isNetworkOfflineError(err) && window.AppStore) {
        try {
          const localRes = AppStore.registerLocalAccount(payload);
          this.setToken(localRes.accessToken, true);
          return { ...localRes, success: true };
        } catch (localErr) {
          if (window.UIStates) UIStates.showApiError(localErr);
          throw localErr;
        }
      }
      if (window.UIStates) UIStates.showApiError(err);
      throw err;
    }
  },

  async logout() {
    this.removeToken();
    return { success: true };
  },

  async getProfile(options = {}) {
    const res = await this.request('/user/profile', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async updateProfile(profileData, options = {}) {
    const res = await this.request('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async getClasses(options = {}) {
    const res = await this.request('/classes', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async createClass(classData, options = {}) {
    const res = await this.request('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async updateClass(id, classData, options = {}) {
    const res = await this.request(`/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(classData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteClass(id, options = {}) {
    const res = await this.request(`/classes/${id}`, {
      method: 'DELETE',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async getTasks(options = {}) {
    const res = await this.request('/tasks', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async createTask(taskData, options = {}) {
    const res = await this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async updateTask(id, taskData, options = {}) {
    const res = await this.request(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(taskData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteTask(id, options = {}) {
    const res = await this.request(`/tasks/${id}`, {
      method: 'DELETE',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async getWorkSchedules(options = {}) {
    const res = await this.request('/work-schedules', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async createWorkSchedule(data, options = {}) {
    const res = await this.request('/work-schedules', {
      method: 'POST',
      body: JSON.stringify(data),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async updateWorkSchedule(id, data, options = {}) {
    const res = await this.request(`/work-schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteWorkSchedule(id, options = {}) {
    const res = await this.request(`/work-schedules/${id}`, {
      method: 'DELETE',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async getScheduledEvents(options = {}) {
    const res = await this.request('/schedule/events', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async generateAutoSchedule(params, options = {}) {
    const res = await this.request('/schedule/auto-generate', {
      method: 'POST',
      body: JSON.stringify(params),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async applyAutoSchedule(plan, breakMinutes = 15, timezone = 'Asia/Ho_Chi_Minh', options = {}) {
    const res = await this.request('/schedule/apply', {
      method: 'POST',
      body: JSON.stringify({ plan, breakMinutes, timezone }),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async getNotifications(options = {}) {
    const res = await this.request('/notifications', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async scanDeadlineReminders(withinHours = 24, options = {}) {
    const res = await this.request('/notifications/reminders/scan', {
      method: 'POST',
      body: JSON.stringify({ withinHours }),
      silent: options.silent !== false
    });
    return res && res.data ? res.data : res;
  },
  async markNotificationRead(id, options = {}) {
    const res = await this.request(`/notifications/${id}/read`, {
      method: 'PUT',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async markAllNotificationsRead(options = {}) {
    const res = await this.request('/notifications/read-all', {
      method: 'PUT',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async scanScheduleFromImage(imageFileOrBase64) {
    const normalizeItem = (c, idx = 0) => {
      const palette = ['#0d7480', '#1d5bd6', '#1f3038', '#0f7d45'];
      let dayOfWeek = c.dayOfWeek;
      if (dayOfWeek === undefined || dayOfWeek === null) {
        if (c.date && /^\d{4}-\d{2}-\d{2}$/.test(String(c.date).trim())) {
          const d = new Date(`${String(c.date).trim()}T00:00:00`);
          if (!Number.isNaN(d.getTime())) dayOfWeek = d.getDay();
        } else if (c.day_of_week !== undefined && c.day_of_week !== null) {
          const raw = Number(c.day_of_week);
          dayOfWeek = raw === 8 || raw === 0 ? 0 : raw >= 2 && raw <= 7 ? raw - 1 : 1;
        } else {
          dayOfWeek = 1;
        }
      }
      const title = c.title || c.subject_name || 'Môn học';
      const code = c.code || c.class_code || '';
      const startTime = String(c.startTime || c.start_time || '06:45').slice(0, 5);
      const endTime = String(c.endTime || c.end_time || '09:00').slice(0, 5);
      return {
        ...c,
        tempId: c.tempId || 'ai_' + Math.random().toString(36).slice(2, 7),
        title,
        subject_name: title,
        code,
        class_code: code,
        dayOfWeek: Number(dayOfWeek),
        day_of_week: Number(dayOfWeek) === 0 ? 8 : Number(dayOfWeek) + 1,
        date: c.date || null,
        startTime,
        start_time: startTime,
        endTime,
        end_time: endTime,
        room: c.room || '',
        lecturer: c.lecturer || '',
        color: c.color || palette[idx % palette.length],
        selected: c.selected !== false,
        confidence: c.confidence || 96
      };
    };

    try {
      const res = await this.request('/ai/scan-schedule', {
        method: 'POST',
        body: JSON.stringify({ image: imageFileOrBase64 }),
        skipErrorModal: true
      });
      const data = res && res.data ? res.data : res;
      if (!Array.isArray(data) && (!data || !Array.isArray(data.classes))) {
        throw new Error('Máy chủ không trả về kết quả quét hợp lệ.');
      }
      const rawList = Array.isArray(data) ? data : data?.classes || [];
      return {
        ...(Array.isArray(data) ? { success: true } : data),
        classes: rawList.map(normalizeItem)
      };
    } catch (err) {
      if (window.UIStates) UIStates.showApiError(err);
      throw err;
    }
  },
  async batchAddClasses(classList) {
    return AppStore.batchAddClasses(classList);
  },

  // === MARKETPLACE (CHỢ GIÁO TRÌNH & ĐỒ DÙNG HỌC TẬP) ===
  async getMarketplaceItems(query = {}, options = {}) {
    const params = new URLSearchParams();
    if (query.subjectTag || query.subject_tag) params.set('subjectTag', query.subjectTag || query.subject_tag);
    if (query.category && query.category !== 'all') params.set('category', query.category);
    if (query.q) params.set('q', query.q);
    if (query.maxPrice !== undefined && query.maxPrice !== null && query.maxPrice !== '') {
      params.set('maxPrice', String(query.maxPrice));
    } else if (query.max_price !== undefined && query.max_price !== null && query.max_price !== '') {
      params.set('maxPrice', String(query.max_price));
    }
    if (query.status && query.status !== 'all') params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await this.request(`/marketplace/items${qs ? `?${qs}` : ''}`, { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async getMyMarketplaceItems(options = {}) {
    const res = await this.request('/marketplace/my-items', { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async getMarketplaceItemById(id, options = {}) {
    const res = await this.request(`/marketplace/items/${encodeURIComponent(id)}`, { silent: options.silent });
    return res && res.data ? res.data : res;
  },
  async getMarketplaceItemDetail(id, options = {}) {
    return this.getMarketplaceItemById(id, options);
  },
  async createMarketplaceItem(itemData, options = {}) {
    const payload = {
      title: itemData.title,
      subjectTag: itemData.subjectTag ?? itemData.subject_tag,
      category: itemData.category || 'textbook',
      price: Number(itemData.price ?? 0),
      contactInfo: itemData.contactInfo ?? itemData.contact_info,
      description: itemData.description ?? null,
      imageUrl: itemData.imageUrl ?? itemData.image_url ?? null,
      ...(itemData.subjectId !== undefined ? { subjectId: itemData.subjectId } : {})
    };
    const res = await this.request('/marketplace/items', {
      method: 'POST',
      body: JSON.stringify(payload),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async updateMarketplaceItem(id, itemData, options = {}) {
    const res = await this.request(`/marketplace/items/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async updateMarketplaceItemStatus(id, status, options = {}) {
    const statusVal = typeof status === 'object' && status !== null ? status.status : status;
    const res = await this.request(`/marketplace/items/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: statusVal }),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteMarketplaceItem(id, options = {}) {
    const res = await this.request(`/marketplace/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },

  // === COMMUNITY COURSE REVIEWS & CLASS Q&A (ĐÁNH GIÁ MÔN HỌC & HỎI ĐÁP LỚP HỌC) ===
  async getCourseReviews(subjectId, query = {}, options = {}) {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await this.request(
      `/courses/${encodeURIComponent(subjectId)}/reviews${qs ? `?${qs}` : ''}`,
      { silent: options.silent }
    );
    return res && res.data ? res.data : res;
  },
  async createCourseReview(subjectId, reviewData, options = {}) {
    const payload = {
      lecturerName: reviewData.lecturerName ?? reviewData.lecturer_name ?? null,
      rating: Number(reviewData.rating),
      difficulty: Number(reviewData.difficulty),
      attendanceRequired: Boolean(reviewData.attendanceRequired ?? reviewData.attendance_required),
      gradingNotes: reviewData.gradingNotes ?? reviewData.grading_notes ?? null,
      materialsNotes: reviewData.materialsNotes ?? reviewData.materials_notes ?? null,
      content: reviewData.content
    };
    const res = await this.request(`/courses/${encodeURIComponent(subjectId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async updateMyCourseReview(subjectId, reviewData, options = {}) {
    const res = await this.request(`/courses/${encodeURIComponent(subjectId)}/reviews/me`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteMyCourseReview(subjectId, options = {}) {
    const res = await this.request(`/courses/${encodeURIComponent(subjectId)}/reviews/me`, {
      method: 'DELETE',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async getClassPosts(classCode, query = {}, options = {}) {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await this.request(
      `/classes/${encodeURIComponent(classCode)}/posts${qs ? `?${qs}` : ''}`,
      { silent: options.silent }
    );
    return res && res.data ? res.data : res;
  },
  async createClassPost(classCode, postData, options = {}) {
    const payload = {
      subjectId: postData.subjectId ?? postData.subject_id,
      title: postData.title,
      content: postData.content
    };
    const res = await this.request(`/classes/${encodeURIComponent(classCode)}/posts`, {
      method: 'POST',
      body: JSON.stringify(payload),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteMyPost(postId, options = {}) {
    const res = await this.request(`/posts/${encodeURIComponent(postId)}/me`, {
      method: 'DELETE',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async deleteClassPost(postId, options = {}) {
    return this.deleteMyPost(postId, options);
  },
  async getPostComments(postId, query = {}, options = {}) {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    const res = await this.request(
      `/posts/${encodeURIComponent(postId)}/comments${qs ? `?${qs}` : ''}`,
      { silent: options.silent }
    );
    return res && res.data ? res.data : res;
  },
  async createPostComment(postId, commentData, options = {}) {
    const content = typeof commentData === 'string' ? commentData : commentData?.content;
    const res = await this.request(`/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async togglePostUpvote(postId, options = {}) {
    const res = await this.request(`/posts/${encodeURIComponent(postId)}/upvote`, {
      method: 'POST',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async upvotePost(postId, options = {}) {
    return this.togglePostUpvote(postId, options);
  },
  async toggleCommentUpvote(commentId, options = {}) {
    const res = await this.request(`/comments/${encodeURIComponent(commentId)}/upvote`, {
      method: 'POST',
      silent: options.silent
    });
    return res && res.data ? res.data : res;
  },
  async upvoteComment(commentId, options = {}) {
    return this.toggleCommentUpvote(commentId, options);
  }
};

window.ApiService = ApiService;
window.API_CONFIG = API_CONFIG;
