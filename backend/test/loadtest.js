import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const DEMO_EMAIL = __ENV.DEMO_EMAIL || 'demo@personalplanner.local';
const DEMO_PASSWORD = __ENV.DEMO_PASSWORD || '12345678';

// Cấu hình giả lập tải (500 Virtual Users mùa đăng ký môn học & tra cứu thời khóa biểu)
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Tăng dần lên 50 user ảo trong 30 giây
    { duration: '1m', target: 500 },  // Đẩy vọt lên 500 user ảo (Spike/Burst traffic lúc đăng ký môn)
    { duration: '30s', target: 0 }    // Giảm dần về 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% request phải phản hồi dưới 200ms
    http_req_failed: ['rate<0.01']    // Tỷ lệ lỗi dưới 1%
  }
};

export function setup() {
  if (__ENV.ACCESS_TOKEN) {
    return { token: __ENV.ACCESS_TOKEN };
  }

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    }),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  let token = 'MOCK_JWT_TOKEN_HERE';
  try {
    const body = loginRes.json();
    if (body && body.data && body.data.accessToken) {
      token = body.data.accessToken;
    }
  } catch (_) {
    // Fallback token nếu chạy ở chế độ dry-run hoặc mock
  }

  return { token };
}

export default function (data) {
  const token = (data && data.token) || __ENV.ACCESS_TOKEN || 'MOCK_JWT_TOKEN_HERE';
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  // Kiểm thử đồng thời các endpoint cốt lõi đã bọc Redis Cache-Aside & Composite Index
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/classes`, null, params],
    ['GET', `${BASE_URL}/api/schedule/events`, null, params],
    ['GET', `${BASE_URL}/api/tasks`, null, params],
    ['GET', `${BASE_URL}/api/work-schedules`, null, params]
  ]);

  for (const res of responses) {
    check(res, {
      'status is 200': (r) => r.status === 200,
      'transaction time < 200ms': (r) => r.timings.duration < 200
    });
  }

  sleep(1); // Giả lập thời gian sinh viên đọc lịch trước khi thao tác tiếp
}
