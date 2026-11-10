# Docker MySQL Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the backend's local Docker MySQL credentials and database with the existing `.env` and migration workflow.

**Architecture:** Keep `DB_PASSWORD` only in the ignored backend `.env` and have Docker Compose use that same value for MySQL root initialization. Keep the existing named volume and document the correct database name and startup/migration sequence.

**Tech Stack:** Docker Compose, MySQL 8.0, Node.js migration script, Markdown README.

**Spec:** [2026-11-10-docker-mysql-connection-design.md](../specs/2026-11-10-docker-mysql-connection-design.md)

## Global Constraints

- Keep `DB_NAME=personal_planner`, `DB_HOST=127.0.0.1`, and port `3306`.
- Use the user's existing local MySQL password without putting it in the tracked Compose file.
- Preserve `mysql_data`; do not delete or recreate persistent data.
- Keep the `.env.example`, runtime default, schema, seed, and README database names consistent.
- Clarify the Docker startup/migration steps in the backend README.
- Do not claim a migration succeeded until it is run against the user's Docker service.

## Review Focus

- The `.env` is absent or `DB_PASSWORD` is unset: Compose must fail clearly instead of silently using a different password. Validate the required interpolation with `docker compose config -q` and inspect the interpolation declaration.
- The database name differs between Compose, `.env`, `.env.example`, runtime default, schema, seed, and README: verify each uses `personal_planner`.
- A named volume is already initialized: ensure the `mysql_data` mount remains unchanged and document that Compose initialization variables do not alter existing data.
- Another process owns port `3306`: only start the service after confirming the port is available; verify `docker compose ps`.
- Docker MySQL is not running when migration starts: document and verify the order `docker compose up -d mysql` then `npm run db:migrate`.

---

### Task 1: Synchronize Docker MySQL configuration and instructions

**Files:**
- Modify: `backend/docker-compose.yml`
- Modify: `backend/README.md`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.js`
- Modify: `backend/database/schema.sql`
- Modify: `backend/database/seed.sql`
- Test: `backend/test/env.test.js`
- Read-only local configuration: `backend/.env` (already ignored by Git; preserve its current `DB_PASSWORD`)

**Interfaces:**
- Consumes: `DB_PASSWORD` and `DB_NAME` from `backend/.env`
- Produces: Compose MySQL root initialization using required `${DB_PASSWORD}` interpolation; documented startup command `docker compose up -d mysql`; documented migration command `npm run db:migrate`

- [ ] **Step 1: Require the existing `.env` password in Compose**

Replace the hardcoded `MYSQL_ROOT_PASSWORD: root` in `backend/docker-compose.yml` with a required `DB_PASSWORD` interpolation. Preserve `MYSQL_DATABASE: personal_planner` and the `mysql_data` volume.

- [ ] **Step 2: Correct the README's database name and startup order**

Use `personal_planner` in the `.env.example`, runtime default, `database/schema.sql`, `database/seed.sql`, and README database examples. Document starting the MySQL service before running `npm run db:migrate`.

- [ ] **Step 3: Test the runtime database default**

Add `backend/test/env.test.js` asserting that `loadEnv({ JWT_SECRET: 'x'.repeat(32) }).DB_NAME` is `personal_planner`. Run `node --test backend/test/env.test.js` before changing the default and verify it fails because the current value is `personalplanner`.

- [ ] **Step 4: Validate the Compose configuration**

Run from `backend`:

```powershell
docker compose config > $null
```

Expected: exit code 0 without printing configuration values or secrets.

- [ ] **Step 5: Validate the user's Docker migration**

After confirming port `3306` is available, run `docker compose up -d mysql`, confirm `planner_mysql` is running with `docker compose ps`, then run `npm run db:migrate`.

Expected: the migration exits successfully and reports `Applied migration 001_initial_schema.sql` (or no pending migration). Do not remove the volume to resolve a failure.
