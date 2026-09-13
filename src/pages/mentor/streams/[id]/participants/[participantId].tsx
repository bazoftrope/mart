import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
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

type ReportLineItem = {
  id: string;
  productId: string;
  name: string;
  calories: number;
  weightGrams: number;
  lineCalories: number;
};

type PulseReadingItem = {
  id: string;
  measuredAt: string;
  pulse: number | null;
  systolic?: number | null;
  diastolic?: number | null;
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
  pulseReadings: PulseReadingItem[];
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

function formatTrainingDone(value: boolean | null): string {
  if (value === null || value === undefined) return '—';
  return value ? '✓ была' : '✗ не была';
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

      <section className={styles.section}>
        <h2>Рацион</h2>
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
                if (!report || report.lines.length === 0) {
                  return (
                    <tr key={day} className={styles.emptyRow}>
                      <td>{day}</td>
                      <td>—</td>
                      <td className={styles.numCol}>—</td>
                    </tr>
                  );
                }
                return (
                  <tr key={day}>
                    <td>{day}</td>
                    <td>
                      <ul className={styles.foodList}>
                        {report.lines.map((line) => (
                          <li key={line.id}>
                            {line.name} — {line.weightGrams} г ({line.lineCalories} ккал)
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className={styles.numCol}>{report.totalCalories}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Динамика замеров</h2>
        {buildMeasurementsData(data.reports).length > 0 ? (
          <div className={styles.chartCard}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={buildMeasurementsData(data.reports)}>
                <XAxis dataKey="day" />
                <YAxis hide domain={[0, getMaxValue(buildMeasurementsData(data.reports)) + 10]} />
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

      <section className={styles.section}>
        <h2>Метрики</h2>
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

      <section className={styles.section}>
        <h2>Пульс и давление</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>День</th>
                <th>Время</th>
                <th className={styles.numCol}>Пульс (уд/мин)</th>
                <th className={styles.numCol}>Давление (сист/диаст)</th>
              </tr>
            </thead>
            <tbody>
              {allDays.map((day) => {
                const report = reportByDay.get(day);
                const readings = report?.pulseReadings || [];
                if (readings.length === 0) {
                  return (
                    <tr key={day} className={styles.emptyRow}>
                      <td>{day}</td>
                      <td>—</td>
                      <td className={styles.numCol}>—</td>
                      <td className={styles.numCol}>—</td>
                    </tr>
                  );
                }
                return readings.map((reading, index) => (
                  <tr key={reading.id}>
                    {index === 0 ? (
                      <td rowSpan={readings.length}>{day}</td>
                    ) : null}
                    <td>{formatTime(reading.measuredAt)}</td>
                    <td className={styles.numCol}>{reading.pulse ?? '—'}</td>
                    <td className={styles.numCol}>
                      {reading.systolic && reading.diastolic
                        ? `${reading.systolic}/${reading.diastolic}`
                        : '—'}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
