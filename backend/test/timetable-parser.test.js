const test = require('node:test');
const assert = require('node:assert/strict');
const TimetableParser = require('../../frontend/js/timetable-parser');

test('parseTextMessage parses multi-line NTTU timetable text accurately', () => {
  const nttuText = `
Thứ 2 09/11/2026
Chuyên đề tốt nghiệp phát triển phần mềm 1
23DKTPM1A - 012307756001
Tiết: 10 - 12
Phòng: L2.124
GV: Phạm Mạnh Trung Nguyên

Thứ 3 10/11/2026
Lập trình Web
25DTH1C - 011007010803
Tiết: 4 - 6
Phòng: L.504
GV: Bùi Duy Tân

Chuyên đề tốt nghiệp phát triển phần mềm 1
23DKTPM1A - 012307756001
Tiết: 10 - 12
Phòng: L.407B.SOFTWARE
GV: Phạm Mạnh Trung Nguyên

Thực tập tốt nghiệp
23DKTPM2A - 012307382617
Tiết: 14 - 14
Phòng: Thực hành tại Doanh nghiệp
GV: Châu Gia Hân

Thứ 4 11/11/2026
Khởi nghiệp
23DKTPM1A - 012307351309
Tiết: 7 - 11
Phòng: L2.212
GV: Nguyễn Ngọc Hoàng Sơn

Thứ 5 12/11/2026
Lập trình Web
25DTH1C - 011007010803
Tiết: 1 - 3
Phòng: L.405B.TH
GV: Bùi Duy Tân
  `;

  const results = TimetableParser.parseTextMessage(nttuText, { scheduleKey: 'nttu' });
  assert.equal(results.length, 6, 'Should extract all 6 classes from Image 2');

  // Verify class 1 (Thứ 2, Chuyên đề tốt nghiệp, Tiết 10-12)
  const c1 = results[0];
  assert.equal(c1.title, 'Chuyên đề tốt nghiệp phát triển phần mềm 1');
  assert.equal(c1.dayOfWeek, 1);
  assert.equal(c1.startTime, '15:35'); // Tiết 10 start at NTTU
  assert.equal(c1.endTime, '18:05'); // Tiết 12 end at NTTU
  assert.equal(c1.room, 'L2.124');
  assert.equal(c1.lecturer, 'Phạm Mạnh Trung Nguyên');

  // Verify class 2 (Thứ 3, Lập trình Web, Tiết 4-6)
  const c2 = results[1];
  assert.equal(c2.title, 'Lập trình Web');
  assert.equal(c2.dayOfWeek, 2);
  assert.equal(c2.startTime, '09:35'); // Tiết 4 start at NTTU
  assert.equal(c2.endTime, '12:05'); // Tiết 6 end at NTTU
  assert.equal(c2.room, 'L.504');
  assert.equal(c2.lecturer, 'Bùi Duy Tân');

  // Verify class 4 (Thứ 3, Thực tập tốt nghiệp, Tiết 14-14)
  const c4 = results[3];
  assert.equal(c4.title, 'Thực tập tốt nghiệp');
  assert.equal(c4.dayOfWeek, 2);
  assert.equal(c4.startTime, '19:05'); // Tiết 14 start at NTTU
  assert.equal(c4.endTime, '19:55'); // Tiết 14 end at NTTU

  // Verify class 5 (Thứ 4, Khởi nghiệp, Tiết 7-11)
  const c5 = results[4];
  assert.equal(c5.title, 'Khởi nghiệp');
  assert.equal(c5.dayOfWeek, 3);
  assert.equal(c5.startTime, '13:00'); // Tiết 7 start at NTTU
  assert.equal(c5.endTime, '17:15'); // Tiết 11 end at NTTU
  assert.equal(c5.room, 'L2.212');

  // Verify class 6 (Thứ 5, Lập trình Web, Tiết 1-3)
  const c6 = results[5];
  assert.equal(c6.title, 'Lập trình Web');
  assert.equal(c6.dayOfWeek, 4);
  assert.equal(c6.startTime, '07:00'); // Tiết 1 start at NTTU
  assert.equal(c6.endTime, '09:25'); // Tiết 3 end at NTTU
  assert.equal(c6.room, 'L.405B.TH');
});

test('parseTextMessage parses casual Zalo / chat format with explicit times', () => {
  const chatText = `
Lịch học tuần này của nhóm:
- Thứ 2: 13h30 - 16h00 Lập trình Web phòng A1-203 GV Nguyễn Văn A
- Thứ 4: 07:00 - 09:30 Cấu trúc dữ liệu phòng B2-101 Thầy Bình
- Thứ 6: Tiết 1-3 Giải tích 1 P.C3-402
  `;

  const results = TimetableParser.parseTextMessage(chatText, { scheduleKey: 'standard' });
  assert.equal(results.length, 3);
  assert.equal(results[0].dayOfWeek, 1);
  assert.equal(results[0].startTime, '13:30');
  assert.equal(results[0].endTime, '16:00');
  assert.equal(results[1].dayOfWeek, 3);
  assert.equal(results[1].startTime, '07:00');
  assert.equal(results[1].endTime, '09:30');
  assert.equal(results[2].dayOfWeek, 5);
  assert.equal(results[2].startTime, '06:45'); // Tiết 1 standard
  assert.equal(results[2].endTime, '09:15'); // Tiết 3 standard
});

test('parseExcelSheet parses tabular list format', () => {
  const sheetData = [
    ['STT', 'Mã môn', 'Tên môn học', 'Thứ', 'Tiết học', 'Phòng học', 'Giảng viên'],
    ['1', 'IT101', 'Lập trình C++', 'Thứ 2', '1 - 3', 'B1-201', 'TS. Nguyễn Văn X'],
    ['2', 'IT102', 'Cơ sở dữ liệu', 'Thứ 4', '4 - 6', 'B1-302', 'ThS. Trần Thị Y'],
    ['3', 'IT103', 'Mạng máy tính', 'Thứ 6', '7 - 9', 'Lab 2', 'ThS. Lê Văn Z']
  ];

  const results = TimetableParser.parseExcelSheet(sheetData, { scheduleKey: 'nttu' });
  assert.equal(results.length, 3);
  assert.equal(results[0].title, 'Lập trình C++');
  assert.equal(results[0].dayOfWeek, 1);
  assert.equal(results[0].startTime, '07:00');
  assert.equal(results[0].endTime, '09:25');
  assert.equal(results[1].title, 'Cơ sở dữ liệu');
  assert.equal(results[1].dayOfWeek, 3);
  assert.equal(results[2].title, 'Mạng máy tính');
  assert.equal(results[2].dayOfWeek, 5);
});

test('parseExcelSheet parses weekly matrix grid layout', () => {
  const matrixData = [
    ['Ca học', 'Thứ 2 09/11', 'Thứ 3 10/11', 'Thứ 4 11/11', 'Thứ 5 12/11'],
    ['Sáng (07:00-11:30)', '', 'Lập trình Web\nTiết 4-6\nPhòng L.504', '', 'Lập trình Web\nTiết 1-3\nPhòng L.405B'],
    ['Chiều (13:00-17:30)', 'Chuyên đề tốt nghiệp\nTiết 10-12\nPhòng L2.124', 'Chuyên đề tốt nghiệp\nTiết 10-12', 'Khởi nghiệp\nTiết 7-11\nPhòng L2.212', '']
  ];

  const results = TimetableParser.parseExcelSheet(matrixData, { scheduleKey: 'nttu' });
  assert.equal(results.length, 5);

  const webThu3 = results.find(r => r.dayOfWeek === 2 && r.title.includes('Lập trình Web'));
  assert.ok(webThu3);
  assert.equal(webThu3.startTime, '09:35');
  assert.equal(webThu3.endTime, '12:05');
  assert.equal(webThu3.room, 'L.504');

  const khoiNghiep = results.find(r => r.dayOfWeek === 3 && r.title.includes('Khởi nghiệp'));
  assert.ok(khoiNghiep);
  assert.equal(khoiNghiep.startTime, '13:00');
  assert.equal(khoiNghiep.endTime, '17:15');
});

test('parseSvgText parses SVG timetable preview', () => {
  const sampleSVG = `<svg><text>IT4520 - Phát triển di động Flutter | Thứ 3 | Tiết: 1 - 3 (06:45-09:00) | B2-405 | TS. Hoàng M. Đức</text></svg>`;
  const results = TimetableParser.parseSvgText(sampleSVG, { scheduleKey: 'standard' });
  assert.equal(results.length, 1);
  assert.equal(results[0].dayOfWeek, 2);
  assert.equal(results[0].startTime, '06:45');
  assert.equal(results[0].endTime, '09:15');
});

test('detectInputType accurately classifies image, excel, and text inputs', () => {
  assert.equal(TimetableParser.detectInputType('data:image/png;base64,iVBORw0KGgo...'), 'image');
  assert.equal(TimetableParser.detectInputType('blob:http://localhost/abc-123'), 'image');
  assert.equal(TimetableParser.detectInputType('<svg><text>TKB</text></svg>'), 'image');
  assert.equal(TimetableParser.detectInputType('https://domain.com/tkb.png'), 'image');
  assert.equal(TimetableParser.detectInputType([['Mã môn', 'Tên môn'], ['IT1', 'Lập trình']]), 'excel');
  assert.equal(TimetableParser.detectInputType('Thứ 2: Tiết 10-12 Chuyên đề tốt nghiệp'), 'text');
  assert.equal(TimetableParser.detectInputType(null), 'unknown');
});
