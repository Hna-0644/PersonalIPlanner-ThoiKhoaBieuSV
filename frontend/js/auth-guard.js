/* PersonalPlanner - Client authentication guard */
(function () {
  window.AuthGuard = {
    isAuthenticated() {
      return !!window.ApiService && ApiService.isAuthenticated();
    },
    requireAuth() {
      if (this.isAuthenticated()) return true;
      if (window.ApiService) ApiService.removeToken();
      const returnUrl = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`${this.loginPath()}?returnUrl=${encodeURIComponent(returnUrl)}`);
      return false;
    },
    loginPath() {
      return window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
    }
  };

  if (!window.location.pathname.endsWith('/login.html')) {
    AuthGuard.requireAuth();
  }
})();
