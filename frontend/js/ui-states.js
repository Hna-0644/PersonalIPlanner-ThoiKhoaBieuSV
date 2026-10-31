/* PersonalPlanner - Shared UI state helpers */
(function () {
  function resolveContainer(container) {
    return typeof container === 'string' ? document.querySelector(container) : container;
  }

  function renderState(container, icon, title, message, tone) {
    const element = resolveContainer(container);
    if (!element) return;

    const stateHtml = `
      <div class="ui-state ui-state-${tone || 'muted'}">
        <div class="ui-state-icon">${icon}</div>
        <h6 class="fw-bold mb-1">${title}</h6>
        <p class="text-muted small mb-0">${message}</p>
      </div>
    `;
    if (element.tagName === 'TBODY') {
      const columns = element.closest('table').querySelectorAll('thead th').length || 1;
      element.innerHTML = `<tr><td colspan="${columns}" class="p-0">${stateHtml}</td></tr>`;
    } else {
      element.innerHTML = stateHtml;
    }
  }

  window.UIStates = {
    loading(container, message = 'Đang tải dữ liệu...') {
      const element = resolveContainer(container);
      if (!element) return;
      const stateHtml = `
        <div class="ui-state ui-state-loading" role="status" aria-live="polite">
          <span class="spinner-border text-primary" aria-hidden="true"></span>
          <span class="text-muted small">${message}</span>
        </div>
      `;
      if (element.tagName === 'TBODY') {
        const columns = element.closest('table').querySelectorAll('thead th').length || 1;
        element.innerHTML = `<tr><td colspan="${columns}" class="p-0">${stateHtml}</td></tr>`;
      } else {
        element.innerHTML = stateHtml;
      }
    },
    empty(container, title = 'Chưa có dữ liệu', message = 'Dữ liệu sẽ hiển thị tại đây khi bạn bắt đầu sử dụng.') {
      renderState(container, '<i class="bi bi-inbox"></i>', title, message, 'muted');
    },
    error(container, title = 'Không thể tải dữ liệu', message = 'Vui lòng thử lại sau.') {
      renderState(container, '<i class="bi bi-exclamation-triangle"></i>', title, message, 'danger');
    },
    showApiError(error, message = 'Vui lòng thử lại sau.') {
      const detail = error && error.message ? ` ${error.message}` : '';
      if (window.Swal) {
        Swal.fire({
          title: 'Lỗi kết nối',
          text: `${message}${detail}`,
          icon: 'error',
          confirmButtonText: 'Đã hiểu'
        });
      }
    }
  };
})();
