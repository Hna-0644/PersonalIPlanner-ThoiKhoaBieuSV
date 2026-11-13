require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { loadEnv } = require('../config/env');
const { createDatabase } = require('../config/database');

async function ensureDatabaseExists(config) {
  const bootstrapConn = await mysql.createConnection({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD
  });
  try {
    const safeDbName = String(config.DB_NAME).replace(/[^a-zA-Z0-9_]/g, '');
    await bootstrapConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${safeDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
    );
  } finally {
    await bootstrapConn.end();
  }
}

async function migrate(customConfig = null) {
  const config = customConfig || loadEnv();
  await ensureDatabaseExists(config);

  const pool = createDatabase(config);
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const migrationsDirectory = path.join(__dirname, 'migrations');
    const files = (await fs.readdir(migrationsDirectory))
      .filter(file => file.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const [rows] = await connection.execute(
        'SELECT name FROM schema_migrations WHERE name = ? LIMIT 1',
        [file]
      );
      if (rows.length) continue;
      const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
      const statements = sql
        .split(/;\s*(?:\r?\n|$)/)
        .map(stmt =>
          stmt
            .split(/\r?\n/)
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .trim()
        )
        .filter(Boolean);

      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (err) {
          if (
            err &&
            (err.code === 'ER_DUP_KEYNAME' ||
              err.errno === 1061 ||
              err.code === 'ER_DUP_FIELDNAME' ||
              err.errno === 1060)
          ) {
            continue;
          }
          throw err;
        }
      }
      await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`Applied migration ${file}`);
    }

    // Mở rộng cột avatar sang MEDIUMTEXT để hỗ trợ lưu ảnh tải lên từ thư viện thiết bị
    await connection.query('ALTER TABLE users MODIFY COLUMN avatar MEDIUMTEXT NULL').catch(() => {});
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch(error => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { migrate, ensureDatabaseExists };
