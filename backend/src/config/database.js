const mysql = require('mysql2/promise');

function createDatabase(config) {
  return mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: config.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true
  });
}

module.exports = { createDatabase };
