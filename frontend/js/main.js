/**
 * PersonalPlanner - Global App Utilities & UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  initUserUI();
  initSidebar();
  initNotifications();
  highlightActiveMenu();
  init24HourTimeInputs();
  if (window.AppStore && typeof AppStore.syncFromServer === 'function') {
    AppStore.syncFromServer();
  }
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

// =========================================================================
// HỆ THỐNG KHUNG GIỜ 24 GIỜ (00:00 - 23:59) TOÀN ỨNG DỤNG (LOẠI BỎ AM/PM)
// =========================================================================
function normalizeTime24(raw) {
  if (!raw || typeof raw !== 'string') return '08:00';
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '08:00';
  const hh = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const mm = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeDateTime24(raw) {
  if (!raw || typeof raw !== 'string') {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mo}-${dd}T23:59`;
  }
  const parts = raw.trim().split('T');
  const datePart = parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) ? parts[0] : new Date().toISOString().slice(0, 10);
  const timePart = normalizeTime24(parts[1] || '23:59');
  return `${datePart}T${timePart}`;
}

function buildHourOptionsHtml(selectedHour) {
  let html = '';
  for (let h = 0; h < 24; h++) {
    const val = String(h).padStart(2, '0');
    html += `<option value="${val}"${val === selectedHour ? ' selected' : ''}>${val}</option>`;
  }
  return html;
}

function buildMinuteOptionsHtml(selectedMin) {
  let html = '';
  for (let m = 0; m < 60; m++) {
    const val = String(m).padStart(2, '0');
    html += `<option value="${val}"${val === selectedMin ? ' selected' : ''}>${val}</option>`;
  }
  return html;
}

function upgradeSingleTimeInput(input) {
  if (!input || input.dataset.upgraded24h === 'true') return;
  input.dataset.upgraded24h = 'true';

  const isSmall = input.classList.contains('form-control-sm');
  let internalVal = normalizeTime24(input.getAttribute('value') || input.value || '08:00');
  const [initH, initM] = internalVal.split(':');

  input.type = 'hidden';

  const wrapper = document.createElement('div');
  wrapper.className = `time-24h-picker${isSmall ? ' time-24h-sm' : ''}`;

  const hourSelect = document.createElement('select');
  hourSelect.className = 'time-24h-select';
  hourSelect.title = 'Giờ (00 - 23)';
  hourSelect.innerHTML = buildHourOptionsHtml(initH);

  const sep = document.createElement('span');
  sep.className = 'time-24h-sep';
  sep.textContent = ':';

  const minSelect = document.createElement('select');
  minSelect.className = 'time-24h-select';
  minSelect.title = 'Phút (00 - 59)';
  minSelect.innerHTML = buildMinuteOptionsHtml(initM);

  const badge = document.createElement('span');
  badge.className = 'time-24h-badge';
  badge.textContent = '24h';

  wrapper.appendChild(hourSelect);
  wrapper.appendChild(sep);
  wrapper.appendChild(minSelect);
  if (!isSmall) wrapper.appendChild(badge);

  input.insertAdjacentElement('afterend', wrapper);

  function syncFromInternal() {
    const [h, m] = internalVal.split(':');
    hourSelect.value = h;
    minSelect.value = m;
    input.setAttribute('value', internalVal);
  }

  function handleUserChange() {
    internalVal = `${hourSelect.value}:${minSelect.value}`;
    input.setAttribute('value', internalVal);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  hourSelect.addEventListener('change', handleUserChange);
  minSelect.addEventListener('change', handleUserChange);

  Object.defineProperty(input, 'value', {
    configurable: true,
    get() {
      return internalVal;
    },
    set(newVal) {
      internalVal = normalizeTime24(String(newVal || '08:00'));
      syncFromInternal();
    }
  });
}

function upgradeSingleDateTimeInput(input) {
  if (!input || input.dataset.upgraded24h === 'true') return;
  input.dataset.upgraded24h = 'true';

  let internalVal = normalizeDateTime24(input.getAttribute('value') || input.value);
  const [initDate, initTime] = internalVal.split('T');
  const [initH, initM] = initTime.split(':');

  input.type = 'hidden';

  const wrapper = document.createElement('div');
  wrapper.className = 'datetime-24h-picker';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'form-control datetime-24h-date';
  dateInput.value = initDate;

  const timeBox = document.createElement('div');
  timeBox.className = 'time-24h-picker';

  const hourSelect = document.createElement('select');
  hourSelect.className = 'time-24h-select';
  hourSelect.title = 'Giờ (00 - 23)';
  hourSelect.innerHTML = buildHourOptionsHtml(initH);

  const sep = document.createElement('span');
  sep.className = 'time-24h-sep';
  sep.textContent = ':';

  const minSelect = document.createElement('select');
  minSelect.className = 'time-24h-select';
  minSelect.title = 'Phút (00 - 59)';
  minSelect.innerHTML = buildMinuteOptionsHtml(initM);

  timeBox.appendChild(hourSelect);
  timeBox.appendChild(sep);
  timeBox.appendChild(minSelect);

  wrapper.appendChild(dateInput);
  wrapper.appendChild(timeBox);

  input.insertAdjacentElement('afterend', wrapper);

  function syncFromInternal() {
    const [dPart, tPart] = internalVal.split('T');
    const [h, m] = (tPart || '23:59').split(':');
    dateInput.value = dPart;
    hourSelect.value = h;
    minSelect.value = m;
    input.setAttribute('value', internalVal);
  }

  function handleUserChange() {
    const dPart = dateInput.value || new Date().toISOString().slice(0, 10);
    internalVal = `${dPart}T${hourSelect.value}:${minSelect.value}`;
    input.setAttribute('value', internalVal);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  dateInput.addEventListener('change', handleUserChange);
  hourSelect.addEventListener('change', handleUserChange);
  minSelect.addEventListener('change', handleUserChange);

  Object.defineProperty(input, 'value', {
    configurable: true,
    get() {
      return internalVal;
    },
    set(newVal) {
      internalVal = normalizeDateTime24(String(newVal || ''));
      syncFromInternal();
    }
  });
}

function scanAndUpgrade24HourInputs(root = document) {
  root.querySelectorAll('input[type="time"]').forEach(upgradeSingleTimeInput);
  root.querySelectorAll('input[type="datetime-local"]').forEach(upgradeSingleDateTimeInput);
}

function init24HourTimeInputs() {
  scanAndUpgrade24HourInputs(document);
  if (typeof MutationObserver !== 'undefined' && document.body) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          scanAndUpgrade24HourInputs(document);
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

window.init24HourTimeInputs = init24HourTimeInputs;


