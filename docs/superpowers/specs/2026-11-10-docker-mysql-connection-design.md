# Docker MySQL Connection Design

## Intent

Make the backend and its Docker Compose MySQL service use the same local development credentials and database, so the documented migration command can run against the intended database.

## Goals and constraints

- Keep `DB_NAME=personal_planner`, `DB_HOST=127.0.0.1`, and port `3306`.
- Use the user's existing local MySQL password without putting it in the tracked Compose file.
- Preserve `mysql_data`; do not delete or recreate persistent data.
- Keep the `.env.example`, runtime default, schema, seed, and README database names consistent.
- Clarify the Docker startup/migration steps in the backend README.
- Do not claim a migration succeeded until it is run against the user's Docker service.

## Approaches

1. Change `.env` back to the Compose file's hardcoded password. This conflicts with the user's stated existing password and may not authenticate against an initialized volume.
2. Have Compose source `MYSQL_ROOT_PASSWORD` from `DB_PASSWORD` in the ignored backend `.env`. This keeps one local source of truth and avoids checking a password into Git. **Selected by the user.**
3. Delete the volume and initialize MySQL from scratch. Rejected because it risks losing data.

## Design

Keep the current `.env` database name and password. Change Compose to require `DB_PASSWORD` from `.env` for `MYSQL_ROOT_PASSWORD`. Update the runtime default, `.env.example`, manual schema and seed SQL, and README to use `personal_planner`; document starting MySQL before migration.

The Compose initialization variables only create the database/password for a fresh data directory. Existing-volume credentials and databases remain unchanged; no destructive volume operation is part of this change.
