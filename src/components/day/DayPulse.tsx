import { useMemo } from 'react';
import { useParticipantDayStore, hasPulseData } from '@/stores/participantDayStore';
import Button from '@/components/ui/Button';
import PulseReadingsForm from './PulseReadingsForm';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import styles from './DayPulse.module.css';

type DayPulseProps = {
  streamId: string;
  dayNumber: number;
  isEditable: boolean;
  onSaved?: () => void;
};

function formatTime(measuredAt: string | Date): string {
  const d = typeof measuredAt === 'string' ? new Date(measuredAt) : measuredAt;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function DayPulse({ streamId, dayNumber, isEditable, onSaved }: DayPulseProps) {
  const {
    data,
    daysCache,
    pulseReadings,
    savingPulse,
    pulseSaveError,
    addPulseReading,
    updatePulseReading,
    removePulseReading,
    savePulse,
  } = useParticipantDayStore();

  const canSave = hasPulseData(pulseReadings);

  const handleSave = async () => {
    await savePulse(streamId, dayNumber);
    const { pulseSaveError: err } = useParticipantDayStore.getState();
    if (!err) onSaved?.();
  };

  const history = useMemo(() => {
    const byDay = daysCache[streamId];
    if (!byDay) return [];
    const duration = data?.stream
      ? Math.max(...Object.keys(byDay).map((k) => Number(k)), 0)
      : Object.keys(byDay).length;
    // derive duration from template days count if available, fallback to keys length
    const maxDay = Math.max(duration, dayNumber, 0);
    const result: Array<{
      dayNumber: number;
      pulseReadings: NonNullable<NonNullable<(typeof byDay)[number]['report']>['pulseReadings']>;
    }> = [];
    for (let d = 1; d <= maxDay; d++) {
      const day = byDay[d];
      result.push({
        dayNumber: d,
        pulseReadings: (day?.report?.pulseReadings ?? []) as NonNullable<
          NonNullable<(typeof byDay)[number]['report']>['pulseReadings']
        >,
      });
    }
    // if no byDay for some days but data exists, at least ensure up to maxDay
    return result;
  }, [daysCache, streamId, data, dayNumber]);

  const chartData = useMemo(() => {
    return history.map((h) => {
      if (h.pulseReadings.length === 0) {
        return { day: h.dayNumber, pulse: null, systolic: null, diastolic: null };
      }
      const pulses = h.pulseReadings.map((r) => r.pulse).filter((v) => typeof v === 'number');
      const systolics = h.pulseReadings.map((r) => r.systolic).filter((v): v is number => typeof v === 'number' && v !== null);
      const diastolics = h.pulseReadings.map((r) => r.diastolic).filter((v): v is number => typeof v === 'number' && v !== null);
      const avg = pulses.length ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : null;
      const avgSys = systolics.length ? Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length) : null;
      const avgDia = diastolics.length ? Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length) : null;
      return { day: h.dayNumber, pulse: avg, systolic: avgSys, diastolic: avgDia };
    });
  }, [history]);

  const hasChartData = useMemo(
    () => chartData.some((d) => d.pulse !== null || d.systolic !== null || d.diastolic !== null),
    [chartData]
  );

  const stats = useMemo(() => {
    const all = history.flatMap((h) => h.pulseReadings);
    if (all.length === 0) return null;
    const pulses = all.map((r) => r.pulse).filter((v): v is number => typeof v === 'number' && v !== null);
    const systolics = all.map((r) => r.systolic).filter((v): v is number => typeof v === 'number' && v !== null);
    const diastolics = all.map((r) => r.diastolic).filter((v): v is number => typeof v === 'number' && v !== null);
    return {
      count: all.length,
      avgPulse: pulses.length ? Math.round(pulses.reduce((a, b) => a + b, 0) / pulses.length) : null,
      minPulse: pulses.length ? Math.min(...pulses) : null,
      maxPulse: pulses.length ? Math.max(...pulses) : null,
      avgSystolic: systolics.length ? Math.round(systolics.reduce((a, b) => a + b, 0) / systolics.length) : null,
      avgDiastolic: diastolics.length ? Math.round(diastolics.reduce((a, b) => a + b, 0) / diastolics.length) : null,
      daysWithData: history.filter((h) => h.pulseReadings.length > 0).length,
    };
  }, [history]);

  const currentDayReadings = data?.report?.pulseReadings ?? [];
  const hasAnyHistory = history.some((h) => h.pulseReadings.length > 0);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Самочувствие</h2>
        <p className={styles.subtitle}>
          Замеры пульса и давления — необязательная функция для личных наблюдений. Не влияет на рейтинг и
          отчёт по питанию. Заполняйте в удобные дни, хоть каждый день.
        </p>
        <details className={styles.helpDetails}>
          <summary className={styles.helpSummary}>Как пользоваться — справка</summary>
          <div className={styles.helpContent}>
            <ol className={styles.helpList}>
              <li>
                <b>Где:</b> откройте день марафона → вкладка <b>«Самочувствие»</b> (рядом с «Отчёт» и «Прогресс»).
              </li>
              <li>
                <b>Заполните строку:</b> <code>время</code> (напр. 08:30) + <code>пульс</code> (30–250) <b>или</b>{' '}
                <code>давление</code> — оба поля <code>сист.</code> / <code>диаст.</code> (напр. 120 / 80). Можно
                вместе: <code>07:15 — 68 — 120/78</code>.
              </li>
              <li>
                <b>Несколько замеров в день:</b> нажмите <code>+ добавить замер</code> (до 20). Удалить — кнопкой{' '}
                <code>Удалить</code>.
              </li>
              <li>
                <b>Сохраните:</b> кнопка <code>Сохранить замеры</code> активна, когда есть время + пульс или
                давление. Без сохранения данные не запомнятся.
              </li>
              <li>
                <b>Где посмотреть:</b> ниже — карточки <code>средний пульс / давление</code>, график по дням
                (среднее за день) и таблица истории. Будущие дни и закрытые — только просмотр.
              </li>
            </ol>
            <p className={styles.helpNote}>
              Ограничения: пульс 30–250, сист. 60–250, диаст. 40–160, сист. &gt; диаст. Давление — обязательно парой.
              Данные видите только вы и ваш ментор (в его таблице).
            </p>
          </div>
        </details>
      </div>

      <div className={styles.formCard}>
        <PulseReadingsForm
          readings={pulseReadings}
          onUpdateReading={updatePulseReading}
          onAddReading={addPulseReading}
          onRemoveReading={removePulseReading}
          readOnly={!isEditable}
        />

        {isEditable && (
          <div className={styles.saveRow}>
            <Button
              variant="primary"
              size="lg"
              loading={savingPulse}
              disabled={!canSave}
              onClick={handleSave}
            >
              {savingPulse ? 'Сохранение…' : 'Сохранить замеры'}
            </Button>
            {!canSave && <span className={styles.hint}>Добавьте время и пульс или давление (сист./диаст.), чтобы сохранить</span>}
          </div>
        )}

        {pulseSaveError && <p className={styles.error}>{pulseSaveError}</p>}
        {!isEditable && currentDayReadings.length > 0 && (
          <p className={styles.readOnlyNote}>День закрыт для редактирования — показаны сохранённые замеры.</p>
        )}
        {data?.report && (
          <p className={styles.lastUpdated}>
            Последнее обновление отчёта: {new Date(data.report.updatedAt).toLocaleString('ru-RU')}
          </p>
        )}
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Замеров всего</span>
            <span className={styles.statValue}>{stats.count}</span>
            <span className={styles.statSub}>за {stats.daysWithData} дн.</span>
          </div>
          {stats.avgPulse !== null && (
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Средний пульс</span>
              <span className={styles.statValue}>{stats.avgPulse} <span className={styles.unit}>уд/мин</span></span>
              <span className={styles.statSub}>
                {stats.minPulse} – {stats.maxPulse}
              </span>
            </div>
          )}
          {stats.avgSystolic !== null && stats.avgDiastolic !== null && (
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Среднее давление</span>
              <span className={styles.statValue}>
                {stats.avgSystolic}/{stats.avgDiastolic} <span className={styles.unit}>мм рт.ст.</span>
              </span>
              <span className={styles.statSub}>по всем замерам</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Динамика по марафону</h3>
        {!hasAnyHistory ? (
          <p className={styles.empty}>Пока нет сохранённых замеров. Добавьте первый — график появится автоматически.</p>
        ) : !hasChartData ? (
          <p className={styles.empty}>Недостаточно данных для графика.</p>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  label={{ value: 'День', position: 'insideBottom', offset: -4, fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis tick={{ fontSize: 12 }} width={48} />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => {
                    if (value == null) return ['—', name as string];
                    if (name === 'pulse') return [`${value} уд/мин`, 'Пульс'];
                    if (name === 'systolic') return [`${value}`, 'Сист.'];
                    if (name === 'diastolic') return [`${value}`, 'Диаст.'];
                    return [String(value), String(name)];
                  }}
                  labelFormatter={(label: unknown) => `День ${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="pulse"
                  name="Пульс"
                  stroke="var(--chart-pulse)"
                  strokeWidth={2.2}
                  dot={{ r: 3, fill: 'var(--chart-pulse)' }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  name="Сист."
                  stroke="var(--chart-systolic)"
                  strokeWidth={1.8}
                  dot={{ r: 2.5, fill: 'var(--chart-systolic)' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name="Диаст."
                  stroke="var(--chart-diastolic)"
                  strokeWidth={1.8}
                  dot={{ r: 2.5, fill: 'var(--chart-diastolic)' }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className={styles.chartHint}>Если в дне несколько замеров — на графике их среднее. Наведите, чтобы увидеть точные значения.</p>
      </div>

      <div className={styles.historyCard}>
        <h3 className={styles.historyTitle}>История замеров</h3>
        {!hasAnyHistory ? (
          <p className={styles.emptySmall}>История пуста.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>День</th>
                  <th>Время</th>
                  <th>Пульс</th>
                  <th>Давление</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .filter((h) => h.pulseReadings.length > 0)
                  .flatMap((h) =>
                    h.pulseReadings.map((r, idx) => (
                      <tr key={`${h.dayNumber}-${r.id ?? idx}`}>
                        {idx === 0 && (
                          <td rowSpan={h.pulseReadings.length} className={styles.dayCell}>
                            {h.dayNumber}
                          </td>
                        )}
                        <td>{formatTime(r.measuredAt)}</td>
                        <td>
                          {r.pulse ?? '—'} {r.pulse !== null && <span className={styles.unitSmall}>уд/мин</span>}
                        </td>
                        <td>{r.systolic && r.diastolic ? `${r.systolic}/${r.diastolic}` : '—'}</td>
                      </tr>
                    ))
                  )}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.historyHint}>Данные доступны только вам. Ментор видит их в своей таблице участников.</p>
      </div>
    </section>
  );
}
