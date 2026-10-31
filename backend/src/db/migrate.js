require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { loadEnv } = require('../config/env');
const { createDatabase } = require('../config/database');

async function migrate() {
  const pool = createDatabase(loadEnv());
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
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map(statement => statement.trim()).filter(Boolean);
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`Applied migration ${file}`);
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
});
