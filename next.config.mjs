import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
);

// Дата фиксируется на этапе сборки и вшивается в клиентский бандл,
// чтобы не зависеть от часов сервера/браузера и не ломать гидратацию.
const buildDate = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
}).format(new Date());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version,
    NEXT_PUBLIC_BUILD_DATE:
      process.env.NEXT_PUBLIC_BUILD_DATE || buildDate,
  },
};

export default nextConfig;
