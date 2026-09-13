'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// Демо-шаблон марафона 21 день для Ирины и Вовы (менторы).
//
// Почему 2 копии: MarathonTemplate.mentorId — FK на одного User.
// Привязать один шаблон к двум менторам невозможно, поэтому
// создаём две идентичные копии — по одной на каждого ментора.
// Логика/материалы/видео одинаковые, отличается только mentorId.
//
// Видео везде одно: https://kinescope.io/5xHZrDYYHwJwfcbKJv2FUr
// В БД хранится нормализованный videoId "5xHZrDYYHwJwfcbKJv2FUr"
// (валидация в src/lib/validate.ts → normalizeKinescopeVideoId).
//
// Аудио: как быть без реального контента, но увидеть карточку?
// ------------------------------------------------------------
// Варианты:
// 1) Внешний URL (https://...mp3) — <audio> сыграет, но файл вне проекта.
// 2) Локальная заглушка /api/uploads/audio/<templateId>/file.mp3 —
//    требует реального файла на диске в data/uploads/audio/<templateId>/.
//    Без файла AttachmentPlayers всё равно отрендерит карточку
//    (AudioPlayer + описание), но запрос вернёт 404 и плеер не заиграет.
// 3) То же, что (2), но с реальным dummy-файлом — плеер грузится без 404.
//
// Этот сидер идёт по пути (3) для наглядности:
// - для каждой аудио-строки создаёт тихий 1-сек MP3 (silence) в
//   data/uploads/audio/<templateId>/demo-audio-day-N-*.mp3
// - для каждого PDF — минимальный валидный PDF в той же папке
//   data/uploads/audio/<templateId>/demo-pdf-day-N-*.pdf
//   (оба вида файлов лежат в одной папке — так устроен UPLOAD_DIR,
//   см. src/lib/fileUpload.ts:getUploadRoot / getTemplateUploadDir).
//   URL при этом всё равно разный: /api/uploads/audio/... vs /api/uploads/file/...
//   но на диске папка общая.
// Если заглушки не нужны — можно удалить создание файлов, оставив только
// строки в template_attachments: карточки всё равно появятся.
// ------------------------------------------------------------

const VIDEO_ID = '5xHZrDYYHwJwfcbKJv2FUr';
const VIDEO_URL = 'https://kinescope.io/5xHZrDYYHwJwfcbKJv2FUr';

// Менторы из сидера 20260915000001-dev-personal-accounts.js
const IRINA_MENTOR_ID = '50000000-0000-0000-0000-000000000001';
const VOVA_MENTOR_ID = '50000000-0000-0000-0000-000000000003';

const TEMPLATES = [
  {
    id: '6e3dc02f-2706-4c20-bd78-d94f7c4faebb',
    mentorId: IRINA_MENTOR_ID,
    title: '21 день — Перезагрузка питания и движения',
    description:
      'Демонстрационный шаблон на 21 день. Показывает все типы дней и комбинаций материалов: аудио, видео, аудио+видео, аудио+PDF и видео+PDF.',
    status: 'approved',
  },
  {
    id: '55050a2d-34fd-4cbd-9a3d-17749ead10a3',
    mentorId: VOVA_MENTOR_ID,
    title: '21 день — Перезагрузка питания и движения',
    description:
      'Копия того же демо-шаблона для второго ментора (Вова). Содержание полностью идентично версии Ирины.',
    status: 'approved',
  },
];

const DURATION = 21;

// Распределение назначений по дням.
// isMeasurementDay — замеры веса/охватов
// isTrainingDay — день тренировки
// isRestDay — день отдыха
// isHealthyEatingDay — день здоровой еды
// Каждый день имеет хотя бы один флаг, чтобы наглядно проверить иконки в календаре/DayHeader.
const DAY_FLAGS = [
  // неделя 1
  { isMeasurementDay: true, isTrainingDay: false, isRestDay: false, isHealthyEatingDay: true }, // 1 пн — старт + замеры
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 2 вт — тренировка
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: false, isHealthyEatingDay: true }, // 3 ср — еда
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 4 чт — тренировка
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: true, isHealthyEatingDay: false }, // 5 пт — отдых
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: true }, // 6 сб — тренировка+еда
  { isMeasurementDay: true, isTrainingDay: false, isRestDay: true, isHealthyEatingDay: false }, // 7 вс — замеры+отдых
  // неделя 2
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 8
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: false, isHealthyEatingDay: true }, // 9
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 10
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: true, isHealthyEatingDay: false }, // 11
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: true }, // 12
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: true, isHealthyEatingDay: true }, // 13 отдых+еда
  { isMeasurementDay: true, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 14 замеры+тренировка
  // неделя 3
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 15
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: false, isHealthyEatingDay: true }, // 16
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: false }, // 17
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: true, isHealthyEatingDay: false }, // 18
  { isMeasurementDay: false, isTrainingDay: true, isRestDay: false, isHealthyEatingDay: true }, // 19 трен+еда
  { isMeasurementDay: false, isTrainingDay: false, isRestDay: true, isHealthyEatingDay: false }, // 20 отдых перед финалом
  { isMeasurementDay: true, isTrainingDay: false, isRestDay: false, isHealthyEatingDay: true }, // 21 финал замеры+еда
];

const DAY_TEXTS = [
  '<p><strong>День 1 — Старт.</strong> Знакомимся, ставим цель и делаем первые замеры. Видео — одна и та же ссылка Kinescope для всех дней, чтобы проверить плеер. Аудио — заглушка (тишина), чтобы увидеть карточку AudioPlayer.</p><p>Задание: честно заполнить профиль (рост/вес/возраст) и сделать базовые замеры.</p>',
  '<p><strong>День 2 — Тренировка.</strong> Лёгкая разминка + аудио-инструкция с PDF-конспектом (pairId — комплект «аудио+PDF»). Проверь связку: под плеером должна быть ссылка на PDF.</p>',
  '<p><strong>День 3 — Питание.</strong> Разбираем тарелку здорового питания. Видео + PDF-конспект — комплект «видео+PDF» (pairId).</p>',
  '<p><strong>День 4 — Движение + поддержка.</strong> Комбинируем: отдельное аудио (standalone) и видео с PDF в одной карточке. Так видно, как различаются одиночные и групповые карточки.</p>',
  '<p><strong>День 5 — Отдых.</strong> Только аудио — день восстановления. Проверь, что без видео карточка аудио всё равно рендерится.</p>',
  '<p><strong>День 6 — Еда + тренировка.</strong> Только видео (без аудио/PDF) — день здорового питания с видеорецептом.</p>',
  '<p><strong>День 7 — Замеры + отдых.</strong> Аудио (standalone) + видео (standalone) — два отдельных плеера, без PDF. Недельный чек-поинт: сравни вес/охваты с днём 1.</p>',
  '<p><strong>День 8 — Комбо-пары.</strong> Два комплекта рядом: аудио+PDF и видео+PDF. Должны отобразиться две карточки AttachmentPairCards.</p>',
  '<p><strong>День 9 — Аудио-комплект.</strong> Ещё один аудио+PDF, другой fileName — убедись, что название PDF показывается корректно.</p>',
  '<p><strong>День 10 — Видео-комплект.</strong> Видео+PDF, зеркало дня 9.</p>',
  '<p><strong>День 11 — Тройное комбо.</strong> Аудио standalone + видео standalone + аудио+PDF pair — самая насыщенная конфигурация.</p>',
  '<p><strong>День 12 — Тренировка + еда.</strong> Видео standalone + аудио+PDF pair.</p>',
  '<p><strong>День 13 — Только аудио.</strong> Минимальный день — одна аудиодорожка.</p>',
  '<p><strong>День 14 — Замеры + тренировка.</strong> Видео+PDF pair + аудио standalone — микс перед экватором.</p>',
  '<p><strong>День 15 — Питание + движение.</strong> Аудио+PDF pair + видео standalone.</p>',
  '<p><strong>День 16 — Здоровая еда.</strong> Только видео — ещё один «чистый» видеодень.</p>',
  '<p><strong>День 17 — Максимум комбинаций.</strong> Аудио+PDF + видео+PDF + аудио standalone — три карточки (две парные и одна одиночная).</p>',
  '<p><strong>День 18 — Баланс.</strong> Аудио standalone + видео standalone — без PDF, ровный день отдыха/восстановления.</p>',
  '<p><strong>День 19 — Фокус на видео-конспект.</strong> Видео+PDF.</p>',
  '<p><strong>День 20 — Предфинал.</strong> Аудио+PDF — подготовка к итоговым замерам.</p>',
  '<p><strong>День 21 — Финал.</strong> Два комплекта: аудио+PDF и видео+PDF + финальные замеры. Отличное место проверить оба типа парных карточек на одном дне.</p>',
];

// План вложений по дням — покрывает все требуемые комбинации:
// аудио | видео | аудио+видео | аудио+PDF | видео+PDF
const ATTACHMENT_PLAN = {
  1: [
    { kind: 'video', paired: false, desc: 'Видеоурок — пример одной ссылки Kinescope для всех дней' },
    { kind: 'audio', paired: false, desc: 'Аудио — заглушка, просто чтобы увидеть плеер' },
  ],
  2: [{ kind: 'audio', paired: true, desc: 'Аудио-инструкция к тренировке + PDF-конспект (комплект)' }],
  3: [{ kind: 'video', paired: true, desc: 'Видеоразбор + PDF-памятка (комплект видео+PDF)' }],
  4: [
    { kind: 'audio', paired: false, desc: 'Отдельное аудио без PDF' },
    { kind: 'video', paired: true, desc: 'Видео с прикреплённым PDF' },
  ],
  5: [{ kind: 'audio', paired: false, desc: 'Только аудио — день отдыха' }],
  6: [{ kind: 'video', paired: false, desc: 'Только видео — день питания' }],
  7: [
    { kind: 'audio', paired: false, desc: 'Аудио standalone' },
    { kind: 'video', paired: false, desc: 'Видео standalone — два плеера на одном дне' },
  ],
  8: [
    { kind: 'audio', paired: true, desc: 'Аудио + PDF (первый комплект дня)' },
    { kind: 'video', paired: true, desc: 'Видео + PDF (второй комплект дня)' },
  ],
  9: [{ kind: 'audio', paired: true, desc: 'Аудио + PDF' }],
  10: [{ kind: 'video', paired: true, desc: 'Видео + PDF' }],
  11: [
    { kind: 'audio', paired: false, desc: 'Аудио standalone' },
    { kind: 'video', paired: false, desc: 'Видео standalone' },
    { kind: 'audio', paired: true, desc: 'Аудио + PDF (комплект)' },
  ],
  12: [
    { kind: 'video', paired: false, desc: 'Видео standalone' },
    { kind: 'audio', paired: true, desc: 'Аудио + PDF' },
  ],
  13: [{ kind: 'audio', paired: false, desc: 'Только аудио' }],
  14: [
    { kind: 'video', paired: true, desc: 'Видео + PDF' },
    { kind: 'audio', paired: false, desc: 'Аудио standalone' },
  ],
  15: [
    { kind: 'audio', paired: true, desc: 'Аудио + PDF' },
    { kind: 'video', paired: false, desc: 'Видео standalone' },
  ],
  16: [{ kind: 'video', paired: false, desc: 'Только видео' }],
  17: [
    { kind: 'audio', paired: true, desc: 'Аудио + PDF — комплект 1' },
    { kind: 'video', paired: true, desc: 'Видео + PDF — комплект 2' },
    { kind: 'audio', paired: false, desc: 'Аудио standalone — дополнение' },
  ],
  18: [
    { kind: 'audio', paired: false, desc: 'Аудио standalone' },
    { kind: 'video', paired: false, desc: 'Видео standalone' },
  ],
  19: [{ kind: 'video', paired: true, desc: 'Видео + PDF' }],
  20: [{ kind: 'audio', paired: true, desc: 'Аудио + PDF — предфинал' }],
  21: [
    { kind: 'audio', paired: true, desc: 'Аудио + PDF — финал, комплект 1' },
    { kind: 'video', paired: true, desc: 'Видео + PDF — финал, комплект 2' },
  ],
};

function introTextFor(mentorName) {
  return [
    `<p>Привет! Это демо-марафон «21 день — Перезагрузка» — шаблон, созданный сидером для проверки отображения всех типов материалов.</p>`,
    `<p>Владелец шаблона: <strong>${mentorName}</strong>. Длительность 21 день, статус <em>approved</em> — можно сразу запускать потоки (POST /api/streams).</p>`,
    `<p>Видео во всех днях — одна и та же ссылка Kinescope для примера: <code>${VIDEO_URL}</code> (в БД хранится ID <code>${VIDEO_ID}</code>).</p>`,
    `<p>Аудио и PDF — локальные заглушки (тишина 1 сек + минимальный PDF), чтобы карточки <code>AttachmentPlayers / AttachmentPairCards</code> точно отрендерились даже без реального контента.</p>`,
    `<p>Назначения дней распределены по флагу: замеры (1,7,14,21), тренировки, отдых и здоровая еда — смотри иконки в календаре.</p>`,
  ].join('\n');
}

function getUploadDir(templateId) {
  const root = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), 'data', 'uploads', 'audio');
  return path.join(root, templateId);
}

// Минимальный тихий MP3 (1 сек, ~4KB). Декодируется в валидный MP3.
// Достаточно, чтобы <audio> не падал в 404 и показывал успешную загрузку.
const SILENCE_MP3_BASE64 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjMyLjEwNAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAASAAAeAAABBQAAQUBAQEBAYEBgYFBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGAQEBAYEBgYFBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGA=';

function buildPdfBuffer(dayNumber, pairIndex) {
  const text = `Demo PDF - Day ${dayNumber}.${pairIndex} (silence placeholder)`;
  // Minimal PDF with one page and Helvetica text
  const content = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >> endobj',
    `4 0 obj << /Length ${44 + text.length} >> stream`,
    `BT /F1 18 Tf 50 750 Td (${text}) Tj ET`,
    'endstream endobj',
    'xref',
    '0 5',
    '0000000000 65535 f ',
    '0000000010 00000 n ',
    '0000000060 00000 n ',
    '0000000120 00000 n ',
    '0000000300 00000 n ',
    'trailer << /Size 5 /Root 1 0 R >>',
    'startxref 450',
    '%%EOF',
  ].join('\n');
  return Buffer.from(content, 'utf8');
}

function ensureDummyFiles(templateId, attachments) {
  const dir = getUploadDir(templateId);
  fs.mkdirSync(dir, { recursive: true });
  const mp3Buffer = Buffer.from(SILENCE_MP3_BASE64, 'base64');

  for (const att of attachments) {
    if (att.kind === 'audio') {
      // url = /api/uploads/audio/<templateId>/<filename>
      const filename = path.basename(att.url);
      const full = path.join(dir, filename);
      if (!fs.existsSync(full)) {
        fs.writeFileSync(full, mp3Buffer);
      }
    }
    if (att.kind === 'file') {
      const filename = path.basename(att.url);
      const full = path.join(dir, filename);
      if (!fs.existsSync(full)) {
        // extract day from filename demo-pdf-day-N-*.pdf if possible
        const m = filename.match(/day-(\d+)/i);
        const dayNum = m ? m[1] : '1';
        const pdfBuf = buildPdfBuffer(dayNum, '1');
        fs.writeFileSync(full, pdfBuf);
      }
    }
  }
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const tpl of TEMPLATES) {
      const existing = await queryInterface.rawSelect(
        'marathon_templates',
        { where: { id: tpl.id } },
        ['id']
      );
      if (existing) {
        console.log(`[seed] template ${tpl.id} (${tpl.title}) already exists — skip`);
        continue;
      }

      // Проверка наличия ментора (из dev-аккаунтов)
      const mentor = await queryInterface.rawSelect('users', { where: { id: tpl.mentorId } }, ['id']);
      if (!mentor) {
        console.warn(`[seed] mentor ${tpl.mentorId} not found — пропускаем шаблон ${tpl.id}. Сначала запустите сидер dev-personal-accounts.`);
        continue;
      }

      const mentorName = tpl.mentorId === IRINA_MENTOR_ID ? 'Ирина (ментор)' : 'Вова (ментор)';

      await queryInterface.bulkInsert('marathon_templates', [
        {
          id: tpl.id,
          mentor_id: tpl.mentorId,
          title: tpl.title,
          description: tpl.description,
          duration_days: DURATION,
          status: tpl.status,
          intro_text: introTextFor(mentorName),
          created_at: now,
          updated_at: now,
        },
      ]);
      console.log(`[seed] template created: ${tpl.title} (${tpl.id}) → mentor ${mentorName} (${tpl.mentorId})`);

      // Дни
      const dayRows = [];
      const dayIdByNumber = new Map();
      for (let n = 1; n <= DURATION; n++) {
        const id = crypto.randomUUID();
        dayIdByNumber.set(n, id);
        const flags = DAY_FLAGS[n - 1];
        dayRows.push({
          id,
          template_id: tpl.id,
          day_number: n,
          text_content: DAY_TEXTS[n - 1],
          is_measurement_day: flags.isMeasurementDay,
          is_training_day: flags.isTrainingDay,
          is_rest_day: flags.isRestDay,
          is_healthy_eating_day: flags.isHealthyEatingDay,
        });
      }
      await queryInterface.bulkInsert('template_days', dayRows);
      console.log(`[seed] ${dayRows.length} days for template ${tpl.id}`);

      // Вложения
      const attachmentRows = [];
      // Для dummy-файлов соберём список созданных аудио/pdf вложений
      const dummyAttachments = [];

      for (let dayNumber = 1; dayNumber <= DURATION; dayNumber++) {
        const plan = ATTACHMENT_PLAN[dayNumber] || [];
        const dayId = dayIdByNumber.get(dayNumber);
        let position = 0;

        for (let pi = 0; pi < plan.length; pi++) {
          const spec = plan[pi];
          const isPaired = spec.paired;
          const pairId = isPaired ? crypto.randomUUID() : null;

          if (spec.kind === 'audio') {
            const filename = `demo-audio-day-${dayNumber}-${pi + 1}.mp3`;
            const url = `/api/uploads/audio/${tpl.id}/${filename}`;
            const row = {
              id: crypto.randomUUID(),
              template_id: tpl.id,
              template_day_id: dayId,
              scope: 'day',
              kind: 'audio',
              url,
              file_name: `Аудио — день ${dayNumber} (${pi + 1})`,
              mime_type: 'audio/mpeg',
              size_bytes: Buffer.from(SILENCE_MP3_BASE64, 'base64').length,
              position: position++,
              pair_id: pairId,
              description: spec.desc,
              created_at: now,
            };
            attachmentRows.push(row);
            dummyAttachments.push(row);

            if (isPaired) {
              const pdfFilename = `demo-pdf-day-${dayNumber}-${pi + 1}.pdf`;
              const pdfUrl = `/api/uploads/file/${tpl.id}/${pdfFilename}`;
              const pdfBuf = buildPdfBuffer(dayNumber, pi + 1);
              const pdfRow = {
                id: crypto.randomUUID(),
                template_id: tpl.id,
                template_day_id: dayId,
                scope: 'day',
                kind: 'file',
                url: pdfUrl,
                file_name: `Методичка — день ${dayNumber} (${pi + 1}).pdf`,
                mime_type: 'application/pdf',
                size_bytes: pdfBuf.length,
                position: position++,
                pair_id: pairId,
                description: null,
                created_at: now,
              };
              attachmentRows.push(pdfRow);
              dummyAttachments.push(pdfRow);
            }
          } else if (spec.kind === 'video') {
            const row = {
              id: crypto.randomUUID(),
              template_id: tpl.id,
              template_day_id: dayId,
              scope: 'day',
              kind: 'video',
              url: VIDEO_ID,
              file_name: `Видео — день ${dayNumber} (${pi + 1})`,
              mime_type: null,
              size_bytes: null,
              position: position++,
              pair_id: pairId,
              description: spec.desc,
              created_at: now,
            };
            attachmentRows.push(row);

            if (isPaired) {
              const pdfFilename = `demo-pdf-day-${dayNumber}-${pi + 1}.pdf`;
              const pdfUrl = `/api/uploads/file/${tpl.id}/${pdfFilename}`;
              const pdfBuf = buildPdfBuffer(dayNumber, pi + 1);
              const pdfRow = {
                id: crypto.randomUUID(),
                template_id: tpl.id,
                template_day_id: dayId,
                scope: 'day',
                kind: 'file',
                url: pdfUrl,
                file_name: `Методичка — день ${dayNumber} (${pi + 1}).pdf`,
                mime_type: 'application/pdf',
                size_bytes: pdfBuf.length,
                position: position++,
                pair_id: pairId,
                description: null,
                created_at: now,
              };
              attachmentRows.push(pdfRow);
              dummyAttachments.push(pdfRow);
            }
          }
        }
      }

      if (attachmentRows.length) {
        await queryInterface.bulkInsert('template_attachments', attachmentRows);
        console.log(`[seed] ${attachmentRows.length} attachments for template ${tpl.id} (audio/video/file mix)`);
      }

      try {
        ensureDummyFiles(tpl.id, dummyAttachments);
        console.log(`[seed] dummy audio/PDF files written to data/uploads/audio/${tpl.id}/`);
      } catch (e) {
        console.warn(`[seed] failed to write dummy files for ${tpl.id}: ${e.message}`);
      }
    }

    console.log('[seed] demo 21-day templates done');
  },

  async down(queryInterface) {
    const templateIds = TEMPLATES.map((t) => t.id);

    await queryInterface.bulkDelete('template_attachments', { template_id: templateIds }, {});
    await queryInterface.bulkDelete('template_days', { template_id: templateIds }, {});
    await queryInterface.bulkDelete('marathon_templates', { id: templateIds }, {});

    // Удаляем заглушки с диска
    for (const tid of templateIds) {
      const dir = getUploadDir(tid);
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`[seed] removed dummy dir ${dir}`);
        }
      } catch (e) {
        console.warn(`[seed] failed to remove ${dir}: ${e.message}`);
      }
    }
    console.log('[seed] demo 21-day templates removed');
  },
};
