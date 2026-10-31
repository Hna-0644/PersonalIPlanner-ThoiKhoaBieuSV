/**
 * PersonalPlanner - API Service Client
 * Cầu nối giữa giao diện Frontend và Máy chủ Backend RESTful API
 * Hỗ trợ chế độ Local Mock (LocalStorage) và Real REST API (Node.js/Express)
 */

const API_CONFIG = {
  USE_MOCK: true, // Khi backend sẵn sàng, đổi thành false
  BASE_URL: 'http://localhost:5000/api',
  TIMEOUT: 8000
};

const ApiService = {
  // Quản lý JWT Token
  getToken() {
    return localStorage.getItem('pp_jwt_token') || '';
  },
  setToken(token) {
    localStorage.setItem('pp_jwt_token', token);
  },
  removeToken() {
    localStorage.removeItem('pp_jwt_token');
  },
  isAuthenticated() {
    return !!this.getToken();
  },

  // Helper request
  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { 'Authorization': `Bearer ${this.getToken()}` } : {}),
      ...options.headers
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        // Hết hạn token
        this.removeToken();
        window.location.href = '/pages/login.html';
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  },

  // === AUTH API ===
  async login(email, password) {
    if (API_CONFIG.USE_MOCK) {
      // Giả lập đăng nhập thành công
      const mockToken = 'mock_jwt_token_' + btoa(email) + '_' + Date.now();
      this.setToken(mockToken);
      return {
        success: true,
        message: 'Đăng nhập thành công!',
        token: mockToken,
        user: AppStore.getUser()
      };
    }
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async register(userData) {
    if (API_CONFIG.USE_MOCK) {
      const mockToken = 'mock_jwt_token_' + btoa(userData.email) + '_' + Date.now();
      this.setToken(mockToken);
      const newUser = AppStore.updateUser(userData);
      return {
        success: true,
        message: 'Đăng ký tài khoản thành công!',
        token: mockToken,
        user: newUser
      };
    }
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async logout() {
    this.removeToken();
    return { success: true };
  },

  // === USER PROFILE ===
  async getProfile() {
    if (API_CONFIG.USE_MOCK) return AppStore.getUser();
    return this.request('/user/profile');
  },

  async updateProfile(profileData) {
    if (API_CONFIG.USE_MOCK) return AppStore.updateUser(profileData);
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  // === TIMETABLE / CLASSES API ===
  async getClasses() {
    if (API_CONFIG.USE_MOCK) return AppStore.getClasses();
    return this.request('/classes');
  },

  async createClass(classData) {
    if (API_CONFIG.USE_MOCK) return AppStore.addClass(classData);
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify(classData)
    });
  },

  async updateClass(id, classData) {
    if (API_CONFIG.USE_MOCK) return AppStore.updateClass(id, classData);
    return this.request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(classData)
    });
  },

  async deleteClass(id) {
    if (API_CONFIG.USE_MOCK) return AppStore.deleteClass(id);
    return this.request(`/classes/${id}`, {
      method: 'DELETE'
    });
  },

  // === TASKS API ===
  async getTasks() {
    if (API_CONFIG.USE_MOCK) return AppStore.getTasks();
    return this.request('/tasks');
  },

  async createTask(taskData) {
    if (API_CONFIG.USE_MOCK) return AppStore.addTask(taskData);
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, taskData) {
    if (API_CONFIG.USE_MOCK) return AppStore.updateTask(id, taskData);
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  async deleteTask(id) {
    if (API_CONFIG.USE_MOCK) return AppStore.deleteTask(id);
    return this.request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  // === AUTO SCHEDULER API ===
  async generateAutoSchedule(params) {
    if (API_CONFIG.USE_MOCK) return AppStore.generateAutoSchedule(params);
    return this.request('/schedule/auto-generate', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async applyAutoSchedule(plan) {
    if (API_CONFIG.USE_MOCK) return AppStore.applyProposedSchedule(plan);
    return this.request('/schedule/apply', {
      method: 'POST',
      body: JSON.stringify({ plan })
    });
  }
};

window.ApiService = ApiService;
window.API_CONFIG = API_CONFIG;

