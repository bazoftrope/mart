import { create } from 'zustand';
import type { Product } from '@/components/day/ProductSearch';
import type { ReportLineItem } from '@/components/day/ReportTable';
import { getCookie } from '@/lib/cookies';
import { apiFetch } from '@/lib/apiClient';
import {
  computeLineCalories,
  computeLineMacro,
  type MealType,
} from '@/lib/nutritionCalculator';
import {
  apiToPulseFormItems,
  pulseFormItemsToApi,
  type PulseFormItem,
} from '@/components/day/PulseReadingsForm';
import type {
  MetricsState,
  ParticipantDayData,
} from '@/types/participantDay';

interface ParticipantDayState {
  data: ParticipantDayData | null;
  daysCache: Record<string, Record<number, ParticipantDayData>>;
  lines: ReportLineItem[];
  metrics: MetricsState;
  comment: string;
  pulseReadings: PulseFormItem[];
  loading: boolean;
  saving: boolean;
  savingPulse: boolean;
  error: string | null;
  saveError: string | null;
  pulseSaveError: string | null;
  dirtySection: 'report' | 'pulse' | null;
}

interface ParticipantDayActions {
  loadAllDays: (streamId: string) => Promise<void>;
  selectDay: (day: ParticipantDayData) => void;
  saveReport: (streamId: string, dayNumber: number) => Promise<void>;
  savePulse: (streamId: string, dayNumber: number) => Promise<void>;
  syncCurrentDraft: () => Promise<void>;
  addProductLine: (product: Product, mealType: MealType) => void;
  updateLine: (index: number, weightGrams: number) => void;
  removeLine: (index: number) => void;
  updateMetric: (field: keyof MetricsState, value: string) => void;
  setTrainingDone: (value: boolean | null) => void;
  setComment: (value: string) => void;
  addPulseReading: () => void;
  updatePulseReading: (index: number, patch: Partial<PulseFormItem>) => void;
  removePulseReading: (index: number) => void;
  discardChanges: () => void;
  resetState: () => void;
}

type ParticipantDayStore = ParticipantDayState & ParticipantDayActions;

const DRAFT_VERSION = 2;
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DRAFT_PREFIX = 'mp:day-draft:';

type DayDraft = {
  version: number;
  userId: string;
  streamId: string;
  dayNumber: number;
  updatedAt: number;
  dirtySection: 'report' | 'pulse';
  lines: ReportLineItem[];
  metrics: MetricsState;
  comment: string;
  pulseReadings: PulseFormItem[];
};

type DayDraftPayload = Omit<
  DayDraft,
  'version' | 'userId' | 'streamId' | 'dayNumber' | 'updatedAt'
>;

function currentUserId(): string | null {
  return getCookie('mp_user_id') ?? null;
}

function draftKey(userId: string, streamId: string, dayNumber: number): string {
  return `${DRAFT_PREFIX}${userId}:${streamId}:${dayNumber}`;
}

function parseDraft(raw: string | null, expectedUserId: string): DayDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DayDraft>;
    if (
      parsed.version !== DRAFT_VERSION ||
      parsed.userId !== expectedUserId ||
      typeof parsed.streamId !== 'string' ||
      typeof parsed.dayNumber !== 'number' ||
      typeof parsed.updatedAt !== 'number' ||
      (parsed.dirtySection !== 'report' && parsed.dirtySection !== 'pulse') ||
      !Array.isArray(parsed.lines) ||
      !parsed.metrics ||
      typeof parsed.comment !== 'string' ||
      !Array.isArray(parsed.pulseReadings)
    ) {
      return null;
    }
    if (Date.now() - parsed.updatedAt > DRAFT_TTL_MS) {
      return null;
    }
    return parsed as DayDraft;
  } catch {
    return null;
  }
}

function readDraft(streamId: string, dayNumber: number): DayDraft | null {
  if (typeof window === 'undefined') return null;
  const userId = currentUserId();
  if (!userId) return null;

  const key = draftKey(userId, streamId, dayNumber);
  try {
    const draft = parseDraft(window.localStorage.getItem(key), userId);
    if (!draft) window.localStorage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(
  streamId: string,
  dayNumber: number,
  payload: DayDraftPayload | null
): void {
  if (typeof window === 'undefined') return;
  const userId = currentUserId();
  if (!userId) return;

  const key = draftKey(userId, streamId, dayNumber);
  try {
    if (!payload) {
      window.localStorage.removeItem(key);
      return;
    }

    const draft: DayDraft = {
      version: DRAFT_VERSION,
      userId,
      streamId,
      dayNumber,
      updatedAt: Date.now(),
      ...payload,
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage может быть недоступен (приватный режим, переполнение) —
    // молча пропускаем, основная логика от этого не зависит.
  }
}

function persistDraft(state: ParticipantDayState): void {
  const { data, dirtySection } = state;
  if (!data) return;

  if (!dirtySection) {
    writeDraft(data.streamId, data.dayNumber, null);
    return;
  }

  writeDraft(data.streamId, data.dayNumber, {
    dirtySection,
    lines: state.lines,
    metrics: state.metrics,
    comment: state.comment,
    pulseReadings: state.pulseReadings,
  });
}

function getCurrentTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function emptyMetrics(): MetricsState {
  return {
    waterLiters: '',
    steps: '',
    sleepHours: '',
    trainingDone: false,
    weightKg: '',
    chestCm: '',
    waistCm: '',
    hipCm: '',
    legCm: '',
  };
}

export function activityToParts(totalMinutes: number | null | undefined): {
  hours: number | '';
  minutes: number | '';
} {
  if (totalMinutes === null || totalMinutes === undefined) {
    return { hours: '', minutes: '' };
  }
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function hasAnyData(
  lines: ReportLineItem[],
  metrics: MetricsState,
  pulseReadings?: PulseFormItem[]
): boolean {
  if (lines.length > 0) return true;

  const hasMetrics =
    metrics.waterLiters !== '' ||
    metrics.steps !== '' ||
    metrics.sleepHours !== '' ||
    metrics.trainingDone !== null ||
    metrics.weightKg !== '' ||
    metrics.chestCm !== '' ||
    metrics.waistCm !== '' ||
    metrics.hipCm !== '' ||
    metrics.legCm !== '';
  if (hasMetrics) return true;

  if (pulseReadings && hasPulseData(pulseReadings)) return true;
  return false;
}

export function hasPulseData(pulseReadings: PulseFormItem[]): boolean {
  return pulseReadings.some((item) => {
    if (item.time === '') return false;
    const pulse = typeof item.pulse === 'number' ? item.pulse : item.pulse === '' ? null : Number(item.pulse);
    const sys = typeof item.systolic === 'number' ? item.systolic : item.systolic === '' ? null : Number(item.systolic);
    const dia = typeof item.diastolic === 'number' ? item.diastolic : item.diastolic === '' ? null : Number(item.diastolic);
    const hasPulse = pulse !== null && !Number.isNaN(pulse) && pulse >= 30 && pulse <= 250;
    const hasPressure = sys !== null && !Number.isNaN(sys) && dia !== null && !Number.isNaN(dia);
    return hasPulse || hasPressure;
  });
}

export function hasReportData(
  lines: ReportLineItem[],
  metrics: MetricsState,
  comment = ''
): boolean {
  return hasAnyData(lines, metrics) || comment.trim().length > 0;
}

/**
 * Более строгая проверка для автосинхронизации: не считаем пустым
 * отчёт только из-за `trainingDone: false`, который стоит по умолчанию
 * и неотличим от явно снятой галочки.
 */
function hasMeaningfulReportData(
  lines: ReportLineItem[],
  metrics: MetricsState,
  comment: string
): boolean {
  if (lines.length > 0) return true;
  if (comment.trim().length > 0) return true;
  return (
    metrics.waterLiters !== '' ||
    metrics.steps !== '' ||
    metrics.sleepHours !== '' ||
    metrics.trainingDone === true ||
    metrics.weightKg !== '' ||
    metrics.chestCm !== '' ||
    metrics.waistCm !== '' ||
    metrics.hipCm !== '' ||
    metrics.legCm !== ''
  );
}

function buildReportPayload(
  lines: ReportLineItem[],
  metrics: MetricsState,
  comment: string
) {
  return {
    lines: lines.map((line) => ({
      productId: line.productId,
      mealType: line.mealType,
      weightGrams: line.weightGrams,
    })),
    waterLiters:
      metrics.waterLiters === '' ? undefined : Number(metrics.waterLiters),
    steps: metrics.steps === '' ? undefined : Number(metrics.steps),
    sleepHours:
      metrics.sleepHours === '' ? undefined : Number(metrics.sleepHours),
    trainingDone: metrics.trainingDone,
    weightKg: metrics.weightKg === '' ? undefined : Number(metrics.weightKg),
    chestCm: metrics.chestCm === '' ? undefined : Number(metrics.chestCm),
    waistCm: metrics.waistCm === '' ? undefined : Number(metrics.waistCm),
    hipCm: metrics.hipCm === '' ? undefined : Number(metrics.hipCm),
    legCm: metrics.legCm === '' ? undefined : Number(metrics.legCm),
    comment: comment.trim(),
  };
}

function buildPulsePayload(pulseReadings: PulseFormItem[]) {
  return { pulseReadings: pulseFormItemsToApi(pulseReadings) };
}

function buildInitialPulseReadings(
  report: ParticipantDayData['report']
): PulseFormItem[] {
  if (report?.pulseReadings?.length) {
    return apiToPulseFormItems(report.pulseReadings);
  }
  return [{ time: getCurrentTime(), pulse: '', systolic: '', diastolic: '' }];
}

function buildInitialMetrics(
  report: ParticipantDayData['report']
): MetricsState {
  if (!report) return emptyMetrics();

  return {
    waterLiters: report.waterLiters ?? '',
    steps: report.steps ?? '',
    sleepHours: report.sleepHours ?? '',
    trainingDone: report.trainingDone ?? false,
    weightKg: report.weightKg ?? '',
    chestCm: report.chestCm ?? '',
    waistCm: report.waistCm ?? '',
    hipCm: report.hipCm ?? '',
    legCm: report.legCm ?? '',
  };
}

const initialState: ParticipantDayState = {
  data: null,
  daysCache: {},
  lines: [],
  metrics: emptyMetrics(),
  comment: '',
  pulseReadings: [{ time: getCurrentTime(), pulse: '', systolic: '', diastolic: '' }],
  loading: true,
  saving: false,
  savingPulse: false,
  error: null,
  saveError: null,
  pulseSaveError: null,
  dirtySection: null,
};

function applyDay(day: ParticipantDayData) {
  const draft = readDraft(day.streamId, day.dayNumber);

  return {
    data: day,
    lines: draft ? draft.lines : day.report?.lines || [],
    metrics: draft ? draft.metrics : buildInitialMetrics(day.report),
    comment: draft ? draft.comment : day.report?.comment ?? '',
    pulseReadings: draft
      ? draft.pulseReadings
      : buildInitialPulseReadings(day.report),
    dirtySection: draft ? draft.dirtySection : null,
    loading: false,
    error: null,
  };
}

async function flushDraft(key: string, draft: DayDraft): Promise<boolean> {
  try {
    if (draft.dirtySection === 'report') {
      if (!hasMeaningfulReportData(draft.lines, draft.metrics, draft.comment)) {
        window.localStorage.removeItem(key);
        return true;
      }

      const res = await apiFetch(
        `/api/streams/${draft.streamId}/day/${draft.dayNumber}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildReportPayload(draft.lines, draft.metrics, draft.comment)
          ),
        }
      );
      if (!res.ok) return false;
    } else {
      if (!hasPulseData(draft.pulseReadings)) {
        window.localStorage.removeItem(key);
        return true;
      }

      const res = await apiFetch(
        `/api/streams/${draft.streamId}/pulse/${draft.dayNumber}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPulsePayload(draft.pulseReadings)),
        }
      );
      if (!res.ok) return false;
    }

    window.localStorage.removeItem(key);
    return true;
  } catch {
    // Сеть недоступна — оставляем черновик до следующей попытки.
    return false;
  }
}

let pendingFlush: Promise<void> | null = null;

async function flushPendingDraftsInternal(): Promise<void> {
  if (typeof window === 'undefined') return;

  const userId = currentUserId();
  if (!userId || getCookie('mp_role') !== 'participant') return;

  const prefix = `${DRAFT_PREFIX}${userId}:`;
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch {
    return;
  }

  // Текущий открытый день синхронизирует сам стор через saveReport/savePulse,
  // чтобы обновить интерфейс. Здесь его пропускаем, чтобы не дублировать запрос.
  const state = useParticipantDayStore.getState();
  const currentKey =
    state.data && state.dirtySection
      ? draftKey(userId, state.data.streamId, state.data.dayNumber)
      : null;

  for (const key of keys) {
    if (key === currentKey) continue;

    const draft = parseDraft(
      window.localStorage.getItem(key),
      userId
    );
    if (!draft) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
      continue;
    }

    await flushDraft(key, draft);
  }
}

/**
 * Досылает на сервер все черновики текущего пользователя, оставшиеся
 * в localStorage после закрытия вкладки или приложения.
 */
export function flushPendingDrafts(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (pendingFlush) return pendingFlush;

  pendingFlush = flushPendingDraftsInternal().finally(() => {
    pendingFlush = null;
  });
  return pendingFlush;
}

export const useParticipantDayStore = create<ParticipantDayStore>((set, get) => ({
  ...initialState,

  resetState: () =>
    set((state) => ({ ...initialState, daysCache: state.daysCache })),

  loadAllDays: async (streamId) => {
    if (get().daysCache[streamId]) {
      set({ loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });

    try {
      const res = await fetch(`/api/streams/${streamId}/days`, {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить дни');
      }

      const days: ParticipantDayData[] = json.data?.days || [];
      const byDay: Record<number, ParticipantDayData> = {};
      for (const day of days) {
        byDay[day.dayNumber] = day;
      }

      set((state) => ({
        daysCache: { ...state.daysCache, [streamId]: byDay },
        loading: false,
        error: null,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Что-то пошло не так',
        loading: false,
      });
    }
  },

  selectDay: (day) => {
    if (!get().daysCache[day.streamId]?.[day.dayNumber]) {
      return;
    }
    const next = applyDay(day);
    set(next);

    // Открыли день с несохранённым черновиком — сразу досылаем его на сервер.
    if (next.dirtySection) {
      void get().syncCurrentDraft();
    }
    // И параллельно досылаем черновики других дней, если они остались.
    void flushPendingDrafts();
  },

  saveReport: async (streamId, dayNumber) => {
    const { data, lines, metrics, comment } = get();
    if (!data) return;

    if (!hasReportData(lines, metrics, comment)) {
      set({
        saveError: 'Необходимо заполнить хотя бы одно поле: еду или метрики',
      });
      return;
    }

    set({ saving: true, saveError: null });

    const payload = buildReportPayload(lines, metrics, comment);

    try {
      const url = data.report
        ? `/api/reports/${data.report.id}`
        : `/api/streams/${streamId}/day/${dayNumber}`;
      const method = data.report ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось сохранить отчёт');
      }

      // preserve existing pulseReadings from state (dedicated endpoint)
      const currentPulse = get().pulseReadings;

      const updatedReport = {
        id: json.data.id,
        totalCalories: json.data.totalCalories,
        filledAt: json.data.filledAt,
        updatedAt: json.data.updatedAt,
        waterLiters: json.data.waterLiters ?? null,
        steps: json.data.steps ?? null,
        sleepHours: json.data.sleepHours ?? null,
        activityMinutes: json.data.activityMinutes ?? null,
        trainingDone: json.data.trainingDone ?? null,
        weightKg: json.data.weightKg ?? null,
        chestCm: json.data.chestCm ?? null,
        waistCm: json.data.waistCm ?? null,
        hipCm: json.data.hipCm ?? null,
        legCm: json.data.legCm ?? null,
        comment: json.data.comment ?? null,
        pulseReadings: json.data.pulseReadings ?? data.report?.pulseReadings ?? [],
        lines: json.data.lines,
      };

      const updatedData: ParticipantDayData = {
        ...data,
        report: updatedReport,
      };

      set((state) => ({
        data: updatedData,
        daysCache: {
          ...state.daysCache,
          [data.streamId]: {
            ...state.daysCache[data.streamId],
            [data.dayNumber]: updatedData,
          },
        },
        lines: json.data.lines,
        metrics: {
          waterLiters: json.data.waterLiters ?? '',
          steps: json.data.steps ?? '',
          sleepHours: json.data.sleepHours ?? '',
          trainingDone: json.data.trainingDone ?? false,
          weightKg: json.data.weightKg ?? '',
          chestCm: json.data.chestCm ?? '',
          waistCm: json.data.waistCm ?? '',
          hipCm: json.data.hipCm ?? '',
          legCm: json.data.legCm ?? '',
        },
        comment: json.data.comment ?? '',
        // keep pulse form as is; server pulse preserved
        pulseReadings: currentPulse,
        saving: false,
        saveError: null,
        dirtySection: null,
      }));
    } catch (err) {
      set({
        saveError: err instanceof Error ? err.message : 'Что-то пошло не так',
        saving: false,
      });
    }
  },

  savePulse: async (streamId, dayNumber) => {
    const { data, pulseReadings } = get();
    if (!data) return;

    if (!hasPulseData(pulseReadings)) {
      set({ pulseSaveError: 'Добавьте хотя бы один замер: укажите время и пульс или давление (сист./диаст.)' });
      return;
    }

    set({ savingPulse: true, pulseSaveError: null });

    const payload = buildPulsePayload(pulseReadings);

    try {
      const res = await fetch(`/api/streams/${streamId}/pulse/${dayNumber}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось сохранить замеры');
      }

      const newPulse: typeof pulseReadings = json.data.pulseReadings?.length
        ? apiToPulseFormItems(json.data.pulseReadings)
        : [{ time: getCurrentTime(), pulse: '', systolic: '', diastolic: '' }];

      const updatedReport = data.report
        ? { ...data.report, pulseReadings: json.data.pulseReadings ?? [] }
        : data.report;

      // if report was null, we now have a report id from pulse endpoint
      let nextReport = updatedReport;
      if (!data.report && json.data.reportId) {
        nextReport = {
          id: json.data.reportId,
          totalCalories: 0,
          filledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          waterLiters: null,
          steps: null,
          sleepHours: null,
          activityMinutes: null,
          trainingDone: null,
          weightKg: null,
          chestCm: null,
          waistCm: null,
          hipCm: null,
          legCm: null,
          comment: null,
          pulseReadings: json.data.pulseReadings ?? [],
          lines: [],
        };
      }

      const updatedData: ParticipantDayData = {
        ...data,
        report: nextReport as ParticipantDayData['report'],
      };

      set((state) => ({
        data: updatedData,
        daysCache: {
          ...state.daysCache,
          [data.streamId]: {
            ...state.daysCache[data.streamId],
            [data.dayNumber]: updatedData,
          },
        },
        pulseReadings: newPulse,
        savingPulse: false,
        pulseSaveError: null,
        dirtySection: null,
      }));
    } catch (err) {
      set({
        pulseSaveError: err instanceof Error ? err.message : 'Что-то пошло не так',
        savingPulse: false,
      });
    }
  },

  syncCurrentDraft: async () => {
    const {
      data,
      dirtySection,
      saving,
      savingPulse,
      lines,
      metrics,
      comment,
      pulseReadings,
    } = get();

    if (!data || !dirtySection || saving || savingPulse || !data.isEditable) {
      return;
    }

    if (dirtySection === 'report') {
      if (!hasMeaningfulReportData(lines, metrics, comment)) return;
      await get().saveReport(data.streamId, data.dayNumber);
      return;
    }

    if (!hasPulseData(pulseReadings)) return;
    await get().savePulse(data.streamId, data.dayNumber);
  },

  addProductLine: (product, mealType) => {
    const { lines } = get();

    const newLine: ReportLineItem = {
      productId: product.id,
      name: product.name,
      calories: product.calories,
      protein: product.protein,
      fat: product.fat,
      carbs: product.carbs,
      mealType,
      weightGrams: 100,
      lineCalories: computeLineCalories(100, product.calories),
      lineProtein: computeLineMacro(100, product.protein),
      lineFat: computeLineMacro(100, product.fat),
      lineCarbs: computeLineMacro(100, product.carbs),
    };
    set({
      lines: [...lines, newLine],
      saveError: null,
      dirtySection: 'report',
    });
  },

  updateLine: (index, weightGrams) => {
    const { lines } = get();
    const next = lines.map((line, i) => {
      if (i !== index) return line;
      return {
        ...line,
        weightGrams,
        lineCalories: computeLineCalories(weightGrams, line.calories),
        lineProtein: computeLineMacro(weightGrams, line.protein),
        lineFat: computeLineMacro(weightGrams, line.fat),
        lineCarbs: computeLineMacro(weightGrams, line.carbs),
      };
    });
    set({ lines: next, dirtySection: 'report' });
  },

  removeLine: (index) => {
    const { lines } = get();
    set({
      lines: lines.filter((_, i) => i !== index),
      dirtySection: 'report',
    });
  },

  updateMetric: (field, value) => {
    set((state) => ({
      metrics: {
        ...state.metrics,
        [field]: value === '' ? '' : Number(value),
      },
      dirtySection: 'report',
    }));
  },

  setTrainingDone: (value) => {
    set((state) => ({
      metrics: {
        ...state.metrics,
        trainingDone: value,
      },
      dirtySection: 'report',
    }));
  },

  setComment: (value) => {
    set({ comment: value, saveError: null, dirtySection: 'report' });
  },

  addPulseReading: () => {
    set((state) => ({
      pulseReadings: [...state.pulseReadings, { time: getCurrentTime(), pulse: '', systolic: '', diastolic: '' }],
      dirtySection: 'pulse',
    }));
  },

  updatePulseReading: (index, patch) => {
    set((state) => ({
      pulseReadings: state.pulseReadings.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
      dirtySection: 'pulse',
    }));
  },

  removePulseReading: (index) => {
    set((state) => ({
      pulseReadings: state.pulseReadings.filter((_, i) => i !== index),
      dirtySection: 'pulse',
    }));
  },

  discardChanges: () => {
    const { data } = get();
    if (!data) {
      set({ dirtySection: null });
      return;
    }

    set({
      lines: data.report?.lines || [],
      metrics: buildInitialMetrics(data.report),
      comment: data.report?.comment ?? '',
      pulseReadings: buildInitialPulseReadings(data.report),
      dirtySection: null,
      saveError: null,
      pulseSaveError: null,
    });
  },
}));

useParticipantDayStore.subscribe((state, prev) => {
  if (
    state.data !== prev.data ||
    state.dirtySection !== prev.dirtySection ||
    state.lines !== prev.lines ||
    state.metrics !== prev.metrics ||
    state.comment !== prev.comment ||
    state.pulseReadings !== prev.pulseReadings
  ) {
    persistDraft(state);
  }
});
