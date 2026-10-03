'use strict';

/**
 * Импорт справочника продуктов из markdown-каталога в таблицу `products`.
 *
 * Источник — `DOC/products-catalog.md`: таблица `Название | Ккал | Белки | Жиры | Углеводы`.
 * Существующие названия не перезаписываются: вставляются только новые, сравнение
 * без учёта регистра. Повторный запуск безопасен (ON CONFLICT DO NOTHING).
 *
 * Использование:
 *   node scripts/import-products.cjs --dry-run         # разбор и статистика, без БД
 *   node scripts/import-products.cjs                   # импорт (DATABASE_URL из .env.local)
 *   node scripts/import-products.cjs --file other.md   # другой markdown-каталог
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const DEFAULT_CATALOG = path.join(root, 'DOC', 'products-catalog.md');
const BATCH_SIZE = 500;
const SEPARATOR = /^:?-{2,}:?$/;

function parseArgs(argv) {
  const args = { dryRun: false, file: DEFAULT_CATALOG, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--file') {
      const value = argv[i + 1];
      if (!value) throw new Error('После --file укажите путь к каталогу');
      args.file = path.resolve(process.cwd(), value);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Неизвестный аргумент: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Импорт каталога продуктов в таблицу products.

  node scripts/import-products.cjs [--dry-run] [--file <путь>]

  --dry-run   разобрать каталог и показать статистику, не подключаясь к БД
  --file      путь к markdown-каталогу (по умолчанию DOC/products-catalog.md)
`);
}

/** Разбирает markdown-таблицу в массив продуктов. */
function parseCatalog(markdown) {
  const rows = [];
  const problems = [];
  const seen = new Set();

  const lines = markdown.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length !== 5) {
      problems.push({ line: index + 1, reason: 'ожидалось 5 колонок', raw: trimmed });
      continue;
    }
    // Шапка и строка-разделитель markdown.
    if (cells[0] === 'Название' || cells.every((cell) => SEPARATOR.test(cell))) {
      continue;
    }

    const [name, ...rest] = cells;
    const numbers = rest.map((value) => Number(value));
    const invalid = numbers.some((value) => !Number.isFinite(value) || value < 0);
    if (!name || invalid) {
      problems.push({
        line: index + 1,
        reason: 'пустое название или некорректные числа',
        raw: trimmed,
      });
      continue;
    }
    if (seen.has(name)) {
      problems.push({ line: index + 1, reason: 'дубликат названия в каталоге', raw: trimmed });
      continue;
    }
    seen.add(name);

    rows.push({
      name,
      calories: numbers[0],
      protein: numbers[1],
      fat: numbers[2],
      carbs: numbers[3],
    });
  }

  return { rows, problems };
}

function printStats({ rows, problems }) {
  console.log(`Разобрано позиций: ${rows.length}`);
  if (problems.length > 0) {
    console.warn(`Проблемных строк: ${problems.length}`);
    for (const problem of problems.slice(0, 20)) {
      console.warn(`  строка ${problem.line}: ${problem.reason} — ${problem.raw}`);
    }
    if (problems.length > 20) console.warn(`  ... и ещё ${problems.length - 20}`);
  }

  if (rows.length === 0) return;
  const calories = rows.map((row) => row.calories);
  const zero = rows.filter((row) => row.calories === 0).length;
  console.log(`Калорийность: от ${Math.min(...calories)} до ${Math.max(...calories)} ккал/100 г`);
  if (zero > 0) console.log(`Позиций с нулевой калорийностью: ${zero}`);
  console.log('Примеры:');
  for (const row of rows.slice(0, 3)) {
    console.log(
      `  ${row.name} — ${row.calories} ккал, Б ${row.protein}, Ж ${row.fat}, У ${row.carbs}`
    );
  }
}

function getDbConfig() {
  const allConfig = require(path.join(root, 'DB', 'config', 'config.js'));
  return allConfig[process.env.NODE_ENV] || allConfig.development;
}

/** Вставляет пачку продуктов, не трогая уже существующие названия. */
async function insertBatch(client, batch) {
  const values = [];
  const placeholders = batch.map((row, index) => {
    const base = index * 6;
    values.push(crypto.randomUUID(), row.name, row.calories, row.protein, row.fat, row.carbs);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const sql = `INSERT INTO products (id, name, calories, protein, fat, carbs)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (name) DO NOTHING`;

  const result = await client.query(sql, values);
  return result.rowCount;
}

async function importToDb(rows) {
  const envConfig = getDbConfig();
  if (!envConfig.database) {
    throw new Error('Не удалось определить базу данных. Проверьте DATABASE_URL в .env.local');
  }

  const client = new Client({
    host: envConfig.host || process.env.PGHOST || 'localhost',
    port: envConfig.port || Number(process.env.PGPORT) || 5432,
    user: envConfig.username || process.env.PGUSER || 'postgres',
    password: envConfig.password || process.env.PGPASSWORD || undefined,
    database: envConfig.database,
  });

  await client.connect();
  try {
    const { rows: existingRows } = await client.query('SELECT lower(name) AS name FROM products');
    const existing = new Set(existingRows.map((row) => row.name));
    const toInsert = rows.filter((row) => !existing.has(row.name.toLowerCase()));

    console.log(`Уже в каталоге (совпадение без учёта регистра): ${rows.length - toInsert.length}`);
    console.log(`К импорту: ${toInsert.length}`);

    let inserted = 0;
    await client.query('BEGIN');
    try {
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        inserted += await insertBatch(client, toInsert.slice(i, i + BATCH_SIZE));
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const { rows: countRows } = await client.query('SELECT count(*)::int AS count FROM products');
    console.log(`Импортировано: ${inserted}`);
    console.log(`Всего в products: ${countRows[0].count}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!fs.existsSync(args.file)) {
    throw new Error(`Каталог не найден: ${args.file}`);
  }

  const markdown = fs.readFileSync(args.file, 'utf-8');
  const { rows, problems } = parseCatalog(markdown);

  console.log(`Каталог: ${path.relative(root, args.file)}`);
  printStats({ rows, problems });

  if (args.dryRun) {
    console.log('\n--dry-run: подключение к БД и запись не выполняются.');
    return;
  }
  if (problems.length > 0) {
    throw new Error('Каталог содержит проблемные строки, импорт отменён. Проверьте файл.');
  }

  await importToDb(rows);
}

module.exports = { parseCatalog };

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
