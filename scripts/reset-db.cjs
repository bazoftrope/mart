'use strict';

const path = require('path');
const { Client } = require('pg');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envConfig = require(path.join(root, 'DB', 'config', 'config.js')).development;

const dbName = envConfig.database;
if (!dbName) {
  console.error('Не удалось определить имя базы данных. Проверьте DATABASE_URL в .env.local');
  process.exit(1);
}

// Защита от случайного сброса «не той» базы и от инъекций в имя.
if (!/^[A-Za-z0-9_-]+$/.test(dbName)) {
  console.error(`Некорректное имя базы данных: "${dbName}"`);
  process.exit(1);
}

const maintenanceClient = new Client({
  host: envConfig.host || process.env.PGHOST || 'localhost',
  port: envConfig.port || Number(process.env.PGPORT) || 5432,
  user: envConfig.username || process.env.PGUSER || 'postgres',
  password: envConfig.password || process.env.PGPASSWORD || undefined,
  database: 'postgres',
});

async function main() {
  await maintenanceClient.connect();

  console.log(`Завершаю подключения к "${dbName}"...`);
  await maintenanceClient.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  );

  console.log(`Удаляю базу "${dbName}"...`);
  await maintenanceClient.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);

  console.log(`Создаю базу "${dbName}"...`);
  await maintenanceClient.query(`CREATE DATABASE "${dbName}"`);

  await maintenanceClient.end();
  console.log('База пересоздана. Запускаю миграции...');

  const migrateResult = spawnSync('npx', ['sequelize-cli', 'db:migrate'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (migrateResult.status !== 0) {
    process.exit(migrateResult.status ?? 1);
  }

  console.log('Миграции выполнены. Запускаю сиды...');

  const seedResult = spawnSync('npx', ['sequelize-cli', 'db:seed:all'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  process.exit(seedResult.status ?? 0);
}

main().catch((error) => {
  console.error(error);
  maintenanceClient.end().catch(() => {});
  process.exit(1);
});
