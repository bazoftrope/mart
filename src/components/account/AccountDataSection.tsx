import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import { apiClient, apiFetch } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import { CONSENT_DOCUMENTS, CONSENT_TYPES, type ConsentType } from '@/lib/consent';
import type { ConsentsResponse, UserConsentDto } from '@/types/consent';
import type { DeletionImpact } from '@/types/account';
import styles from './AccountDataSection.module.css';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Раздел «Аккаунт и данные» (152-ФЗ): согласия, отзыв, экспорт данных и
 * удаление аккаунта. Доступен для любой роли; удаление — участнику и ментору
 * (у ментора каскад затрагивает потоки и данные участников, поэтому перед
 * подтверждением показываем числа).
 */
export default function AccountDataSection() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);

  const [consents, setConsents] = useState<UserConsentDto[]>([]);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await apiClient.get<ConsentsResponse>('/api/users/me/consents');
        if (!cancelled) setConsents(data.consents ?? []);

        try {
          const impactData = await apiClient.get<DeletionImpact>(
            '/api/users/me/deletion-impact'
          );
          if (!cancelled) setImpact(impactData);
        } catch {
          // Предупреждение о последствиях не критично для раздела согласий.
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить согласия');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadConsents() {
    const data = await apiClient.get<ConsentsResponse>('/api/users/me/consents');
    setConsents(data.consents ?? []);
  }

  async function handleRevoke(type: ConsentType) {
    setBusy(`revoke-${type}`);
    setError(null);
    setNotice(null);
    try {
      await apiClient.delete(`/api/users/me/consents/${type}`);
      await reloadConsents();
      setNotice('Согласие отозвано.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отозвать согласие');
    } finally {
      setBusy(null);
    }
  }

  async function handleExport() {
    setBusy('export');
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch('/api/users/me/export');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Не удалось выгрузить данные');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marathon-platform-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice('Файл с данными скачан.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выгрузить данные');
    } finally {
      setBusy(null);
    }
  }

  const canDelete = confirmation.trim().toLowerCase() === 'удалить' && password.length >= 6;

  async function handleDelete() {
    if (!canDelete) return;
    setBusy('delete');
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch('/api/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmation }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Не удалось удалить аккаунт');
      }

      useAuthStore.getState().clearAuth();
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить аккаунт');
      setBusy(null);
    }
  }

  return (
    <section className={styles.wrapper}>
      {error && <p className="error">{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <article className="card">
        <h2 className={styles.cardTitle}>Согласия на обработку данных</h2>
        <p className={styles.muted}>
          Согласие можно отозвать в любой момент. После отзыва обработка
          прекращается, а данные о здоровье уничтожаются в срок не более 30 дней.
        </p>

        {loading ? (
          <p className={styles.muted}>Загрузка...</p>
        ) : (
          <ul className={styles.list}>
            {CONSENT_TYPES.map((type) => {
              const document = CONSENT_DOCUMENTS[type];
              const record = consents.find((item) => item.type === type);
              const isActive = Boolean(record?.isActive);
              return (
                <li key={type} className={styles.item}>
                  <div>
                    <a href={document.url} className={styles.docLink}>
                      {document.title}
                    </a>
                    <p className={styles.meta}>
                      {record ? (
                        <>
                          Версия {record.documentVersion} · выдано{' '}
                          {formatDate(record.grantedAt)}
                          {record.revokedAt && ` · отозвано ${formatDate(record.revokedAt)}`}
                        </>
                      ) : (
                        'Согласие не выдавалось'
                      )}
                    </p>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={isActive ? styles.statusActive : styles.statusNone}>
                      {isActive ? 'действует' : 'не действует'}
                    </span>
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy === `revoke-${type}`}
                        onClick={() => handleRevoke(type)}
                      >
                        Отозвать
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className="card">
        <h2 className={styles.cardTitle}>Экспорт данных</h2>
        <p className={styles.muted}>
          Выгрузка всех ваших данных одним файлом JSON: профиль, согласия, отчёты,
          замеры, рейтинг, избранное и ваши сообщения. Пароль в файл не попадает.
        </p>
        <Button
          variant="secondary"
          loading={busy === 'export'}
          onClick={handleExport}
        >
          Скачать мои данные
        </Button>
      </article>

      <article className={`card ${styles.dangerCard}`}>
        <h2 className={styles.cardTitle}>Удаление аккаунта</h2>
        {role === 'admin' ? (
          <p className={styles.muted}>
            Служебный аккаунт администратора нельзя удалить: он восстанавливается
            из настроек при следующем входе. Для смены доступа обратитесь к
            владельцу платформы.
          </p>
        ) : (
          <>
            {impact && impact.role === 'mentor' && (impact.templates > 0 || impact.streams > 0) && (
              <p className={styles.impactWarning}>
                Вместе с аккаунтом будут удалены ваши шаблоны ({impact.templates}),
                потоки из них ({impact.streams}) и записи участников
                ({impact.enrollments}) — включая их отчёты, рацион, замеры, рейтинг
                и чаты. Это затрагивает данные {impact.participants} человек и
                необратимо.
              </p>
            )}
            <p className={styles.muted}>
              Действие необратимо: профиль, согласия, отчёты, замеры, рейтинг,
              избранное и ваши сообщения будут удалены. Введите пароль и слово
              «удалить» для подтверждения.
            </p>
            <div className={styles.deleteFields}>
              <label className={styles.field}>
                <span>Пароль</span>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className={styles.field}>
                <span>
                  Подтверждение: введите <strong>удалить</strong>
                </span>
                <input
                  type="text"
                  className="input"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            </div>
            <Button
              variant="danger"
              loading={busy === 'delete'}
              disabled={!canDelete}
              onClick={handleDelete}
            >
              Удалить аккаунт
            </Button>
          </>
        )}
      </article>
    </section>
  );
}
