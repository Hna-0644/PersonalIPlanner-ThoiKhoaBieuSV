const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '../src/db/migrations/001_initial_schema.sql'),
  'utf8'
);
const seed = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');

test('seed insert columns exist in the current database migration', () => {
  const tableColumns = new Map();
  for (const [, table, definition] of migration.matchAll(
    /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\) ENGINE=/g
  )) {
    tableColumns.set(
      table,
      new Set(
        [...definition.matchAll(/^\s{2}(\w+)\s+(?:BIGINT|VARCHAR|CHAR|TEXT|TINYINT|TIME|DATE|DATETIME|ENUM|DECIMAL|JSON|SMALLINT|BOOLEAN)\b/gm)]
          .map(([, column]) => column)
      )
    );
  }

  const inserts = [...seed.matchAll(
    /INSERT INTO `?(\w+)`?\s*\(([^)]+)\)/g
  )];
  assert.ok(inserts.length > 0, 'seed script should insert data');

  for (const [, table, columns] of inserts) {
    assert.ok(tableColumns.has(table), `migration should define ${table}`);
    for (const column of columns.matchAll(/`?(\w+)`?/g)) {
      assert.ok(
        tableColumns.get(table).has(column[1]),
        `${table}.${column[1]} should exist in the migration`
      );
    }
  }
});

test('demo account password matches its bcrypt hash', () => {
  const [, passwordHash] = seed.match(/'(\$2[aby]\$\d{2}\$[^']+)'/);
  assert.equal(bcrypt.compareSync('12345678', passwordHash), true);
});
