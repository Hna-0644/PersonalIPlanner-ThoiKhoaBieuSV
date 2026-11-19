import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN = __ENV.TOKEN;
const SUBJECT_ID = __ENV.SUBJECT_ID;

const responseStatuses = new Counter('community_review_response_status');
const cacheStatuses = new Counter('community_review_cache_status');
const reviewLatency = new Trend('community_review_latency', true);

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '30s'
};

export function setup() {
  if (!TOKEN) {
    throw new Error('Set TOKEN to a valid bearer access token.');
  }
  if (!SUBJECT_ID || !/^sub_[1-9]\d*$/.test(SUBJECT_ID)) {
    throw new Error('Set SUBJECT_ID to a valid public subject ID such as sub_1.');
  }
  return { token: TOKEN, subjectId: SUBJECT_ID };
}

export default function (data) {
  const response = http.get(
    `${BASE_URL}/api/courses/${encodeURIComponent(data.subjectId)}/reviews?page=1&limit=20`,
    {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { name: 'GET /api/courses/:subjectId/reviews' }
    }
  );
  const cacheStatus = response.headers['X-Cache'] || response.headers['x-cache'] || 'MISSING';

  responseStatuses.add(1, { status: String(response.status) });
  cacheStatuses.add(1, { status: String(cacheStatus) });
  reviewLatency.add(response.timings.duration);

  check(response, {
    'review read returns 200': result => result.status === 200,
    'review read reports X-Cache': () => cacheStatus === 'HIT' || cacheStatus === 'MISS'
  });
}
