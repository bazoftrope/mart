import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui';
import styles from './new.module.css';
import { apiFetch } from '@/lib/apiClient';

export default function NewTemplatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
    }
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/marathons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, description, durationDays }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось создать шаблон');
      }

      router.push(`/mentor/templates/${json.data.id}/intro`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="containerMd">
      <h1 className="pageTitle">Шаг 1 из 3. Основная информация</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="title">Название</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            className="input"
          />
        </div>
        <div className="formGroup">
          <label htmlFor="description">Описание</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input"
          />
        </div>
        <div className="formGroup">
          <label htmlFor="durationDays">Длительность (дней)</label>
          <input
            id="durationDays"
            type="number"
            min={1}
            max={365}
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            required
            className="input"
          />
        </div>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={loading}>
            {loading ? 'Создание...' : 'Далее — предстартовая страница'}
          </Button>
          <ButtonLink href="/mentor/templates" variant="outline">
            Отмена
          </ButtonLink>
        </div>
      </form>
    </main>
  );
}
