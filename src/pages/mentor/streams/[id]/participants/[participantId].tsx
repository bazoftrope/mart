import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import styles from './ParticipantDetail.module.css';
import { apiFetch } from '@/lib/apiClient';
import { MEAL_LABELS, type MealType } from '@/lib/nutritionCalculator';

type ReportLineItem = {
  id: string;
  productId: string;
  name: string;
  calories: number;
  mealType: MealType;
  weightGrams: number;
  lineCalories: number;
  lineProtein: number;
  lineFat: number;
  lineCarbs: number;
};

type DayReport = {
  id: string;
  dayNumber: number;
  totalCalories: number;
  filledAt: string;
  updatedAt: string;
  waterLiters: number | null;
  steps: number | null;
  sleepHours: number | null;
  activityMinutes: number | null;
  trainingDone: boolean | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  legCm: number | null;
  lines: ReportLineItem[];
};

type ParticipantDetailData = {
  streamId: string;
  participant: {
    id: string;
    name: string;
    email: string;
  };
  stream: {
    status: string;
    startDate: string;
    template: {
      title: string;
      durationDays: number;
    };
  };
  rating: {
    rank: number | null;
    weightLossPercent: number;
    entryWeight: number | null;
    currentWeight: number | null;
  } | null;
  reports: DayReport[];
};

type ReportTabValue = 'ration' | 'metrics' | 'charts';

const REPORT_TABS: Array<{ value: ReportTabValue; label: string }> = [
  { value: 'ration', label: 'Рацион' },
  { value: 'metrics', label: 'Метрики' },
  { value: 'charts', label: 'Графики' },
];

function formatTrainingDone(value: boolean | null): string {
  if (value === null || value === undefined) return '—';
  return value ? '✓ была' : '✗ не была';
}

/** Русская форма существительного при числительном. */
function pluralize(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function mealSummary(lines: ReportLineItem[]): string {
  const meals: MealType[] = [];
  for (const line of lines) {
    if (!meals.includes(line.mealType)) meals.push(line.mealType);
  }
  return meals.map((meal) => MEAL_LABELS[meal]).join(', ');
}

function buildMeasurementsData(
  reports: DayReport[]
): Array<{ day: number; weightKg: number | null; chestCm: number | null; waistCm: number | null; hipCm: number | null; legCm: number | null }> {
  return reports
    .filter((r) => r.weightKg !== null || r.chestCm !== null || r.waistCm !== null || r.hipCm !== null || r.legCm !== null)
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((r) => ({
      day: r.dayNumber,
      weightKg: r.weightKg,
      chestCm: r.chestCm,
      waistCm: r.waistCm,
      hipCm: r.hipCm,
      legCm: r.legCm,
    }));
}

function getMaxValue(
  data: Array<{ day: number; weightKg: number | null; chestCm: number | null; waistCm: number | null; hipCm: number | null; legCm: number | null }>
): number {
  let max = 0;
  for (const d of data) {
    const values = [d.weightKg, d.chestCm, d.waistCm, d.hipCm, d.legCm];
    for (const v of values) {
      if (v !== null && v > max) max = v;
    }
  }
  return max;
}

export default function ParticipantDetailPage() {
  const router = useRouter();
  const { id, participantId } = router.query;

  const [data, setData] = useState<ParticipantDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTabValue>('ration');
  const [expandedDays, setExpandedDays] = useState<number[]>([]);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
      return;
    }
    if (!id || !participantId) return;

    const sid = Array.isArray(id) ? id[0] : id;
    const pid = Array.isArray(participantId) ? participantId[0] : participantId;

    async function load() {
      try {
        const res = await apiFetch(`/api/streams/${sid}/participants/${pid}`, {
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            json.message || json.error || 'Не удалось загрузить данные участника'
          );
        }
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, participantId, router]);

  function toggleDay(day: number) {
    setExpandedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  if (loading) {
    return <main className={styles.main}><p>Загрузка...</p></main>;
  }

  if (error || !data) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>{error || 'Данные не найдены'}</p>
      </main>
    );
  }

  const sid = Array.isArray(id) ? id[0] : (id as string);
  const { durationDays } = data.stream.template;
  const allDays = Array.from({ length: durationDays }, (_, i) => i + 1);
  const reportByDay = new Map(data.reports.map((r) => [r.dayNumber, r]));

  const filledDays = data.reports.length;
  const filledCalories = data.reports.filter((r) => r.totalCalories > 0);
  const avgCalories =
    filledCalories.length > 0
      ? (
          filledCalories.reduce((sum, r) => sum + r.totalCalories, 0) /
          filledCalories.length
        ).toFixed(1)
      : '—';

  const lastUpdated = data.reports.reduce<string | null>((latest, r) => {
    if (!latest || r.updatedAt > latest) return r.updatedAt;
    return latest;
  }, null);

  const measurementsData = buildMeasurementsData(data.reports);

  return (
    <main className={styles.main}>
      <Link href={`/mentor/streams/${sid}`} className={styles.backLink}>
        ← Назад к потоку
      </Link>

      <h1 className={styles.title}>{data.participant.name}</h1>
      <p className={styles.email}>{data.participant.email}</p>
      <p className={styles.description}>
        {data.stream.template.title} · день {filledDays} из {durationDays}
      </p>

      <Link
        href={`/mentor/streams/${sid}?participantId=${data.participant.id}#chat`}
        className={styles.messageBtn}
      >
        Написать участнику
      </Link>

      <div className={styles.infoBlock}>
        {data.rating && data.rating.rank !== null && (
          <p>
            <strong>Рейтинг:</strong> место {data.rating.rank} ·{' '}
            {data.rating.weightLossPercent > 0
              ? `−${data.rating.weightLossPercent}%`
              : `${data.rating.weightLossPercent}%`}
            {data.rating.entryWeight !== null &&
              data.rating.currentWeight !== null &&
              ` (${data.rating.entryWeight} → ${data.rating.currentWeight} кг)`}
          </p>
        )}
        <p><strong>Заполнено дней:</strong> {filledDays} из {durationDays}</p>
        <p><strong>Средние калории:</strong> {avgCalories} ккал</p>
        <p>
          <strong>Последнее обновление:</strong>{' '}
          {lastUpdated
            ? new Date(lastUpdated).toLocaleString()
            : 'Отчётов пока нет'}
        </p>
        <p>
          <strong>Дата начала:</strong>{' '}
          {new Date(data.stream.startDate).toLocaleDateString()}
        </p>
        <p><strong>Статус:</strong> {data.stream.status}</p>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Разделы отчёта">
        {REPORT_TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`report-tab-${tab.value}`}
              aria-selected={isActive}
              aria-controls={`report-panel-${tab.value}`}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'ration' && (
        <section
          className={styles.tabPanel}
          role="tabpanel"
          id="report-panel-ration"
          aria-labelledby="report-tab-ration"
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>День</th>
                  <th>Состав</th>
                  <th className={styles.numCol}>Итого ккал</th>
                </tr>
              </thead>
              <tbody>
                {allDays.map((day) => {
                  const report = reportByDay.get(day);
                  const lines = report?.lines ?? [];
                  if (!report || lines.length === 0) {
                    return (
                      <tr key={day} className={styles.emptyRow}>
                        <td>{day}</td>
                        <td>—</td>
                        <td className={styles.numCol}>—</td>
                      </tr>
                    );
                  }

                  const isOpen = expandedDays.includes(day);
                  return (
                    <Fragment key={day}>
                      <tr
                        className={`${styles.rationRow} ${isOpen ? styles.rationRowOpen : ''}`}
                        onClick={() => toggleDay(day)}
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.rowToggle}
                            aria-expanded={isOpen}
                            aria-label={`День ${day}: ${isOpen ? 'свернуть' : 'развернуть'} состав`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleDay(day);
                            }}
                          >
                            <ChevronRight
                              size={16}
                              aria-hidden="true"
                              className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                            />
                            {day}
                          </button>
                        </td>
                        <td>
                          {lines.length}{' '}
                          {pluralize(lines.length, 'позиция', 'позиции', 'позиций')}
                          {' · '}
                          {mealSummary(lines)}
                        </td>
                        <td className={styles.numCol}>{report.totalCalories}</td>
                      </tr>
                      {isOpen && (
                        <tr className={styles.detailRow}>
                          <td colSpan={3}>
                            <ul className={styles.foodList}>
                              {lines.map((line) => (
                                <li key={line.id}>
                                  {MEAL_LABELS[line.mealType]}: {line.name} —{' '}
                                  {line.weightGrams} г ({line.lineCalories} ккал · Б{' '}
                                  {line.lineProtein} · Ж {line.lineFat} · У {line.lineCarbs})
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'metrics' && (
        <section
          className={styles.tabPanel}
          role="tabpanel"
          id="report-panel-metrics"
          aria-labelledby="report-tab-metrics"
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>День</th>
                  <th className={styles.numCol}>Вода (л)</th>
                  <th className={styles.numCol}>Шаги</th>
                  <th className={styles.numCol}>Сон (ч)</th>
                  <th>Тренировка</th>
                  <th className={styles.numCol}>Вес (кг)</th>
                  <th className={styles.numCol}>ОГ (см)</th>
                  <th className={styles.numCol}>ОТ (см)</th>
                  <th className={styles.numCol}>ОБ (см)</th>
                  <th className={styles.numCol}>ОН (см)</th>
                </tr>
              </thead>
              <tbody>
                {allDays.map((day) => {
                  const report = reportByDay.get(day);
                  const filled = report && (
                    report.waterLiters !== null ||
                    report.steps !== null ||
                    report.sleepHours !== null ||
                    report.trainingDone !== null ||
                    report.weightKg !== null ||
                    report.chestCm !== null ||
                    report.waistCm !== null ||
                    report.hipCm !== null ||
                    report.legCm !== null
                  );
                  return (
                    <tr key={day} className={filled ? '' : styles.emptyRow}>
                      <td>{day}</td>
                      <td className={styles.numCol}>{report?.waterLiters ?? '—'}</td>
                      <td className={styles.numCol}>{report?.steps ?? '—'}</td>
                      <td className={styles.numCol}>{report?.sleepHours ?? '—'}</td>
                      <td>{formatTrainingDone(report?.trainingDone ?? null)}</td>
                      <td className={styles.numCol}>{report?.weightKg ?? '—'}</td>
                      <td className={styles.numCol}>{report?.chestCm ?? '—'}</td>
                      <td className={styles.numCol}>{report?.waistCm ?? '—'}</td>
                      <td className={styles.numCol}>{report?.hipCm ?? '—'}</td>
                      <td className={styles.numCol}>{report?.legCm ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'charts' && (
        <section
          className={styles.tabPanel}
          role="tabpanel"
          id="report-panel-charts"
          aria-labelledby="report-tab-charts"
        >
          {measurementsData.length > 0 ? (
            <div className={styles.chartCard}>
              <h3>Динамика замеров</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={measurementsData}>
                  <XAxis dataKey="day" />
                  <YAxis hide domain={[0, getMaxValue(measurementsData) + 10]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="weightKg"
                    name="Вес, кг"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="chestCm"
                    name="ОГ, см"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="waistCm"
                    name="ОТ, см"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="hipCm"
                    name="ОБ, см"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="legCm"
                    name="ОН, см"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={styles.noData}>Нет данных о замерах.</p>
          )}
        </section>
      )}
    </main>
  );
}
