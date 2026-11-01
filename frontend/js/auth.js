/* PersonalPlanner - Client authentication guard */
(function () {
  const TOKEN_KEY = 'pp_jwt_token';
  const RETURN_PATH_KEY = 'pp_auth_return_path';
  const TOKEN_EXPIRY_SKEW_MS = 1000;

  function getStorage(name) {
    try {
      return window[name];
    } catch (error) {
      console.error('Không thể truy cập bộ nhớ xác thực:', error);
      return null;
    }
  }

  function decodePayload(token) {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    } catch (error) {
      return null;
    }
  }

  const AuthService = {
    getToken() {
      const local = getStorage('localStorage');
      const session = getStorage('sessionStorage');
      return (local && local.getItem(TOKEN_KEY)) || (session && session.getItem(TOKEN_KEY)) || '';
    },

    saveToken(token, remember = true) {
      if (!token) {
        throw new Error('Không thể lưu token rỗng.');
      }

      this.clearToken();
      const storage = getStorage(remember ? 'localStorage' : 'sessionStorage');
      if (!storage) {
        throw new Error('Trình duyệt không hỗ trợ lưu phiên đăng nhập.');
      }
      storage.setItem(TOKEN_KEY, token);
    },

    clearToken() {
      const local = getStorage('localStorage');
      const session = getStorage('sessionStorage');
      if (local) local.removeItem(TOKEN_KEY);
      if (session) session.removeItem(TOKEN_KEY);
    },

    isTokenExpired(token = this.getToken()) {
      if (!token) return true;
      const payload = decodePayload(token);
      return !payload
        || typeof payload.exp !== 'number'
        || payload.exp * 1000 <= Date.now() + TOKEN_EXPIRY_SKEW_MS;
    },

    isAuthenticated() {
      const token = this.getToken();
      if (this.isTokenExpired(token)) {
        if (token) this.clearToken();
        return false;
      }
      return true;
    },

    scheduleExpiryRedirect() {
      const token = this.getToken();
      const payload = decodePayload(token);
      if (!payload || !payload.exp) return;

      const delay = payload.exp * 1000 - Date.now();
      if (delay <= 0) {
        this.clearToken();
        this.redirectToLogin();
        return;
      }

      window.setTimeout(() => {
        if (!this.isAuthenticated()) {
          this.redirectToLogin();
        }
      }, delay);
    },

    redirectToLogin() {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const loginPath = window.location.pathname.includes('/pages/')
        ? 'login.html'
        : 'pages/login.html';
      const session = getStorage('sessionStorage');
      if (session && currentPath !== loginPath) {
        session.setItem(RETURN_PATH_KEY, currentPath);
      }
      if (!window.location.pathname.endsWith('/login.html')) {
        window.location.replace(loginPath);
      }
    },

    requireAuthentication() {
      if (!this.isAuthenticated()) {
        this.redirectToLogin();
        return false;
      }
      return true;
    },

    consumeReturnPath() {
      const session = getStorage('sessionStorage');
      const returnPath = session && session.getItem(RETURN_PATH_KEY);
      if (session) session.removeItem(RETURN_PATH_KEY);
      return returnPath || '';
    }
  };

  window.AuthService = AuthService;

  document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.endsWith('/login.html');
    if (!isLoginPage) {
      AuthService.requireAuthentication();
      AuthService.scheduleExpiryRedirect();
      document.querySelectorAll('a[href$="login.html"]').forEach((link) => {
        link.addEventListener('click', () => AuthService.clearToken());
      });
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY
      && !window.location.pathname.endsWith('/login.html')
      && !AuthService.isAuthenticated()) {
      AuthService.redirectToLogin();
    }
  });
})();
