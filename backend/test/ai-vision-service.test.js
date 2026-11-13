const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiVisionService, convertPeriodToTimeRange } = require('../src/services/ai-vision-service');

function mockGeminiResponse(t, result) {
  t.mock.method(global, 'fetch', async () => ({
    ok: true,
    async json() {
      return {
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(result) }]
          }
        }]
      };
    }
  }));
}

test('NTTU period ranges use the official start and end times', () => {
  const expectedTimes = [
    ['07:00', '07:50'],
    ['07:50', '08:40'],
    ['08:40', '09:25'],
    ['09:35', '10:25'],
    ['10:25', '11:15'],
    ['11:15', '12:05'],
    ['13:00', '13:50'],
    ['13:50', '14:40'],
    ['14:40', '15:25'],
    ['15:35', '16:25'],
    ['16:25', '17:15'],
    ['17:15', '18:05'],
    ['18:15', '19:05'],
    ['19:05', '19:55'],
    ['20:05', '21:00'],
    ['21:00', '21:50']
  ];

  expectedTimes.forEach(([start_time, end_time], index) => {
    assert.deepEqual(convertPeriodToTimeRange(String(index + 1), 'NTTU'), {
      start_time,
      end_time
    });
  });
  assert.deepEqual(convertPeriodToTimeRange('1-3', 'Trường Đại học Nguyễn Tất Thành'), {
    start_time: '07:00',
    end_time: '09:25'
  });
  assert.deepEqual(convertPeriodToTimeRange('15-16', 'NTTU'), {
    start_time: '20:05',
    end_time: '21:50'
  });
  assert.deepEqual(convertPeriodToTimeRange('3-4', 'NTTU'), {
    start_time: '08:40',
    end_time: '10:25'
  });
});

test('recognized NTTU periods override model-estimated times', async t => {
  mockGeminiResponse(t, [{
    subject_name: 'Lập trình',
    periods: '4-6',
    start_time: '09:00',
    end_time: '12:00',
    day_of_week: 2
  }]);

  const service = createAiVisionService({ config: { GEMINI_API_KEY: 'test-key' } });
  const result = await service.scanScheduleImage({
    image: 'data:image/jpeg;base64,dGVzdA==',
    university: 'Trường Đại học Nguyễn Tất Thành'
  });

  assert.equal(result.classes[0].start_time, '09:35');
  assert.equal(result.classes[0].end_time, '12:05');
});

test('missing Gemini API key returns a configuration error instead of sample classes', async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const service = createAiVisionService({ config: {} });
    await assert.rejects(
      service.scanScheduleImage({ image: 'data:image/jpeg;base64,dGVzdA==' }),
      error => error.status === 503 && error.code === 'AI_NOT_CONFIGURED'
    );
  } finally {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  }
});

test('Gemini provider failure returns an error instead of sample classes', async t => {
  t.mock.method(global, 'fetch', async () => ({
    ok: false,
    status: 503
  }));
  const service = createAiVisionService({ config: { GEMINI_API_KEY: 'test-key' } });

  await assert.rejects(
    service.scanScheduleImage({ image: 'data:image/jpeg;base64,dGVzdA==' }),
    error => error.status === 502 && error.code === 'AI_PROVIDER_ERROR'
  );
});

test('an empty Gemini result stays empty instead of returning sample classes', async t => {
  mockGeminiResponse(t, []);
  const service = createAiVisionService({ config: { GEMINI_API_KEY: 'test-key' } });

  const result = await service.scanScheduleImage({
    image: 'data:image/jpeg;base64,dGVzdA==',
    university: 'NTTU'
  });

  assert.deepEqual(result.classes, []);
});

test('malformed Gemini class entries return an AI response error', async t => {
  mockGeminiResponse(t, [null]);
  const service = createAiVisionService({ config: { GEMINI_API_KEY: 'test-key' } });

  await assert.rejects(
    service.scanScheduleImage({
      image: 'data:image/jpeg;base64,dGVzdA==',
      university: 'NTTU'
    }),
    error => error.status === 502 && error.code === 'AI_INVALID_RESPONSE'
  );
});

test('period-only results for an unsupported school return an unsupported-profile error', async t => {
  mockGeminiResponse(t, [{
    subject_name: 'Lập trình',
    periods: '1-2',
    time_source: 'period',
    day_of_week: 2
  }]);
  const service = createAiVisionService({ config: { GEMINI_API_KEY: 'test-key' } });

  await assert.rejects(
    service.scanScheduleImage({
      image: 'data:image/jpeg;base64,dGVzdA==',
      university: 'Trường Chưa Có Hồ Sơ'
    }),
    error => error.status === 422 && error.code === 'UNSUPPORTED_SCHOOL_SCHEDULE'
  );
});
