const { AppError } = require('../utils/app-error');

const prompt = `
Bạn là trợ lý trích xuất Thời khóa biểu sinh viên từ hình ảnh.
Hãy đọc toàn bộ các ô môn học trong bảng và trả về DUY NHẤT một mảng JSON (không bọc trong markdown) theo cấu trúc:
[
  {
    "subject_name": "Tên môn học",
    "class_code": "Mã lớp / Mã học phần",
    "day_of_week": 2, // Thứ 2 = 2, Thứ 3 = 3, ..., Thứ 7 = 7, Chủ nhật = 8 (hoặc 0 tùy schema của bạn)
    "date": "YYYY-MM-DD", // Ngày cụ thể ở tiêu đề cột, ví dụ 2026-11-10
    "periods": "4-6", // Khoảng tiết nếu ảnh ghi số tiết, nếu không thì null
    "time_source": "period", // "period" nếu chỉ có số tiết; "explicit" nếu ảnh ghi giờ cụ thể
    "start_time": "HH:mm",
    "end_time": "HH:mm",
    "room": "Tên phòng học",
    "lecturer": "Tên giảng viên"
  }
]

Nếu ảnh ghi giờ bắt đầu/kết thúc cụ thể, chép nguyên giờ và đặt "time_source": "explicit".
Nếu ảnh chỉ ghi số tiết, trả khoảng tiết trong "periods", đặt "time_source": "period" và để start_time/end_time là null; không tự đoán giờ.
`;

const PERIOD_SCHEDULES = {
  nttu: {
    aliases: [
      'NTTU',
      'Trường Đại học Nguyễn Tất Thành',
      'Đại học Nguyễn Tất Thành',
      'Nguyen Tat Thanh University'
    ],
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
  }
};

function normalizeSchoolName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function resolvePeriodSchedule(university) {
  const normalizedName = normalizeSchoolName(university);
  if (!normalizedName) return null;
  return Object.values(PERIOD_SCHEDULES).find(schedule =>
    schedule.aliases.some(alias => normalizeSchoolName(alias) === normalizedName)
  ) || null;
}

function convertPeriodToTimeRange(periodInput, university) {
  if (!periodInput) return null;
  const schedule = resolvePeriodSchedule(university);
  if (!schedule) return null;
  const nums = String(periodInput).match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  const first = parseInt(nums[0], 10);
  const last = parseInt(nums[nums.length - 1], 10);
  if (first > last || !schedule.periods[first] || !schedule.periods[last]) return null;
  return {
    start_time: schedule.periods[first].start,
    end_time: schedule.periods[last].end
  };
}

/**
 * Quy đổi day_of_week từ chuẩn Prompt (Thứ 2 = 2 ... Thứ 7 = 7, CN = 8 hoặc 0)
 * sang chuẩn hệ thống FullCalendar / Database (CN = 0, Thứ 2 = 1 ... Thứ 7 = 6)
 */
function normalizeDayOfWeek(item) {
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date).trim())) {
    const d = new Date(`${String(item.date).trim()}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.getDay();
    }
  }
  if (item.day_of_week !== undefined && item.day_of_week !== null) {
    const raw = Number(item.day_of_week);
    if (raw === 8 || raw === 0) return 0;
    if (raw >= 2 && raw <= 7) return raw - 1;
    if (raw === 1) return 1;
  }
  if (item.dayOfWeek !== undefined && item.dayOfWeek !== null) {
    const d = Number(item.dayOfWeek);
    if (d >= 0 && d <= 6) return d;
  }
  return 1;
}

function normalizeRecognizedClassItem(item, index = 0, university = '') {
  const palette = ['#0d7480', '#1d5bd6', '#1f3038', '#0f7d45'];
  const periodInput = item.periods || item.period || item.tiet;
  const schedule = resolvePeriodSchedule(university);
  const periodRange = convertPeriodToTimeRange(periodInput, university);
  if (periodInput && schedule && !periodRange) {
    throw new AppError(422, 'INVALID_PERIOD_RANGE', 'Không thể quy đổi khoảng tiết trong ảnh.');
  }
  if (periodInput && !schedule && item.time_source !== 'explicit') {
    throw new AppError(
      422,
      'UNSUPPORTED_SCHOOL_SCHEDULE',
      'Trường trong hồ sơ chưa có bảng giờ tiết được hỗ trợ; không thể quy đổi số tiết.'
    );
  }

  const title = String(item.subject_name || item.title || 'Môn học').trim();
  const code = String(item.class_code || item.code || '').trim();
  const startTime = String(periodRange?.start_time || item.start_time || item.startTime || '').slice(0, 5);
  const endTime = String(periodRange?.end_time || item.end_time || item.endTime || '').slice(0, 5);
  if (!startTime || !endTime) {
    throw new AppError(422, 'MISSING_CLASS_TIME', 'Không nhận diện được giờ học hoặc số tiết của môn học.');
  }
  const dayOfWeek = normalizeDayOfWeek(item);
  const room = String(item.room || '').trim();
  const lecturer = String(item.lecturer || '').trim();
  const date = item.date || null;

  return {
    tempId: item.tempId || `ai_${Date.now()}_${index}`,
    // Trường theo cấu trúc Prompt
    subject_name: title,
    class_code: code,
    day_of_week: dayOfWeek === 0 ? 8 : dayOfWeek + 1,
    date,
    start_time: startTime,
    end_time: endTime,
    room,
    lecturer,
    // Trường tương thích trực tiếp với bảng Thời khóa biểu & Database
    title,
    code,
    dayOfWeek,
    startTime,
    endTime,
    color: item.color || palette[index % palette.length],
    confidence: Number(item.confidence || 96),
    selected: item.selected !== false
  };
}

function createAiVisionService({ config = {} }) {
  async function scanScheduleImage({ image, periodFormat = 'standard', university = '' }) {
    if (!image) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dữ liệu hình ảnh không được để trống.');
    }

    let mimeType = 'image/jpeg';
    let base64Data = image;

    if (image.startsWith('data:')) {
      const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const apiKey = config.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError(
        503,
        'AI_NOT_CONFIGURED',
        'Chưa cấu hình GEMINI_API_KEY cho chức năng quét thời khóa biểu.'
      );
    }

    let geminiClasses;
    try {
      geminiClasses = await callGeminiVisionAPI({
        apiKey,
        mimeType,
        base64Data
      });
    } catch (err) {
      console.warn('Gemini API call failed:', err.message);
      throw new AppError(502, 'AI_PROVIDER_ERROR', 'Không thể phân tích ảnh bằng Gemini. Vui lòng thử lại.');
    }

    if (
      !Array.isArray(geminiClasses) ||
      geminiClasses.some(item => !item || typeof item !== 'object' || Array.isArray(item))
    ) {
      throw new AppError(502, 'AI_INVALID_RESPONSE', 'Gemini trả về dữ liệu thời khóa biểu không hợp lệ.');
    }
    return {
      success: true,
      engine: 'Gemini Vision Multimodal API',
      periodFormat,
      classes: geminiClasses.map((item, idx) =>
        normalizeRecognizedClassItem(item, idx, university)
      )
    };
  }

  async function callGeminiVisionAPI({ apiKey, mimeType, base64Data }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini API returned empty response');
    }

    const cleanedText = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleanedText);
    return Array.isArray(parsed) ? parsed : parsed.classes;
  }

  return {
    scanScheduleImage,
    prompt,
    PERIOD_SCHEDULES,
    UNIVERSITY_PERIOD_POLICIES: PERIOD_SCHEDULES,
    resolvePeriodSchedule,
    resolvePeriodTimes: convertPeriodToTimeRange,
    convertPeriodToTimeRange,
    normalizeRecognizedClassItem
  };
}

module.exports = {
  createAiVisionService,
  prompt,
  PERIOD_SCHEDULES,
  UNIVERSITY_PERIOD_POLICIES: PERIOD_SCHEDULES,
  resolvePeriodSchedule,
  resolvePeriodTimes: convertPeriodToTimeRange,
  convertPeriodToTimeRange,
  normalizeRecognizedClassItem
};
