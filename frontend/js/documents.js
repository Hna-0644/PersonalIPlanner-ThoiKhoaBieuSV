(() => {
  const PAGE_SIZE = 12;
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const CATEGORY_META = {
    notes: { label: 'Ghi chú', icon: 'bi-journal-text' },
    slides: { label: 'Slide bài giảng', icon: 'bi-easel2' },
    exam: { label: 'Đề thi', icon: 'bi-file-earmark-check' },
    assignment: { label: 'Bài tập', icon: 'bi-pencil-square' },
    summary: { label: 'Đề cương / Tóm tắt', icon: 'bi-card-text' },
    other: { label: 'Khác', icon: 'bi-folder2-open' }
  };

  let page = 1;
  let totalPages = 1;
  let searchTimer;
  let requestSequence = 0;
  let documentSubjects = [];

  document.addEventListener('DOMContentLoaded', initializeStudyDocuments);

  async function initializeStudyDocuments() {
    const form = document.getElementById('studyDocumentForm');
    if (!form) return;

    const queryParams = new URLSearchParams(window.location.search);
    const initialQuery = queryParams.get('documentQuery');
    if (initialQuery) {
      document.getElementById('studyDocumentSearch').value = initialQuery.slice(0, 200);
    }

    populateSubjectOptions(queryParams.get('subjectCode') || '');
    populateStudentYearOptions(queryParams.get('studentYear') || '');
    window.addEventListener('pp:store-synced', populateSubjectOptions);
    document.getElementById('openStudyDocumentModal').addEventListener('click', openUploadModal);
    document.getElementById('studyDocumentSearch').addEventListener('input', () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        page = 1;
        loadDocuments();
      }, 250);
    });
    document.getElementById('studyDocumentUniversityFilter').addEventListener('change', resetAndLoad);
    document.getElementById('studyDocumentSubjectFilter').addEventListener('change', resetAndLoad);
    document.getElementById('studyDocumentStudentYearFilter').addEventListener('change', resetAndLoad);
    document.getElementById('studyDocumentCategoryFilter').addEventListener('change', resetAndLoad);
    document.getElementById('studyDocumentsPrevious').addEventListener('click', () => changePage(-1));
    document.getElementById('studyDocumentsNext').addEventListener('click', () => changePage(1));
    document.getElementById('studyDocumentsGrid').addEventListener('click', handleDocumentAction);
    form.addEventListener('submit', submitDocument);

    try {
      const filters = await ApiService.getStudyDocumentFilters({ silent: true });
      documentSubjects = filters.subjects || [];
      populateUniversityOptions(
        filters.universities || [],
        queryParams.get('university') || ''
      );
      populateSubjectOptions(queryParams.get('subjectCode') || '');
    } catch (error) {
      const status = document.getElementById('studyDocumentsStatus');
      status.className = 'small text-danger mb-3';
      status.textContent = error.message || 'Không thể tải bộ lọc tài liệu.';
    }

    loadDocuments();
  }

  function populateSubjectOptions(selectedFilter = '') {
    const subjects = getAvailableSubjects();
    const knownCodes = new Set(subjects.map(subject => subject.code));
    documentSubjects.forEach(subject => {
      if (!knownCodes.has(subject.code)) {
        knownCodes.add(subject.code);
        subjects.push(subject);
      }
    });
    const filter = document.getElementById('studyDocumentSubjectFilter');
    const formSelect = document.getElementById('studyDocumentSubject');
    const currentFilter = typeof selectedFilter === 'string' && selectedFilter
      ? selectedFilter
      : filter.value;
    const selectedSubject = formSelect.value;

    filter.replaceChildren(new Option('Tất cả môn học', ''));
    formSelect.replaceChildren();
    subjects.forEach(subject => {
      const filterOption = new Option(`${subject.code} — ${subject.name}`, subject.code);
      const formOption = new Option(`${subject.code} — ${subject.name}`, subject.code);
      filter.add(filterOption);
      formSelect.add(formOption);
    });
    if (currentFilter && !subjects.some(subject => subject.code === currentFilter)) {
      filter.add(new Option(currentFilter, currentFilter));
    }
    if (subjects.some(subject => subject.code === currentFilter)) filter.value = currentFilter;
    if (subjects.some(subject => subject.code === selectedSubject)) formSelect.value = selectedSubject;
  }

  function populateUniversityOptions(universities, selectedUniversity = '') {
    const filter = document.getElementById('studyDocumentUniversityFilter');
    filter.replaceChildren(new Option('Tất cả trường', ''));
    universities.forEach(university => filter.add(new Option(university, university)));
    if (selectedUniversity && !universities.includes(selectedUniversity)) {
      filter.add(new Option(selectedUniversity, selectedUniversity));
    }
    filter.value = selectedUniversity;
  }

  function populateStudentYearOptions(selectedYear = '') {
    const filter = document.getElementById('studyDocumentStudentYearFilter');
    const selected = selectedYear || filter.value;
    filter.replaceChildren(new Option('Tất cả năm', ''));
    [1, 2, 3, 4].forEach(year => filter.add(new Option(`Năm ${year}`, String(year))));
    filter.value = selected;
  }

  function getAvailableSubjects() {
    const subjects = typeof SUBJECT_CATALOG !== 'undefined'
      ? SUBJECT_CATALOG.map(subject => ({ code: subject.code, name: subject.name }))
      : [];
    const knownCodes = new Set(subjects.map(subject => subject.code));

    if (window.AppStore && typeof AppStore.getClasses === 'function') {
      AppStore.getClasses().forEach(classItem => {
        const code = String(classItem.code || classItem.title || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9._-]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 50);
        if (!code || knownCodes.has(code)) return;
        knownCodes.add(code);
        subjects.push({ code, name: classItem.title || code });
      });
    }

    return subjects;
  }

  function resetAndLoad() {
    page = 1;
    loadDocuments();
  }

  function changePage(delta) {
    const nextPage = page + delta;
    if (nextPage < 1 || nextPage > totalPages) return;
    page = nextPage;
    loadDocuments();
  }

  async function loadDocuments() {
    const sequence = ++requestSequence;
    const status = document.getElementById('studyDocumentsStatus');
    const grid = document.getElementById('studyDocumentsGrid');
    status.className = 'small text-muted mb-3';
    status.textContent = 'Đang tải tài liệu...';
    grid.replaceChildren();

    try {
      const result = await ApiService.getStudyDocuments({
        q: document.getElementById('studyDocumentSearch').value.trim(),
        university: document.getElementById('studyDocumentUniversityFilter').value,
        subjectCode: document.getElementById('studyDocumentSubjectFilter').value,
        studentYear: document.getElementById('studyDocumentStudentYearFilter').value,
        category: document.getElementById('studyDocumentCategoryFilter').value,
        page,
        limit: PAGE_SIZE
      }, { silent: true });

      if (sequence !== requestSequence) return;
      const documents = result?.documents || [];
      const pagination = result?.pagination || { page: 1, total: documents.length, totalPages: 1 };
      page = pagination.page;
      totalPages = pagination.totalPages;
      document.getElementById('studyDocumentsCount').textContent = pagination.total;
      document.getElementById('studyDocumentsPagination').textContent =
        `Trang ${page}/${totalPages} · ${pagination.total} tài liệu`;
      updatePaginationButtons();

      if (!documents.length) {
        status.textContent = 'Chưa có tài liệu phù hợp. Hãy thử đổi từ khóa/bộ lọc hoặc đăng tài liệu đầu tiên.';
        return;
      }

      status.textContent = '';
      grid.innerHTML = documents.map(renderDocumentCard).join('');
    } catch (error) {
      if (sequence !== requestSequence) return;
      document.getElementById('studyDocumentsCount').textContent = '0';
      document.getElementById('studyDocumentsPagination').textContent = '';
      updatePaginationButtons();
      status.className = 'small text-danger mb-3';
      status.textContent = error.message || 'Không thể tải tài liệu. Vui lòng kiểm tra kết nối máy chủ và thử lại.';
    }
  }

  function renderDocumentCard(item) {
    const category = CATEGORY_META[item.category] || CATEGORY_META.other;
    const fileSize = formatFileSize(item.fileSize);
    const createdAt = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('vi-VN')
      : 'Vừa đăng';

    return `
      <div class="col-12 col-md-6 col-xl-4">
        <article class="study-document-card d-flex flex-column">
          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
              <i class="bi ${category.icon} me-1"></i>${category.label}
            </span>
            <span class="small text-muted">${escapeHtml(fileSize)}</span>
          </div>
          <h6 class="fw-bold mb-1">${escapeHtml(item.title)}</h6>
          <div class="small text-primary fw-semibold mb-2">${escapeHtml(item.subjectCode)} · ${escapeHtml(item.subjectName)}</div>
          <p class="small text-muted flex-grow-1 mb-3">${escapeHtml(item.description || 'Chưa có mô tả.')}</p>
          <div class="small text-muted border-top pt-2 mb-3">
            <div class="text-truncate" title="${escapeHtml(item.fileName)}">
              <i class="bi bi-file-earmark me-1"></i>${escapeHtml(item.fileName)}
            </div>
            <div class="mt-1">${escapeHtml(item.uploaderName)} · ${escapeHtml(createdAt)}</div>
            ${item.uploaderUniversity ? `<div class="mt-1"><i class="bi bi-mortarboard me-1"></i>${escapeHtml(item.uploaderUniversity)}</div>` : ''}
            ${item.uploaderStudentYear ? `<div class="mt-1">Năm học ${escapeHtml(item.uploaderStudentYear)}</div>` : ''}
          </div>
          <button class="btn btn-outline-primary btn-sm align-self-start" type="button"
            data-document-id="${escapeHtml(item.id)}" data-document-name="${escapeHtml(item.fileName)}">
            <i class="bi bi-download me-1"></i>Tải tài liệu
          </button>
        </article>
      </div>
    `;
  }

  function formatFileSize(size) {
    const bytes = Number(size) || 0;
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updatePaginationButtons() {
    document.getElementById('studyDocumentsPrevious').disabled = page <= 1;
    document.getElementById('studyDocumentsNext').disabled = page >= totalPages;
  }

  function openUploadModal() {
    const form = document.getElementById('studyDocumentForm');
    form.reset();
    document.getElementById('studyDocumentFormError').textContent = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('studyDocumentModal')).show();
  }

  async function submitDocument(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = document.getElementById('studyDocumentFile').files[0];
    const errorEl = document.getElementById('studyDocumentFormError');
    const submitButton = document.getElementById('studyDocumentSubmit');
    errorEl.textContent = '';

    if (!file) {
      errorEl.textContent = 'Vui lòng chọn tệp tài liệu.';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      errorEl.textContent = 'Tệp tải lên không được vượt quá 15 MB.';
      return;
    }

    const subjectSelect = document.getElementById('studyDocumentSubject');
    const selectedSubject = subjectSelect.options[subjectSelect.selectedIndex];
    const subject = getAvailableSubjects().find(item => item.code === subjectSelect.value);
    const formData = new FormData(form);
    formData.set('subjectCode', subjectSelect.value);
    formData.set('subjectName', subject ? subject.name : selectedSubject.textContent);

    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Đang tải lên...';

    try {
      await ApiService.uploadStudyDocument(formData, { silent: true });
      bootstrap.Modal.getInstance(document.getElementById('studyDocumentModal')).hide();
      showToast('Đăng tài liệu thành công', 'Tài liệu đã được thêm vào thư viện môn học.', 'success');
      page = 1;
      await loadDocuments();
    } catch (error) {
      errorEl.textContent = error.message || 'Không thể đăng tài liệu. Vui lòng thử lại.';
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Tải lên và đăng';
    }
  }

  async function handleDocumentAction(event) {
    const button = event.target.closest('[data-document-id]');
    if (!button) return;

    button.disabled = true;
    try {
      const blob = await ApiService.downloadStudyDocument(button.dataset.documentId, { silent: true });
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = button.dataset.documentName || 'tai-lieu';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      showToast('Không tải được tài liệu', error.message || 'Vui lòng thử lại.', 'error');
    } finally {
      button.disabled = false;
    }
  }
})();
