/**
 * PersonalPlanner - Timetable Parser Engine
 * Hỗ trợ nhận diện Thời khóa biểu đa phương thức:
 * 1. Tin nhắn văn bản (Zalo, Messenger, SMS, copy từ cổng trường)
 * 2. File Excel / CSV ngẫu nhiên (.xlsx, .xls, .csv - dạng bảng danh sách hoặc lưới ma trận tuần)
 * 3. Văn bản trích xuất từ hình ảnh / OCR / SVG
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TimetableParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PERIOD_SCHEDULES = {
    nttu: {
      name: 'Đại học Nguyễn Tất Thành (NTTU)',
      periods: {
        1: { start: '07:00', end: '07:50' },
        2: { start: '07:50', end: '08:40' },
        3: { start: '08:40', end: '09:25' },
        4: { start: '09:35', end: '10:25' },
        5: { start: '10:25', end: '11:15' },
        6: { start: '11:15', end: '12:05' },
        7: { start: '13:00', end: '13:50' },
        8: { start: '13:50', end: '14:40' },
        9: { start: '14:40', end: '15:25' },
        10: { start: '15:35', end: '16:25' },
        11: { start: '16:25', end: '17:15' },
        12: { start: '17:15', end: '18:05' },
        13: { start: '18:15', end: '19:05' },
        14: { start: '19:05', end: '19:55' },
        15: { start: '20:05', end: '21:00' },
        16: { start: '21:00', end: '21:50' }
      }
    },
    standard: {
      name: 'Quy chuẩn 15 tiết phổ thông (Tiết 1: 06:45, 45p/tiết)',
      periods: {
        1: { start: '06:45', end: '07:30' },
        2: { start: '07:35', end: '08:20' },
        3: { start: '08:30', end: '09:15' },
        4: { start: '09:25', end: '10:10' },
        5: { start: '10:15', end: '11:00' },
        6: { start: '11:05', end: '11:50' },
        7: { start: '12:30', end: '13:15' },
        8: { start: '13:20', end: '14:05' },
        9: { start: '14:15', end: '15:00' },
        10: { start: '15:10', end: '15:55' },
        11: { start: '16:00', end: '16:45' },
        12: { start: '16:50', end: '17:35' },
        13: { start: '17:45', end: '18:30' },
        14: { start: '18:35', end: '19:20' },
        15: { start: '19:30', end: '20:15' }
      }
    }
  };

  const DEFAULT_COLORS = ['#0d7480', '#1d5bd6', '#1f3038', '#0f7d45', '#b45309', '#6366f1'];

  function removeDiacritics(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  function isDayHeaderLine(line) {
    const s = removeDiacritics(line).replace(/^[-–—*•\s]+/, '').trim();
    return /^(?:thu\s*[2-7]|thu\s*hai|thu\s*ba|thu\s*tu|thu\s*nam|thu\s*sau|thu\s*bay|chu\s*nhat|\bt[2-7]\b|\bcn\b)(?:\s+\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)?[:\s]*$/i.test(s);
  }

  function parseDayOfWeek(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      if (val >= 0 && val <= 6) return val;
      if (val === 7 || val === 8) return 0;
    }
    const s = removeDiacritics(val);
    if (/^(thu\s*2|t2|mon|monday|thu\s*hai)$/.test(s)) return 1;
    if (/^(thu\s*3|t3|tue|tuesday|thu\s*ba)$/.test(s)) return 2;
    if (/^(thu\s*4|t4|wed|wednesday|thu\s*tu)$/.test(s)) return 3;
    if (/^(thu\s*5|t5|thu|thursday|thu\s*nam)$/.test(s)) return 4;
    if (/^(thu\s*6|t6|fri|friday|thu\s*sau)$/.test(s)) return 5;
    if (/^(thu\s*7|t7|sat|saturday|thu\s*bay)$/.test(s)) return 6;
    if (/^(chu\s*nhat|cn|sun|sunday)$/.test(s)) return 0;

    // Check substring
    if (/thu\s*2|thu\s*hai|\bt2\b/.test(s)) return 1;
    if (/thu\s*3|thu\s*ba|\bt3\b/.test(s)) return 2;
    if (/thu\s*4|thu\s*tu|\bt4\b/.test(s)) return 3;
    if (/thu\s*5|thu\s*nam|\bt5\b/.test(s)) return 4;
    if (/thu\s*6|thu\s*sau|\bt6\b/.test(s)) return 5;
    if (/thu\s*7|thu\s*bay|\bt7\b/.test(s)) return 6;
    if (/chu\s*nhat|\bcn\b/.test(s)) return 0;

    // Date format DD/MM/YYYY or YYYY-MM-DD
    const dateMatch = String(val).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      const d = new Date(parseInt(dateMatch[3], 10), parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[1], 10));
      if (!Number.isNaN(d.getTime())) return d.getDay();
    }
    const isoMatch = String(val).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
      if (!Number.isNaN(d.getTime())) return d.getDay();
    }

    const num = parseInt(s, 10);
    if (!Number.isNaN(num)) {
      if (num >= 2 && num <= 7) return num - 1;
      if (num === 8 || num === 0) return 0;
      if (num === 1) return 1;
    }
    return null;
  }

  function convertPeriodToTimeRange(periodInput, scheduleKey = 'nttu') {
    if (!periodInput) return null;
    const schedule = PERIOD_SCHEDULES[scheduleKey] || PERIOD_SCHEDULES.nttu;
    const nums = String(periodInput).match(/\d+/g);
    if (!nums || nums.length === 0) return null;
    const first = parseInt(nums[0], 10);
    const last = parseInt(nums[nums.length - 1], 10);
    if (first > last || !schedule.periods[first] || !schedule.periods[last]) {
      const fallback = PERIOD_SCHEDULES.standard;
      if (fallback.periods[first] && fallback.periods[last]) {
        return {
          startTime: fallback.periods[first].start,
          endTime: fallback.periods[last].end
        };
      }
      return null;
    }
    return {
      startTime: schedule.periods[first].start,
      endTime: schedule.periods[last].end
    };
  }

  function parseTimeRange(timeStr) {
    if (!timeStr) return null;
    const s = String(timeStr).trim();
    const match = s.match(/(\d{1,2}):(\d{2})\s*(?:-|–|—|den|to|đến)\s*(\d{1,2}):(\d{2})/i) ||
                  s.match(/(\d{1,2})h(\d{2})?\s*(?:-|–|—|den|to|đến)\s*(\d{1,2})h(\d{2})?/i);
    if (match) {
      const startH = String(match[1]).padStart(2, '0');
      const startM = String(match[2] || '00').padStart(2, '0');
      const endH = String(match[3]).padStart(2, '0');
      const endM = String(match[4] || '00').padStart(2, '0');
      return {
        startTime: `${startH}:${startM}`,
        endTime: `${endH}:${endM}`
      };
    }
    return null;
  }

  /**
   * Trích xuất thông tin một khối / một dòng văn bản
   */
  function extractClassFromText(rawText, inheritedDay = null, scheduleKey = 'nttu') {
    if (!rawText || !rawText.trim()) return null;
    const text = rawText.trim();

    if (isDayHeaderLine(text)) return null;

    // 1. Tìm Thứ
    let dayOfWeek = parseDayOfWeek(text);
    if (dayOfWeek === null) dayOfWeek = inheritedDay;

    // 2. Tìm Tiết học: "Tiết: 4 - 6", "Tiết 1-3", "Tiết: 14 - 14", "tiết 10-12"
    let startTime = '';
    let endTime = '';
    const periodMatch = text.match(/(?:tiết|tiet|t\.)\s*[:.]?\s*(\d+)(?:\s*[-–—]\s*(\d+)|\s*(?:den|to|đến)\s*(\d+))?/i);
    if (periodMatch) {
      const pStart = periodMatch[1];
      const pEnd = periodMatch[2] || periodMatch[3] || pStart;
      const range = convertPeriodToTimeRange(`${pStart}-${pEnd}`, scheduleKey);
      if (range) {
        startTime = range.startTime;
        endTime = range.endTime;
      }
    }

    // 3. Nếu chưa có giờ từ tiết, thử tìm giờ trực tiếp (có : hoặc h)
    if (!startTime || !endTime) {
      const timeRange = parseTimeRange(text);
      if (timeRange) {
        startTime = timeRange.startTime;
        endTime = timeRange.endTime;
      }
    }

    // 4. Nếu vẫn chưa có, kiểm tra ca sáng/chiều/tối
    if (!startTime || !endTime) {
      const cleanLower = removeDiacritics(text);
      if (cleanLower.includes('sang')) {
        startTime = '07:00';
        endTime = '11:30';
      } else if (cleanLower.includes('chieu')) {
        startTime = '13:00';
        endTime = '17:30';
      } else if (cleanLower.includes('toi')) {
        startTime = '18:00';
        endTime = '21:00';
      }
    }

    const hasTimeOrPeriod = Boolean(periodMatch || startTime || endTime);
    const hasClassIndicator = /(?:phòng|phong|p\.|room|gv|giảng\s*viên|giang\s*vien|cbdt|thầy|thay|cô|co|lớp|lop|học\s*phần|hoc\s*phan|môn|mon)/i.test(text);

    if (!hasTimeOrPeriod && !hasClassIndicator) {
      return null;
    }

    // 5. Tìm Phòng học
    let room = '';
    const roomMatch = text.match(/(?:phòng|phong|p\.|room|lab)\s*[:.]?\s*([A-Za-z0-9_\-\.\s]{2,40})(?=\n|$|,|;|\bgv\b|\bgiảng\s*viên\b|\bgiang\s*vien\b|\bthầy\b|\bcô\b)/i);
    if (roomMatch) {
      room = roomMatch[1].trim();
      room = room.replace(/^(hoc|hoc tai|học|học tại)\s+/i, '').trim();
    }

    // 6. Tìm Giảng viên
    let lecturer = '';
    const gvMatch = text.match(/(?:gv|giảng\s*viên|giang\s*vien|cbdt|thầy|thay|cô|co)\s*[:.]?\s*([^\n,;|\(\)]+)/i);
    if (gvMatch) {
      lecturer = gvMatch[1].trim();
    }

    // 7. Tìm Mã môn / Mã lớp (loại trừ các chuỗi giờ như 13h30)
    let code = '';
    const codeMatch = text.match(/\b([0-9]{2}[A-Z0-9]+(?:\s*-\s*[0-9]+)?|[A-Z]{2,4}[0-9]{3,5})\b/i);
    if (codeMatch && !/^\d{1,2}h\d{2}$/i.test(codeMatch[1])) {
      code = codeMatch[1].trim();
    }

    // 8. Tên môn học
    // Nếu là một dòng đơn chứa tất cả thông tin
    let title = '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length === 1) {
      let cleaned = lines[0].replace(/^[-–—*•\s]+/, '');
      cleaned = cleaned.replace(/^(?:thứ\s*[2-7]|thứ\s*hai|thứ\s*ba|thứ\s*tư|thứ\s*năm|thứ\s*sáu|thứ\s*bảy|chủ\s*nhật|\bt[2-7]\b|\bcn\b)[:\s]*/i, '');
      cleaned = cleaned.replace(/(?:\d{1,2}[:h]\d{2}|\d{1,2}h)\s*(?:[-–—]|den|to|đến)\s*(?:\d{1,2}[:h]\d{2}|\d{1,2}h)/gi, '');
      cleaned = cleaned.replace(/(?:tiết|tiet|t\.)\s*[:.]?\s*\d+\s*(?:[-–—]|den|to|đến)?\s*\d*/gi, '');
      cleaned = cleaned.replace(/(?:phòng|phong|p\.|room|lab)\s*[:.]?\s*[A-Za-z0-9_\-\.]+/gi, '');
      cleaned = cleaned.replace(/(?:gv|giảng\s*viên|giang\s*vien|cbdt|thầy|thay|cô|co)\s*[:.]?\s*[^\n,;|]+/gi, '');
      if (code) cleaned = cleaned.replace(code, '');
      cleaned = cleaned.replace(/^[|:,\-\s]+/, '').replace(/[|:,\-\s]+$/, '').trim();
      title = cleaned;
    } else {
      for (const line of lines) {
        if (isDayHeaderLine(line)) continue;
        const clean = line.replace(/(?:tiết|tiet|phòng|phong|gv|giảng\s*viên|giang vien|thứ\s*\d|t\d)[\s:.].*$/i, '').trim();
        if (!clean) continue;
        if (isDayHeaderLine(clean)) continue;
        if (/^(sang|chieu|toi|ca\s*\d|lich\s*hoc|thoi\s*khoa\s*bieu)$/i.test(removeDiacritics(clean))) continue;
        if (code && clean === code) continue;
        if (clean.length > 2) {
          title = clean;
          break;
        }
      }
      if (!title && lines.length > 0) {
        for (const l of lines) {
          if (!isDayHeaderLine(l) && l.length > 2) {
            title = l;
            break;
          }
        }
      }
    }

    title = title.replace(/^[-–—|*•#\s]+/, '').replace(/[-–—|*•#\s]+$/, '').trim();

    if (!title || /^(lich\s*hoc|thoi\s*khoa\s*bieu|danh\s*sach)/i.test(removeDiacritics(title))) return null;

    if (!startTime || !endTime) {
      startTime = '07:30';
      endTime = '09:30';
    }

    return {
      title,
      code,
      dayOfWeek: dayOfWeek !== null ? dayOfWeek : 1,
      startTime,
      endTime,
      room,
      lecturer,
      confidence: 96,
      selected: true
    };
  }

  /**
   * Phân tích Tin nhắn văn bản (Zalo, Messenger, SMS, paste cổng đào tạo)
   */
  function parseTextMessage(rawText, options = {}) {
    if (!rawText || typeof rawText !== 'string') return [];
    const scheduleKey = options.scheduleKey || 'nttu';
    const text = rawText.replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    const results = [];
    const rawLines = text.split('\n').map(l => l.trim());

    let currentDay = null;
    let currentBlock = [];

    function processCurrentBlock() {
      if (currentBlock.length === 0) return;
      const blockText = currentBlock.join('\n');
      const item = extractClassFromText(blockText, currentDay, scheduleKey);
      if (item) results.push(item);
      currentBlock = [];
    }

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) {
        processCurrentBlock();
        continue;
      }

      if (isDayHeaderLine(line)) {
        processCurrentBlock();
        currentDay = parseDayOfWeek(line);
        continue;
      }

      // Kiểm tra nếu đây là một dòng tự chứa toàn bộ một môn học (như tin nhắn Zalo từng dòng)
      const lineDay = parseDayOfWeek(line);
      const isSelfContainedLine = lineDay !== null &&
        (/(?:tiết|tiet|t\.)/i.test(line) || /\d{1,2}[:h]\d{2}/i.test(line) || /(?:phòng|phong|p\.)/i.test(line));

      if (isSelfContainedLine) {
        processCurrentBlock();
        const item = extractClassFromText(line, lineDay, scheduleKey);
        if (item) results.push(item);
        continue;
      }

      if (line.includes('|') && (line.includes('Thứ') || line.includes('Tiết') || line.includes(':'))) {
        processCurrentBlock();
        const item = extractClassFromText(line, currentDay, scheduleKey);
        if (item) results.push(item);
        continue;
      }

      // Nếu gặp tên môn mới hoặc mã môn sau khi đã có Tiết trong block
      const hasPeriodInBlock = currentBlock.some(l => /(?:tiết|tiet|t\.)\s*[:.]?\s*\d+/i.test(l));
      if (hasPeriodInBlock && /(?:tiết|tiet|t\.)\s*[:.]?\s*\d+/i.test(line)) {
        processCurrentBlock();
      }

      currentBlock.push(line);
    }
    processCurrentBlock();

    return deduplicateAndFormat(results, options.defaultColor);
  }

  /**
   * Phân tích dữ liệu File Excel / CSV ngẫu nhiên
   */
  function parseExcelSheet(sheetRows, options = {}) {
    if (!Array.isArray(sheetRows) || sheetRows.length === 0) return [];
    const scheduleKey = options.scheduleKey || 'nttu';

    const matrix = sheetRows.map(row =>
      Array.isArray(row) ? row.map(cell => (cell !== null && cell !== undefined ? String(cell).trim() : '')) : []
    );

    // 1. Dạng Ma trận tuần
    const matrixResult = tryParseMatrixLayout(matrix, scheduleKey);
    if (matrixResult && matrixResult.length > 0) {
      return deduplicateAndFormat(matrixResult, options.defaultColor);
    }

    // 2. Dạng Bảng danh sách
    const listResult = tryParseTabularLayout(matrix, scheduleKey);
    return deduplicateAndFormat(listResult, options.defaultColor);
  }

  function tryParseMatrixLayout(matrix, scheduleKey) {
    let dayHeaderRowIndex = -1;
    let dayColumns = [];

    for (let r = 0; r < Math.min(matrix.length, 10); r++) {
      const row = matrix[r];
      const foundDays = [];
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        const day = parseDayOfWeek(val);
        if (day !== null && isDayHeaderLine(val)) {
          foundDays.push({ colIndex: c, dayOfWeek: day, text: val });
        }
      }
      if (foundDays.length >= 3) {
        dayHeaderRowIndex = r;
        dayColumns = foundDays;
        break;
      }
    }

    if (dayHeaderRowIndex === -1 || dayColumns.length === 0) return null;

    const classes = [];
    for (let r = dayHeaderRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      const firstColText = row[0] || '';
      let rowTimeRange = parseTimeRange(firstColText);
      let rowPeriodRange = null;

      const pMatch = firstColText.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
      if (pMatch && !rowTimeRange) {
        rowPeriodRange = convertPeriodToTimeRange(`${pMatch[1]}-${pMatch[2]}`, scheduleKey);
      }

      for (const dayCol of dayColumns) {
        const cellText = row[dayCol.colIndex] || '';
        if (!cellText || cellText.length < 3) continue;

        const parsed = extractClassFromText(cellText, dayCol.dayOfWeek, scheduleKey);
        if (parsed) {
          if ((!parsed.startTime || parsed.startTime === '07:30') && (rowPeriodRange || rowTimeRange)) {
            parsed.startTime = (rowPeriodRange || rowTimeRange).startTime;
            parsed.endTime = (rowPeriodRange || rowTimeRange).endTime;
          }
          parsed.dayOfWeek = dayCol.dayOfWeek;
          classes.push(parsed);
        }
      }
    }

    return classes;
  }

  function tryParseTabularLayout(matrix, scheduleKey) {
    let headerRowIndex = -1;
    let colMap = {
      title: -1,
      code: -1,
      day: -1,
      period: -1,
      startTime: -1,
      endTime: -1,
      room: -1,
      lecturer: -1
    };

    for (let r = 0; r < Math.min(matrix.length, 15); r++) {
      const row = matrix[r];
      let matches = 0;
      const tempMap = { ...colMap };

      for (let c = 0; c < row.length; c++) {
        const val = removeDiacritics(row[c]);
        if (!val) continue;

        if (/(ten\s*mon|mon\s*hoc|hoc\s*phan|subject|title|ten\s*hp)/i.test(val)) {
          tempMap.title = c;
          matches++;
        } else if (/(ma\s*mon|ma\s*hp|ma\s*lop|code|ma\s*mh)/i.test(val)) {
          tempMap.code = c;
          matches++;
        } else if (/(thu\b|ngay\s*hoc|day|weekday)/i.test(val)) {
          tempMap.day = c;
          matches++;
        } else if (/(tiet|period|ca\s*hoc|so\s*tiet)/i.test(val)) {
          tempMap.period = c;
          matches++;
        } else if (/(bat\s*dau|start|gio\s*hoc)/i.test(val)) {
          tempMap.startTime = c;
          matches++;
        } else if (/(ket\s*thuc|end)/i.test(val)) {
          tempMap.endTime = c;
          matches++;
        } else if (/(phong|room|dia\s*diem|lab)/i.test(val)) {
          tempMap.room = c;
          matches++;
        } else if (/(giang\s*vien|gv|cbdt|teacher|lecturer)/i.test(val)) {
          tempMap.lecturer = c;
          matches++;
        }
      }

      if (matches >= 2 && tempMap.title !== -1) {
        headerRowIndex = r;
        colMap = tempMap;
        break;
      }
    }

    const classes = [];

    if (headerRowIndex !== -1) {
      for (let r = headerRowIndex + 1; r < matrix.length; r++) {
        const row = matrix[r];
        const title = colMap.title !== -1 ? row[colMap.title] : '';
        if (!title || title.length < 2) continue;
        if (/^(ten\s*mon|mon\s*hoc|stt)$/i.test(removeDiacritics(title))) continue;

        const code = colMap.code !== -1 ? row[colMap.code] : '';
        const dayVal = colMap.day !== -1 ? row[colMap.day] : null;
        const dayOfWeek = parseDayOfWeek(dayVal) !== null ? parseDayOfWeek(dayVal) : 1;

        let startTime = '07:30';
        let endTime = '09:30';

        if (colMap.period !== -1 && row[colMap.period]) {
          const range = convertPeriodToTimeRange(row[colMap.period], scheduleKey);
          if (range) {
            startTime = range.startTime;
            endTime = range.endTime;
          }
        }
        if (colMap.startTime !== -1 && row[colMap.startTime]) {
          const rawStart = String(row[colMap.startTime]).slice(0, 5);
          if (rawStart) startTime = rawStart;
        }
        if (colMap.endTime !== -1 && row[colMap.endTime]) {
          const rawEnd = String(row[colMap.endTime]).slice(0, 5);
          if (rawEnd) endTime = rawEnd;
        }

        const room = colMap.room !== -1 ? row[colMap.room] : '';
        const lecturer = colMap.lecturer !== -1 ? row[colMap.lecturer] : '';

        classes.push({
          title,
          code,
          dayOfWeek,
          startTime,
          endTime,
          room,
          lecturer,
          confidence: 98,
          selected: true
        });
      }
    } else {
      for (const row of matrix) {
        const combined = row.filter(Boolean).join(' | ');
        const item = extractClassFromText(combined, null, scheduleKey);
        if (item) classes.push(item);
      }
    }

    return classes;
  }

  function parseSvgText(svgString, options = {}) {
    if (!svgString || typeof svgString !== 'string') return [];
    const textMatches = svgString.match(/<text[^>]*>(.*?)<\/text>/gi) || [];
    const lines = textMatches
      .map(tag => tag.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 5 && !t.includes('THỜI KHÓA BIỂU') && !t.includes('Mã HP | Tên học phần'));

    const fullText = lines.join('\n');
    return parseTextMessage(fullText, options);
  }

  function deduplicateAndFormat(classes, defaultColor = '#0d7480') {
    const palette = DEFAULT_COLORS;
    const seen = new Set();
    const result = [];

    classes.forEach((c, idx) => {
      const key = `${c.title}_${c.dayOfWeek}_${c.startTime}`;
      if (seen.has(key)) return;
      seen.add(key);

      result.push({
        tempId: `parsed_${Date.now()}_${idx}`,
        title: c.title,
        subject_name: c.title,
        code: c.code || '',
        class_code: c.code || '',
        dayOfWeek: c.dayOfWeek,
        day_of_week: c.dayOfWeek === 0 ? 8 : c.dayOfWeek + 1,
        startTime: c.startTime,
        start_time: c.startTime,
        endTime: c.endTime,
        end_time: c.endTime,
        room: c.room || '',
        lecturer: c.lecturer || '',
        color: c.color || defaultColor || palette[idx % palette.length],
        confidence: c.confidence || 96,
        selected: c.selected !== false
      });
    });

    return result;
  }

  /**
   * Tự động phát hiện loại dữ liệu đầu vào: 'image' | 'excel' | 'text' | 'unknown'
   */
  function detectInputType(data) {
    if (!data) return 'unknown';
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('blob:') ||
        trimmed.includes('<svg') ||
        /\.(png|jpe?g|webp|svg)($|\?)/i.test(trimmed)
      ) {
        return 'image';
      }
      return 'text';
    }
    if (Array.isArray(data)) {
      return 'excel';
    }
    if (typeof File !== 'undefined' && data instanceof File) {
      const name = (data.name || '').toLowerCase();
      if (data.type && data.type.startsWith('image/')) return 'image';
      if (/\.(png|jpe?g|webp|svg)$/i.test(name)) return 'image';
      if (/\.(xlsx|xls|csv)$/i.test(name) || (data.type && (data.type.includes('spreadsheet') || data.type.includes('excel')))) {
        return 'excel';
      }
      return 'text';
    }
    return 'unknown';
  }

  return {
    PERIOD_SCHEDULES,
    parseDayOfWeek,
    convertPeriodToTimeRange,
    parseTimeRange,
    extractClassFromText,
    parseTextMessage,
    parseExcelSheet,
    parseSvgText,
    deduplicateAndFormat,
    detectInputType
  };
});
