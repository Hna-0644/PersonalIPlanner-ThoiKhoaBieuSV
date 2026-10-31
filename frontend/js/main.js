/**
 * PersonalPlanner - Global App Utilities & UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  initUserUI();
  initSidebar();
  initNotifications();
  highlightActiveMenu();
});

// Hiển thị thông tin người dùng trên Header & Sidebar
function initUserUI() {
  const user = AppStore.getUser();
  if (!user) return;

  const userAvatarEls = document.querySelectorAll('.user-avatar-target');
  const userNameEls = document.querySelectorAll('.user-name-target');
  const userEmailEls = document.querySelectorAll('.user-email-target');

  userAvatarEls.forEach(el => {
    if (el.tagName === 'IMG') {
      el.src = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    }
  });

  userNameEls.forEach(el => {
    el.textContent = user.fullName || 'Người dùng';
  });

  userEmailEls.forEach(el => {
    el.textContent = user.email || '';
  });
}

// Điều khiển Sidebar trên thiết bị di động
function initSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const toggleBtn = document.querySelector('#sidebarToggleBtn');
  const backdrop = document.querySelector('.sidebar-backdrop');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('show');
      if (backdrop) backdrop.classList.toggle('show');
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('show');
      backdrop.classList.remove('show');
    });
  }
}

// Quản lý chuông thông báo
function initNotifications() {
  renderNotifications();
}

function renderNotifications() {
  const listEl = document.querySelector('#notificationList');
  const badgeEl = document.querySelector('#notificationBadge');
  if (!listEl) return;

  const notifs = AppStore.getNotifications();
  const unreadCount = notifs.filter(n => !n.read).length;

  if (badgeEl) {
    if (unreadCount > 0) {
      badgeEl.style.display = 'block';
      badgeEl.textContent = unreadCount > 9 ? '9+' : unreadCount;
    } else {
      badgeEl.style.display = 'none';
    }
  }

  if (notifs.length === 0) {
    listEl.innerHTML = `<div class="p-3 text-center text-muted small">Không có thông báo mới</div>`;
    return;
  }

  const iconMap = {
    urgent: '<i class="bi bi-exclamation-triangle-fill text-danger fs-5"></i>',
    info: '<i class="bi bi-info-circle-fill text-primary fs-5"></i>',
    success: '<i class="bi bi-check-circle-fill text-success fs-5"></i>'
  };

  listEl.innerHTML = notifs.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead('${n.id}')">
      <div>${iconMap[n.type] || iconMap.info}</div>
      <div class="flex-grow-1">
        <div class="fw-semibold small">${escapeHtml(n.title)}</div>
        <div class="text-muted small" style="font-size: 0.8rem">${escapeHtml(n.message)}</div>
        <div class="text-muted" style="font-size: 0.72rem; margin-top: 2px;">${n.time}</div>
      </div>
    </div>
  `).join('');
}

function markNotificationRead(id) {
  AppStore.markNotificationRead(id);
  renderNotifications();
}

function markAllNotificationsRead() {
  AppStore.markAllNotificationsRead();
  renderNotifications();
}

// Đánh dấu menu item đang kích hoạt
function highlightActiveMenu() {
  const path = window.location.pathname.toLowerCase();
  const links = document.querySelectorAll('.sidebar-menu .nav-link');

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // So sánh path
    if (path.endsWith(href) || (path.endsWith('/') && href.includes('index.html'))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Toast thông báo góc phải
function showToast(title, message, icon = 'success') {
  if (typeof Swal !== 'undefined') {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    Toast.fire({
      icon: icon,
      title: title,
      text: message
    });
  } else {
    alert(`${title}: ${message}`);
  }
}

// Xử lý XSS
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.showToast = showToast;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.escapeHtml = escapeHtml;

