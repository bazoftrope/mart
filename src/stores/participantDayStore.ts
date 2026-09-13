import { create } from 'zustand';
import type { Product } from '@/components/day/ProductSearch';
import {
  computeLineCalories,
  type ReportLineItem,
} from '@/components/day/ReportTable';
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
  pulseReadings: PulseFormItem[];
  loading: boolean;
  saving: boolean;
  savingPulse: boolean;
  error: string | null;
  saveError: string | null;
  pulseSaveError: string | null;
}

interface ParticipantDayActions {
  loadAllDays: (streamId: string) => Promise<void>;
  selectDay: (day: ParticipantDayData) => void;
  saveReport: (streamId: string, dayNumber: number) => Promise<void>;
  savePulse: (streamId: string, dayNumber: number) => Promise<void>;
  addProductLine: (product: Product) => void;
  updateLine: (index: number, weightGrams: number) => void;
  removeLine: (index: number) => void;
  updateMetric: (field: keyof MetricsState, value: string) => void;
  setTrainingDone: (value: boolean | null) => void;
  addPulseReading: () => void;
  updatePulseReading: (index: number, patch: Partial<PulseFormItem>) => void;
  removePulseReading: (index: number) => void;
  resetState: () => void;
}

type ParticipantDayStore = ParticipantDayState & ParticipantDayActions;

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
    trainingDone: null,
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

export function hasReportData(lines: ReportLineItem[], metrics: MetricsState): boolean {
  return hasAnyData(lines, metrics);
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
    trainingDone: report.trainingDone ?? null,
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
  pulseReadings: [{ time: getCurrentTime(), pulse: '', systolic: '', diastolic: '' }],
  loading: true,
  saving: false,
  savingPulse: false,
  error: null,
  saveError: null,
  pulseSaveError: null,
};

function applyDay(day: ParticipantDayData) {
  return {
    data: day,
    lines: day.report?.lines || [],
    metrics: buildInitialMetrics(day.report),
    pulseReadings: buildInitialPulseReadings(day.report),
    loading: false,
    error: null,
  };
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
    set(applyDay(day));
  },

  saveReport: async (streamId, dayNumber) => {
    const { data, lines, metrics } = get();
    if (!data) return;

    if (!hasReportData(lines, metrics)) {
      set({
        saveError: 'Необходимо заполнить хотя бы одно поле: еду или метрики',
      });
      return;
    }

    set({ saving: true, saveError: null });

    const payload = {
      lines: lines.map((line) => ({
        productId: line.productId,
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
    };

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
          trainingDone: json.data.trainingDone ?? null,
          weightKg: json.data.weightKg ?? '',
          chestCm: json.data.chestCm ?? '',
          waistCm: json.data.waistCm ?? '',
          hipCm: json.data.hipCm ?? '',
          legCm: json.data.legCm ?? '',
        },
        // keep pulse form as is; server pulse preserved
        pulseReadings: currentPulse,
        saving: false,
        saveError: null,
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

    const payload = {
      pulseReadings: pulseFormItemsToApi(pulseReadings),
    };

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
      }));
    } catch (err) {
      set({
        pulseSaveError: err instanceof Error ? err.message : 'Что-то пошло не так',
        savingPulse: false,
      });
    }
  },

  addProductLine: (product) => {
    const { lines } = get();
    const exists = lines.some((line) => line.productId === product.id);
    if (exists) {
      set({ saveError: 'Этот продукт уже добавлен в отчёт' });
      return;
    }

    const newLine: ReportLineItem = {
      productId: product.id,
      name: product.name,
      calories: product.calories,
      weightGrams: 100,
      lineCalories: computeLineCalories(100, product.calories),
    };
    set({
      lines: [...lines, newLine],
      saveError: null,
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
      };
    });
    set({ lines: next });
  },

  removeLine: (index) => {
    const { lines } = get();
    set({ lines: lines.filter((_, i) => i !== index) });
  },

  updateMetric: (field, value) => {
    set((state) => ({
      metrics: {
        ...state.metrics,
        [field]: value === '' ? '' : Number(value),
      },
    }));
  },

  setTrainingDone: (value) => {
    set((state) => ({
      metrics: {
        ...state.metrics,
        trainingDone: value,
      },
    }));
  },

  addPulseReading: () => {
    set((state) => ({
      pulseReadings: [...state.pulseReadings, { time: getCurrentTime(), pulse: '', systolic: '', diastolic: '' }],
    }));
  },

  updatePulseReading: (index, patch) => {
    set((state) => ({
      pulseReadings: state.pulseReadings.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  },

  removePulseReading: (index) => {
    set((state) => ({
      pulseReadings: state.pulseReadings.filter((_, i) => i !== index),
    }));
  },
}));
