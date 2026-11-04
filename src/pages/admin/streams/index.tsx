import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import styles from './AdminStreams.module.css';

type StreamItem = {
  id: string;
  startDate: string;
  status: string;
  createdAt: string;
  template: {
    id: string;
    title: string;
    durationDays: number;
  } | null;
  mentor: {
    id: string;
    name: string;
    email: string;
  } | null;
  enrollmentsCount: number;
  reportsCount: number;
  ratingsCount: number;
  messagesCount: number;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Набор',
  running: 'Идёт',
  finished: 'Завершён',
};

export default function AdminStreamsPage() {
  const router = useRouter();
  const [items, setItems] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<StreamItem[]>('/api/admin/streams');
      setItems(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить потоки'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'admin') {
      router.push('/login');
      return;
    }
    load();
  }, [router, load]);

  async function handleDelete(stream: StreamItem) {
    const title = stream.template?.title || 'Поток без названия';
    const confirmed = window.confirm(
      `Удалить поток «${title}»?\n\n` +
        `Будут безвозвратно удалены: участники — ${stream.enrollmentsCount}, ` +
        `отчёты — ${stream.reportsCount}, оценки — ${stream.ratingsCount}, ` +
        `сообщения — ${stream.messagesCount}.\n\n` +
        'Действие необратимо.'
    );
    if (!confirmed) return;

    setActionError(null);
    setDeletingId(stream.id);
    try {
      await apiClient.delete(`/api/streams/${stream.id}`);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Не удалось удалить поток'
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container">
      <header className={styles.header}>
        <div>
          <h1 className="pageTitle">Потоки</h1>
          <p className={styles.lead}>
            Все потоки марафонов, включая завершённые. Удаление потока
            безвозвратно удаляет записи участников, отчёты, рейтинг и чаты.
          </p>
        </div>
      </header>

      {loading && <div className="mutedBox">Загружаем потоки...</div>}
      {!loading && error && <p className="error">{error}</p>}
      {actionError && <p className="error">{actionError}</p>}

      {!loading && !error && items.length === 0 && (
        <div className={styles.empty}>Потоков пока нет.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Шаблон</th>
                <th>Ментор</th>
                <th>Старт</th>
                <th>Статус</th>
                <th className={styles.numCol}>Участники</th>
                <th className={styles.numCol}>Отчёты</th>
                <th className={styles.numCol}>Оценки</th>
                <th className={styles.numCol}>Сообщения</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {items.map((stream) => (
                <tr key={stream.id}>
                  <td>
                    {stream.template?.title || 'Поток без названия'}
                    {stream.template && (
                      <span className={styles.duration}>
                        {stream.template.durationDays} дн.
                      </span>
                    )}
                  </td>
                  <td>{stream.mentor?.name || '—'}</td>
                  <td className={styles.nowrap}>
                    {new Date(stream.startDate).toLocaleDateString()}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        styles[`status_${stream.status}`] ?? ''
                      }`}
                    >
                      {STATUS_LABELS[stream.status] || stream.status}
                    </span>
                  </td>
                  <td className={styles.numCol}>{stream.enrollmentsCount}</td>
                  <td className={styles.numCol}>{stream.reportsCount}</td>
                  <td className={styles.numCol}>{stream.ratingsCount}</td>
                  <td className={styles.numCol}>{stream.messagesCount}</td>
                  <td>
                    <div className={styles.actionsCell}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(stream)}
                        disabled={deletingId === stream.id}
                        aria-label={`Удалить поток ${
                          stream.template?.title || stream.id
                        }`}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
