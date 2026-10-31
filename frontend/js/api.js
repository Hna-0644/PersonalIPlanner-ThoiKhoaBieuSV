/**
 * PersonalPlanner - API Service Client
 * Cầu nối giữa giao diện Frontend và Máy chủ Backend RESTful API
 */

const API_CONFIG = {
  USE_MOCK: true,
  BASE_URL: 'http://localhost:5000/api',
  TIMEOUT: 8000
};

const ApiService = {
  getToken() {
    return sessionStorage.getItem('pp_jwt_token') || localStorage.getItem('pp_jwt_token') || '';
  },
  setToken(token, remember = true) {
    this.removeToken();
    (remember ? localStorage : sessionStorage).setItem('pp_jwt_token', token);
  },
  removeToken() {
    localStorage.removeItem('pp_jwt_token');
    sessionStorage.removeItem('pp_jwt_token');
  },
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = token.split('.')[1];
      if (payload) {
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(atob(normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=')));
        if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
          this.removeToken();
          return false;
        }
      }
    } catch (error) {
      console.warn('Unable to validate token expiry:', error);
      if (token.split('.').length === 3) {
        this.removeToken();
        return false;
      }
    }
    return true;
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {}),
      ...options.headers
    };

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, { ...options, headers });
      if (response.status === 401) {
        this.removeToken();
        const loginPath = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
        window.location.replace(`${loginPath}?expired=1`);
        return null;
      }
      const payload = await response.json();
      if (!response.ok) {
        const error = new Error((payload && payload.message) || 'Yêu cầu không thành công.');
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      console.error('Fetch error:', error);
      if (window.UIStates) UIStates.showApiError(error, 'Không thể hoàn tất yêu cầu đến máy chủ.');
      throw error;
    }
  },

  async login(email, password, remember = true) {
    if (API_CONFIG.USE_MOCK) {
      const mockToken = `mock_jwt_token_${btoa(email)}_${Date.now()}`;
      this.setToken(mockToken, remember);
      return { success: true, message: 'Đăng nhập thành công!', token: mockToken, user: AppStore.getUser() };
    }
    const response = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (response && response.token) this.setToken(response.token, remember);
    return response;
  },

  async register(userData) {
    if (API_CONFIG.USE_MOCK) {
      const mockToken = `mock_jwt_token_${btoa(userData.email)}_${Date.now()}`;
      this.setToken(mockToken, true);
      const newUser = AppStore.updateUser(userData);
      return { success: true, message: 'Đăng ký tài khoản thành công!', token: mockToken, user: newUser };
    }
    const response = await this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
    if (response && response.token) this.setToken(response.token, true);
    return response;
  },

  async logout() {
    this.removeToken();
    return { success: true };
  },

  async getProfile() {
    return API_CONFIG.USE_MOCK ? AppStore.getUser() : this.request('/user/profile');
  },
  async updateProfile(data) {
    return API_CONFIG.USE_MOCK ? AppStore.updateUser(data) : this.request('/user/profile', { method: 'PUT', body: JSON.stringify(data) });
  },
  async getClasses() {
    return API_CONFIG.USE_MOCK ? AppStore.getClasses() : this.request('/classes');
  },
  async createClass(data) {
    return API_CONFIG.USE_MOCK ? AppStore.addClass(data) : this.request('/classes', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateClass(id, data) {
    return API_CONFIG.USE_MOCK ? AppStore.updateClass(id, data) : this.request(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteClass(id) {
    return API_CONFIG.USE_MOCK ? AppStore.deleteClass(id) : this.request(`/classes/${id}`, { method: 'DELETE' });
  },
  async getTasks() {
    return API_CONFIG.USE_MOCK ? AppStore.getTasks() : this.request('/tasks');
  },
  async createTask(data) {
    return API_CONFIG.USE_MOCK ? AppStore.addTask(data) : this.request('/tasks', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateTask(id, data) {
    return API_CONFIG.USE_MOCK ? AppStore.updateTask(id, data) : this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteTask(id) {
    return API_CONFIG.USE_MOCK ? AppStore.deleteTask(id) : this.request(`/tasks/${id}`, { method: 'DELETE' });
  },
  async generateAutoSchedule(params) {
    return API_CONFIG.USE_MOCK ? AppStore.generateAutoSchedule(params) : this.request('/schedule/auto-generate', { method: 'POST', body: JSON.stringify(params) });
  },
  async applyAutoSchedule(plan) {
    return API_CONFIG.USE_MOCK ? AppStore.applyProposedSchedule(plan) : this.request('/schedule/apply', { method: 'POST', body: JSON.stringify({ plan }) });
  },
  async scanScheduleFromImage(image) {
    return API_CONFIG.USE_MOCK ? AppStore.simulateAIScanSchedule(image) : this.request('/ai/scan-schedule', { method: 'POST', body: JSON.stringify({ image }) });
  },
  async batchAddClasses(classes) {
    return API_CONFIG.USE_MOCK ? AppStore.batchAddClasses(classes) : this.request('/classes/batch', { method: 'POST', body: JSON.stringify({ classes }) });
  }
};

window.ApiService = ApiService;
window.API_CONFIG = API_CONFIG;
