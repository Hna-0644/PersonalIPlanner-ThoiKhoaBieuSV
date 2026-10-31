require('dotenv').config();
const { loadEnv } = require('./config/env');
const { createDatabase } = require('./config/database');
const { createApp } = require('./app');

async function start() {
  const config = loadEnv();
  const pool = createDatabase(config);
  await pool.query('SELECT 1');
  const app = createApp({ pool, config });
  const server = app.listen(config.PORT, () => {
    console.log(`PersonalPlanner API listening on port ${config.PORT}`);
  });

  const shutdown = async signal => {
    console.log(`Received ${signal}; shutting down.`);
    server.close(async error => {
      await pool.end();
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
  console.error('Failed to start PersonalPlanner API:', error);
  process.exitCode = 1;
});
