# План рефакторинга страницы дня марафона для участника

## Контекст

Страница дня участника находится по пути:

```
src/pages/dashboard/marathon/[streamId]/day/[dayNumber].tsx
```

Сейчас на странице дня одновременно отображаются:

- материалы дня (`textContent`, `audioUrl`, `videoUrl`);
- форма отчёта (продукты, метрики, замеры пульса, сохранение).

Это делает страницу длинной и перегруженной. Планируется:

1. Вынести состояние страницы дня в отдельный zustand-стор.
2. Разделить интерфейс на две вкладки: **Материалы** и **Отчёт**.
3. Разбить страницу на отдельные компоненты.

---

## Цель

Сделать страницу дня участника более структурированной, удобной для поддержки и расширения.

---

## 1. Типы

Создать файл:

```
src/types/participantDay.ts
```

В нём определить типы:

- `DayMaterialsData` — материалы дня (`textContent`, `audioUrl`, `videoUrl`).
- `DayReportData` — данные сохранённого отчёта.
- `PulseReadingItem` — элемент замера пульса.
- `MetricsState` — состояние метрик (вода, шаги, сон, активность, вес).
- `ParticipantDayData` — полный ответ API `/api/streams/[id]/day/[dayNumber]`.

> Существующие типы `ReportLineItem` и `PulseFormItem` можно переиспользовать из компонентов `ReportTable` и `PulseReadingsForm`.

---

## 2. Zustand-стор

Создать файл:

```
src/stores/participantDayStore.ts
```

### Состояние стора

```ts
interface ParticipantDayState {
  data: ParticipantDayData | null;
  lines: ReportLineItem[];
  metrics: MetricsState;
  pulseReadings: PulseFormItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
}
```

### Действия стора

- `loadDay(streamId: string, dayNumber: number)` — загрузка данных дня.
- `saveReport(streamId: string, dayNumber: number)` — сохранение отчёта (POST/PUT).
- `addProductLine(product: Product)` — добавление продукта в отчёт.
- `updateLine(index: number, weightGrams: number)` — изменение веса продукта.
- `removeLine(index: number)` — удаление продукта из отчёта.
- `updateMetric(field: keyof MetricsState, value: string)` — изменение метрики.
- `addPulseReading()` — добавление замера пульса.
- `updatePulseReading(index: number, patch: Partial<PulseFormItem>)` — изменение замера.
- `removePulseReading(index: number)` — удаление замера.
- Вспомогательные функции: `emptyMetrics`, `activityToParts`, `hasAnyData`.

---

## 3. Компоненты страницы дня

Создать директорию:

```
src/components/day/
```

### 3.1. `DayHeader.tsx`

Шапка страницы дня:

- ссылка «Назад к календарю» (`/dashboard/marathon/[streamId]`);
- название марафона (из `stream.template.title`);
- номер дня;
- индикатор доступности дня (если `dayNumber > currentDayNumber`).

### 3.2. `DayTabs.tsx`

Навигация по вкладкам:

- **Материалы** — ссылка с `?tab=materials`;
- **Отчёт** — ссылка с `?tab=report`.

Активная вкладка определяется по query-параметру `tab`.

> Состояние вкладки хранится в URL, чтобы при обновлении страницы открывалась та же вкладка и можно было поделиться ссылкой.

### 3.3. `DayMaterials.tsx`

Отображение материалов дня:

- `textContent` — текстовый контент;
- `audioUrl` — аудио (если есть);
- `videoUrl` — видео (если есть).

Если материалов нет — показывать заглушку.

### 3.4. `DayReport.tsx`

Форма отчёта:

- `ProductSearch` — добавление продуктов;
- `ReportTable` — таблица продуктов;
- поля метрик: вода, шаги, сон, активность, вес;
- `PulseReadingsForm` — замеры пульса;
- кнопка «Сохранить отчёт»;
- сообщения об ошибках и дата последнего сохранения.

---

## 4. Рефакторинг страницы

Обновить файл:

```
src/pages/dashboard/marathon/[streamId]/day/[dayNumber].tsx
```

### Что должна делать страница

1. Проверять роль пользователя (редирект на `/login`, если не `participant`).
2. Читать `streamId` и `dayNumber` из `router.query`.
3. Определять активную вкладку из `router.query.tab`:
   - по умолчанию `materials`;
   - допустимые значения: `materials`, `report`.
4. Вызывать `loadDay(streamId, dayNumber)` из стора при изменении параметров.
5. Рендерить:
   - `DayHeader`;
   - `DayTabs`;
   - `DayMaterials`, если активная вкладка `materials`;
   - `DayReport`, если активная вкладка `report`.

Старую логику загрузки, сохранения и формы отчёта перенести в стор и компоненты.

---

## 5. Стили

- Обновить `Day.module.css` — оставить базовые стили страницы.
- Добавить стили для вкладок (`DayTabs.module.css` или в `Day.module.css`):
  - активная вкладка выделяется визуально;
  - неактивные вкладки ведут себя как ссылки.
- При необходимости добавить модули для `DayHeader`, `DayMaterials`, `DayReport`.

---

## 6. Проверка

### Типизация и сборка

```bash
npm run type-check
# или
npm run build
```

### Ручное тестирование

1. Открыть страницу дня — по умолчанию вкладка **Материалы**.
2. Переключиться на вкладку **Отчёт**.
3. Обновить страницу — активная вкладка должна сохраниться.
4. Добавить продукты, заполнить метрики, сохранить отчёт.
5. Убедиться, что сохранение работает и данные обновляются.
6. Проверить недоступные дни (должно быть предупреждение и отключено редактирование).

---

## Ожидаемый результат

- Появился `src/stores/participantDayStore.ts`.
- Появились компоненты в `src/components/day/`.
- Страница `src/pages/dashboard/marathon/[streamId]/day/[dayNumber].tsx` стала тонкой и использует стор + компоненты.
- На странице дня есть вкладки «Материалы» и «Отчёт».
- Состояние активной вкладки сохраняется в URL (`?tab=materials` / `?tab=report`).
- Сборка проходит без ошибок.
