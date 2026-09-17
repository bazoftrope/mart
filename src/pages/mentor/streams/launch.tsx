import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import styles from './LaunchStream.module.css';
import { apiFetch } from '@/lib/apiClient';

type Template = {
  id: string;
  title: string;
  description?: string;
  durationDays: number;
  status: string;
};

export default function LaunchStreamPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
      return;
    }

    async function loadTemplates() {
      try {
        const res = await apiFetch('/api/marathons', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить шаблоны');
        }
        const approved = (json.data || []).filter((t: Template) => t.status === 'approved');
        setTemplates(approved);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId: selectedTemplateId, startDate }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось запустить поток');
      }

      router.push('/mentor/streams');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link href="/mentor/streams" className={styles.backLink}>← Назад к потокам</Link>
      <h1 className={styles.title}>Запустить новый поток</h1>

      {loading && <p>Загрузка шаблонов...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && templates.length === 0 && (
        <p className={styles.noTemplates}>
          У вас нет одобренных шаблонов. Создайте шаблон и отправьте его на проверку администратору.
        </p>
      )}

      {!loading && templates.length > 0 && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="template">Шаблон марафона</label>
            <select
              id="template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              required
              className={styles.fullWidth}
            >
              <option value="">Выберите шаблон</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title} ({template.durationDays} дн.)
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="startDate">Дата начала</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={styles.fullWidth}
            />
          </div>

          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? 'Запуск...' : 'Запустить поток'}
          </Button>
        </form>
      )}
    </main>
  );
}
