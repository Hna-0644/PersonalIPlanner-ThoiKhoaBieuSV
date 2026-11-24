(() => {
  const PAGE_SIZE = 12;
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const CATEGORY_ALIASES = {
    notes: 'lecture_notes',
    slides: 'lecture_notes',
    summary: 'summaries',
    assignment: 'assignments',
    exam: 'past_exams'
  };
  const CATEGORY_META = {
    lecture_notes: { label: 'Bài giảng (Lecture notes)', icon: 'bi-easel2' },
    summaries: { label: 'Tóm tắt / Đề cương (Summaries)', icon: 'bi-card-text' },
    assignments: { label: 'Bài tập bắt buộc & Đồ án (Assignments)', icon: 'bi-pencil-square' },
    past_exams: { label: 'Đề thi các năm (Past exams)', icon: 'bi-file-earmark-check' },
    other: { label: 'Khác', icon: 'bi-folder2-open' }
  };

  let page = 1;
  let totalPages = 1;
  let searchTimer;
  let requestSequence = 0;
  let documentSubjects = [];
  let documentItemsById = new Map();
  let thumbnailObserver;
  let thumbnailQueue = [];
  let activeThumbnailCount = 0;
  let activePreviewId = '';
  let activePreviewItem = null;
  let activePreviewDocument = null;
  let activePreviewPage = 1;
  let previewRequestSequence = 0;
  let savedOnly = false;
  const pdfDocuments = new Map();

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.addEventListener('DOMContentLoaded', initializeStudyDocuments);

  async function initializeStudyDocuments() {
    const form = document.getElementById('studyDocumentForm');
    if (!form) return;

    const queryParams = new URLSearchParams(window.location.search);
    const initialQuery = queryParams.get('documentQuery');
    const requestedCategory = queryParams.get('category') || '';
    const initialCategory = CATEGORY_ALIASES[requestedCategory] || requestedCategory;
    if (initialQuery) {
      document.getElementById('studyDocumentSearch').value = initialQuery.slice(0, 200);
    }
    if ([...document.getElementById('studyDocumentCategoryFilter').options]
      .some(option => option.value === initialCategory)) {
      document.getElementById('studyDocumentCategoryFilter').value = initialCategory;
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
    document.getElementById('studyDocumentsSavedToggle').addEventListener('click', toggleSavedDocuments);
    document.getElementById('studyDocumentsPrevious').addEventListener('click', () => changePage(-1));
    document.getElementById('studyDocumentsNext').addEventListener('click', () => changePage(1));
    const documentGrid = document.getElementById('studyDocumentsGrid');
    documentGrid.addEventListener('click', handleDocumentAction);
    documentGrid.addEventListener('keydown', handleDocumentCardKeydown);
    document.getElementById('studyDocumentPreviewPrevious').addEventListener('click', () => {
      if (activePreviewPage <= 1) return;
      activePreviewPage -= 1;
      renderPreviewPage();
    });
    document.getElementById('studyDocumentPreviewNext').addEventListener('click', () => {
      if (!activePreviewDocument || activePreviewPage >= activePreviewDocument.numPages) return;
      activePreviewPage += 1;
      renderPreviewPage();
    });
    document.getElementById('studyDocumentPreviewBookmark').addEventListener('click', event => {
      if (activePreviewItem) toggleBookmark(activePreviewItem, event.currentTarget);
    });
    document.getElementById('studyDocumentPreviewDownload').addEventListener('click', event => {
      if (activePreviewItem) {
        downloadDocumentFile(event.currentTarget, activePreviewItem.id, activePreviewItem.fileName);
      }
    });
    document.getElementById('studyDocumentPreviewModal').addEventListener(
      'hidden.bs.modal',
      closeDocumentPreview
    );
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

  function toggleSavedDocuments() {
    savedOnly = !savedOnly;
    const button = document.getElementById('studyDocumentsSavedToggle');
    button.setAttribute('aria-pressed', String(savedOnly));
    button.classList.toggle('btn-primary', savedOnly);
    button.classList.toggle('btn-outline-primary', !savedOnly);
    button.querySelector('span').textContent = savedOnly ? 'Tất cả tài liệu' : 'Thư viện của tôi';
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
        savedOnly,
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
        status.textContent = savedOnly
          ? 'Thư viện của bạn chưa có tài liệu đã lưu.'
          : 'Chưa có tài liệu phù hợp. Hãy thử đổi từ khóa/bộ lọc hoặc đăng tài liệu đầu tiên.';
        return;
      }

      status.textContent = '';
      grid.innerHTML = documents.map(renderDocumentCard).join('');
      observeDocumentThumbnails(documents);
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
    const fileName = item.fileName || '';
    const isPdf = item.mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);
    const fileTypeLabel = /\.docx?$/i.test(fileName) ? 'WORD' : 'PDF';
    const createdAt = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('vi-VN')
      : 'Vừa đăng';

    return `
      <div class="col-12 col-md-6 col-xl-4">
        <article class="study-document-card d-flex flex-column" data-document-card-id="${escapeHtml(item.id)}"
          tabindex="0" aria-label="Mở tài liệu ${escapeHtml(item.title)}">
          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
              <i class="bi ${category.icon} me-1"></i>${category.label}
            </span>
            <span class="small text-muted">${escapeHtml(fileSize)}</span>
          </div>
          <div class="study-document-cover" data-document-cover-id="${escapeHtml(item.id)}">
            ${isPdf ? '<canvas class="d-none" aria-label="Ảnh bìa tài liệu PDF"></canvas>' : ''}
            <div class="study-document-cover-placeholder">
              <i class="bi ${isPdf ? 'bi-file-earmark-pdf' : 'bi-file-earmark-word'}" aria-hidden="true"></i>
              <span>${fileTypeLabel}</span>
            </div>
            <span class="study-document-page-count" data-page-count>
              ${isPdf ? 'Đang đọc số trang...' : 'Xem trước PDF không hỗ trợ'}
            </span>
          </div>
          <h6 class="fw-bold mb-1">${escapeHtml(item.title)}</h6>
          <div class="small text-primary fw-semibold mb-2">${escapeHtml(item.subjectCode)} · ${escapeHtml(item.subjectName)}</div>
          <p class="small text-muted flex-grow-1 mb-3">${escapeHtml(item.description || 'Chưa có mô tả.')}</p>
          <div class="small text-muted border-top pt-2 mb-3">
            <div class="text-truncate" title="${escapeHtml(fileName)}">
              <i class="bi bi-file-earmark me-1"></i>${escapeHtml(fileName)}
            </div>
            <div class="mt-1">${escapeHtml(item.uploaderName)} · ${escapeHtml(createdAt)}</div>
            ${item.uploaderUniversity ? `<div class="mt-1"><i class="bi bi-mortarboard me-1"></i>${escapeHtml(item.uploaderUniversity)}</div>` : ''}
            ${item.uploaderStudentYear ? `<div class="mt-1">Sinh viên năm ${escapeHtml(item.uploaderStudentYear)}</div>` : ''}
          </div>
          <div class="d-flex flex-wrap gap-2">
            ${isPdf ? `<button class="btn btn-outline-primary btn-sm" type="button"
              data-document-action="preview" data-document-id="${escapeHtml(item.id)}"
              data-document-title="${escapeHtml(item.title)}">
              <i class="bi bi-eye me-1"></i>Xem trước
            </button>` : ''}
            <button class="btn btn-outline-secondary btn-sm" type="button"
              data-document-action="download" data-document-id="${escapeHtml(item.id)}"
              data-document-name="${escapeHtml(fileName)}">
              <i class="bi bi-download me-1"></i>${isPdf ? 'Tải xuống PDF' : 'Mở tài liệu'}
            </button>
            <button class="btn ${item.isBookmarked ? 'btn-primary' : 'btn-outline-primary'} btn-sm"
              type="button" data-document-action="bookmark" data-document-id="${escapeHtml(item.id)}"
              aria-pressed="${item.isBookmarked ? 'true' : 'false'}">
              <i class="bi ${item.isBookmarked ? 'bi-bookmark-check-fill' : 'bi-bookmark'} me-1"></i>
              ${item.isBookmarked ? 'Đã lưu' : 'Lưu vào Thư viện của tôi'}
            </button>
          </div>
        </article>
      </div>
    `;
  }

  function observeDocumentThumbnails(documents) {
    documentItemsById = new Map(documents.map(item => [String(item.id), item]));
    if (thumbnailObserver) thumbnailObserver.disconnect();
    const covers = document.querySelectorAll('#studyDocumentsGrid [data-document-cover-id]');
    if (typeof IntersectionObserver !== 'function') {
      covers.forEach(cover => queueDocumentThumbnail(cover));
      return;
    }

    if (!thumbnailObserver) {
      thumbnailObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          thumbnailObserver.unobserve(entry.target);
          queueDocumentThumbnail(entry.target);
        });
      }, { rootMargin: '160px' });
    }
    covers.forEach(cover => thumbnailObserver.observe(cover));
  }

  function queueDocumentThumbnail(cover) {
    const item = documentItemsById.get(cover.dataset.documentCoverId);
    if (!item || !cover.querySelector('canvas')) return;
    thumbnailQueue.push({ item, cover });
    processThumbnailQueue();
  }

  function processThumbnailQueue() {
    while (activeThumbnailCount < 2 && thumbnailQueue.length) {
      const { item, cover } = thumbnailQueue.shift();
      if (!cover.isConnected) continue;
      activeThumbnailCount += 1;
      renderDocumentThumbnail(item, cover)
        .catch(() => {
          const pageCount = cover.querySelector('[data-page-count]');
          if (pageCount) pageCount.textContent = 'Ảnh bìa không khả dụng';
        })
        .finally(() => {
          activeThumbnailCount -= 1;
          processThumbnailQueue();
        });
    }
  }

  async function renderDocumentThumbnail(item, cover) {
    try {
      const pdfDocument = await getPdfDocument(item.id);
      if (!cover.isConnected) return;

      const pageCount = cover.querySelector('[data-page-count]');
      const canvas = cover.querySelector('canvas');
      pageCount.textContent = `${pdfDocument.numPages} trang`;
      await renderPdfPage(pdfDocument, 1, canvas, 210, 250);
      canvas.classList.remove('d-none');
      cover.querySelector('.study-document-cover-placeholder').classList.add('d-none');
    } finally {
      if (activePreviewId !== String(item.id)) releasePdfDocument(item.id);
    }
  }

  function getPdfDocument(documentId) {
    const id = String(documentId);
    const cached = pdfDocuments.get(id);
    if (cached) return cached.promise;

    if (!window.pdfjsLib) {
      return Promise.reject(new Error('Trình đọc PDF chưa sẵn sàng. Kiểm tra kết nối mạng rồi tải lại trang.'));
    }

    const token = ApiService.getToken();
    const loadingTask = window.pdfjsLib.getDocument({
      url: ApiService.getStudyDocumentFileUrl(id),
      httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      rangeChunkSize: 65536,
      disableStream: true,
      disableAutoFetch: true
    });
    const entry = { loadingTask, document: null, promise: null };
    entry.promise = loadingTask.promise
      .then(pdfDocument => {
        entry.document = pdfDocument;
        return pdfDocument;
      })
      .catch(error => {
        if (pdfDocuments.get(id) === entry) pdfDocuments.delete(id);
        throw error;
      });
    pdfDocuments.set(id, entry);
    return entry.promise;
  }

  function releasePdfDocument(documentId) {
    const id = String(documentId);
    const entry = pdfDocuments.get(id);
    if (!entry) return;
    pdfDocuments.delete(id);
    const resource = entry.document || entry.loadingTask;
    if (resource && typeof resource.destroy === 'function') {
      resource.destroy().catch(error => console.error('PDF preview cleanup failed:', error));
    }
  }

  async function renderPdfPage(pdfDocument, pageNumber, canvas, maxWidth, maxHeight) {
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
    const viewport = page.getViewport({ scale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const context = canvas.getContext('2d');
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    await page.render({ canvasContext: context, viewport }).promise;
  }

  async function openDocumentPreview(item) {
    const documentId = String(item.id);
    if (activePreviewId && activePreviewId !== documentId) {
      releasePdfDocument(activePreviewId);
    }
    activePreviewId = documentId;
    activePreviewItem = item;
    activePreviewDocument = null;
    const requestId = ++previewRequestSequence;
    const modalElement = document.getElementById('studyDocumentPreviewModal');
    const canvas = document.getElementById('studyDocumentPreviewCanvas');
    const status = document.getElementById('studyDocumentPreviewStatus');
    const isPdf = item.mimeType === 'application/pdf' || /\.pdf$/i.test(item.fileName || '');
    document.getElementById('studyDocumentPreviewTitle').textContent = item.title || 'Xem trước tài liệu';
    document.getElementById('studyDocumentPreviewPageCount').textContent =
      isPdf ? 'Đang tải số trang...' : '';
    document.getElementById('studyDocumentPreviewDownload').innerHTML = isPdf
      ? '<i class="bi bi-download me-1"></i>Tải xuống PDF'
      : '<i class="bi bi-box-arrow-up-right me-1"></i>Mở tài liệu';
    updateBookmarkButton(document.getElementById('studyDocumentPreviewBookmark'), item.isBookmarked);
    document.getElementById('studyDocumentPreviewPosition').textContent = '';
    status.textContent = isPdf
      ? 'Đang tải tài liệu...'
      : 'Định dạng Word chưa hỗ trợ xem trước trực tuyến. Bấm “Mở tài liệu” để tải tệp và mở bằng ứng dụng phù hợp.';
    status.classList.remove('d-none');
    canvas.classList.add('d-none');
    document.getElementById('studyDocumentPreviewPrevious').disabled = true;
    document.getElementById('studyDocumentPreviewNext').disabled = true;
    bootstrap.Modal.getOrCreateInstance(modalElement).show();
    if (!isPdf) return;

    try {
      const pdfDocument = await getPdfDocument(documentId);
      if (requestId !== previewRequestSequence) return;
      activePreviewDocument = pdfDocument;
      activePreviewPage = 1;
      document.getElementById('studyDocumentPreviewPageCount').textContent =
        `${pdfDocument.numPages} trang`;
      await renderPreviewPage();
    } catch (error) {
      if (requestId !== previewRequestSequence) return;
      status.textContent = error.message || 'Không thể xem trước tệp PDF. Bạn vẫn có thể tải tệp xuống.';
      document.getElementById('studyDocumentPreviewPageCount').textContent = '';
    }
  }

  async function renderPreviewPage() {
    if (!activePreviewDocument) return;
    const status = document.getElementById('studyDocumentPreviewStatus');
    const canvas = document.getElementById('studyDocumentPreviewCanvas');
    const stage = canvas.parentElement;
    const maxWidth = Math.max(280, stage.clientWidth - 32);
    const maxHeight = Math.max(360, window.innerHeight * 0.68);
    const requestId = previewRequestSequence;
    status.textContent = 'Đang hiển thị trang...';
    status.classList.remove('d-none');
    document.getElementById('studyDocumentPreviewPrevious').disabled = true;
    document.getElementById('studyDocumentPreviewNext').disabled = true;

    try {
      await renderPdfPage(activePreviewDocument, activePreviewPage, canvas, maxWidth, maxHeight);
      if (requestId !== previewRequestSequence) return;
      status.classList.add('d-none');
      canvas.classList.remove('d-none');
      document.getElementById('studyDocumentPreviewPosition').textContent =
        `Trang ${activePreviewPage} / ${activePreviewDocument.numPages}`;
      document.getElementById('studyDocumentPreviewPrevious').disabled = activePreviewPage <= 1;
      document.getElementById('studyDocumentPreviewNext').disabled =
        activePreviewPage >= activePreviewDocument.numPages;
    } catch (error) {
      if (requestId !== previewRequestSequence) return;
      status.textContent = error.message || 'Không thể hiển thị trang PDF này.';
      canvas.classList.add('d-none');
      document.getElementById('studyDocumentPreviewPrevious').disabled = activePreviewPage <= 1;
      document.getElementById('studyDocumentPreviewNext').disabled =
        activePreviewPage >= activePreviewDocument.numPages;
    }
  }

  function closeDocumentPreview() {
    previewRequestSequence += 1;
    if (activePreviewId) releasePdfDocument(activePreviewId);
    activePreviewId = '';
    activePreviewItem = null;
    activePreviewDocument = null;
    activePreviewPage = 1;
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
    const button = event.target.closest('button[data-document-action][data-document-id]');
    if (button) {
      const item = documentItemsById.get(button.dataset.documentId);
      if (!item) return;
      if (button.dataset.documentAction === 'preview') {
        await openDocumentPreview(item);
        return;
      }
      if (button.dataset.documentAction === 'bookmark') {
        await toggleBookmark(item, button);
        return;
      }
      if (button.dataset.documentAction === 'download') {
        await downloadDocumentFile(button, item.id, item.fileName);
        return;
      }
    }

    const card = event.target.closest('[data-document-card-id]');
    if (!card || event.target.closest('button, a, input, select, textarea')) return;
    const item = documentItemsById.get(card.dataset.documentCardId);
    if (item) await openDocumentPreview(item);
  }

  function handleDocumentCardKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-document-card-id]');
    if (!card || event.target !== card) return;
    event.preventDefault();
    const item = documentItemsById.get(card.dataset.documentCardId);
    if (item) openDocumentPreview(item);
  }

  async function toggleBookmark(item, button) {
    const isBookmarked = !item.isBookmarked;
    button.disabled = true;
    try {
      const result = await ApiService.setStudyDocumentBookmark(item.id, isBookmarked, { silent: true });
      item.isBookmarked = Boolean(result.isBookmarked);
      updateBookmarkButton(button, item.isBookmarked);
      showToast(
        item.isBookmarked ? 'Đã lưu tài liệu' : 'Đã gỡ tài liệu',
        item.isBookmarked
          ? 'Tài liệu đã được thêm vào Thư viện của tôi.'
          : 'Tài liệu đã được gỡ khỏi Thư viện của tôi.',
        'success'
      );
      if (savedOnly && !item.isBookmarked) {
        page = 1;
        await loadDocuments();
      }
    } catch (error) {
      showToast('Không lưu được tài liệu', error.message || 'Vui lòng thử lại.', 'error');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  function updateBookmarkButton(button, isBookmarked) {
    if (!button) return;
    button.classList.toggle('btn-primary', isBookmarked);
    button.classList.toggle('btn-outline-primary', !isBookmarked);
    button.setAttribute('aria-pressed', String(isBookmarked));
    button.innerHTML = isBookmarked
      ? '<i class="bi bi-bookmark-check-fill me-1"></i>Đã lưu'
      : '<i class="bi bi-bookmark me-1"></i>Lưu vào Thư viện của tôi';
  }

  async function downloadDocumentFile(button, documentId, fileName) {
    if (button) button.disabled = true;
    try {
      const blob = await ApiService.downloadStudyDocument(documentId, { silent: true });
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName || 'tai-lieu';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      showToast('Không tải được tài liệu', error.message || 'Vui lòng thử lại.', 'error');
    } finally {
      if (button && button.isConnected) button.disabled = false;
    }
  }
})();
