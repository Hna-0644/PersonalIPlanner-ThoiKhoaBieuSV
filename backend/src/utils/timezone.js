const { DateTime } = require('luxon');

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Chuyển giá trị từ MySQL (Date, chuỗi SQL 'YYYY-MM-DD HH:mm:ss.SSS', hoặc chuỗi ISO)
 * sang đối tượng Luxon DateTime ở múi giờ UTC.
 * Tuyệt đối không dùng new Date() phụ thuộc múi giờ máy chủ.
 */
function fromDatabaseUtc(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (DateTime.isDateTime(value)) {
    return value.toUTC();
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: 'utc' });
  }
  if (typeof value === 'number') {
    return DateTime.fromMillis(value, { zone: 'utc' });
  }
  const str = String(value).trim();
  if (!str) return null;

  let dt = DateTime.fromSQL(str, { zone: 'utc' });
  if (dt.isValid) return dt;

  dt = DateTime.fromISO(str, { zone: 'utc' });
  if (dt.isValid) return dt;

  dt = DateTime.fromRFC2822(str, { zone: 'utc' });
  if (dt.isValid) return dt;

  return DateTime.invalid('UNPARSEABLE_DATETIME', `Cannot parse datetime value: ${str}`);
}

/**
 * Chuyển chuỗi ISO-8601 (có offset như +07:00 hoặc Z) hoặc Date/DateTime
 * sang đối tượng JS Date chuẩn UTC (tạo từ epoch millis của Luxon DateTime)
 * để lưu vào cột DATETIME(3) của MySQL một cách nhất quán.
 */
function toDatabaseUtc(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const dt = fromDatabaseUtc(value);
  if (!dt || !dt.isValid) {
    throw new Error(`Invalid datetime value for database UTC conversion: ${value}`);
  }
  return dt.toJSDate();
}

/**
 * Trả về chuỗi SQL UTC 'yyyy-LL-dd HH:mm:ss.SSS' cho cột DATETIME(3) của MySQL.
 */
function toSqlUtcString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const dt = fromDatabaseUtc(value);
  if (!dt || !dt.isValid) {
    throw new Error(`Invalid datetime value for SQL UTC format: ${value}`);
  }
  return dt.toUTC().toFormat('yyyy-LL-dd HH:mm:ss.SSS');
}

/**
 * Trả về chuỗi ISO-8601 chuẩn UTC ('YYYY-MM-DDTHH:mm:ss.SSSZ') từ giá trị DB,
 * trả về null nếu đầu vào rỗng.
 */
function toIsoUtcString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const dt = fromDatabaseUtc(value);
  if (!dt || !dt.isValid) {
    return null;
  }
  return dt.toUTC().toISO();
}

/**
 * Trả về chuỗi ISO-8601 kèm offset của múi giờ người dùng
 * (ví dụ '2026-11-20T15:30:00.000+07:00').
 */
function toPresentationIso(value, zone = DEFAULT_TIMEZONE) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const dt = fromDatabaseUtc(value);
  if (!dt || !dt.isValid) {
    return null;
  }
  return dt.setZone(zone || DEFAULT_TIMEZONE).toISO();
}

/**
 * Trả về thời điểm hiện tại theo chuẩn UTC (DateTime.utc()).
 */
function nowUtc() {
  return DateTime.utc();
}

module.exports = {
  DEFAULT_TIMEZONE,
  fromDatabaseUtc,
  toDatabaseUtc,
  toSqlUtcString,
  toIsoUtcString,
  toPresentationIso,
  nowUtc
};
