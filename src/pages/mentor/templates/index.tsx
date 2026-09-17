import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui';
import { apiFetch } from '@/lib/apiClient';

type Template = {
  id: string;
  title: string;
  description?: string;
  durationDays: number;
  status: 'draft' | 'pending_review' | 'approved';
  createdAt: string;
  updatedAt: string;
};

function statusLabel(status: Template['status']): string {
  switch (status) {
    case 'draft':
      return 'Черновик';
    case 'pending_review':
      return 'На проверке';
    case 'approved':
      return 'Одобрен';
    default:
      return status;
  }
}

export default function MentorTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
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

    async function load() {
      try {
        const res = await apiFetch('/api/marathons', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить шаблоны');
        }

        setTemplates(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function handleDelete(id: string) {
    if (!confirm('Вы уверены, что хотите удалить этот черновик шаблона?')) {
      return;
    }

    try {
      const res = await apiFetch(`/api/marathons/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось удалить шаблон');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    }
  }

  async function handleSubmit(id: string) {
    try {
      const res = await apiFetch(`/api/marathons/${id}/submit`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось отправить шаблон');
      }

      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'pending_review' } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    }
  }

  return (
    <main className="container2xl">
      <div className="flexBetween">
        <h1 className="pageTitle">Мои шаблоны марафонов</h1>
        <ButtonLink href="/mentor/templates/new" variant="primary">
          Создать шаблон
        </ButtonLink>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p>Загрузка...</p>}

      {!loading && templates.length === 0 && <p>Шаблонов пока нет.</p>}

      {!loading && templates.length > 0 && (
        <ul className="listPlain mt-1">
          {templates.map((template) => (
            <li key={template.id} className="card">
              <div className="cardHeader">
                <div className="cardBody">
                  <h2 className="cardTitle">{template.title}</h2>
                  <p className="description">
                    {template.description || 'Нет описания'}
                  </p>
                  <p className="meta">
                    <strong>Длительность:</strong> {template.durationDays} дн.
                  </p>
                  <p className="meta">
                    <strong>Статус:</strong> {statusLabel(template.status)}
                  </p>
                </div>
                <div className="cardActions">
                  <ButtonLink href={`/mentor/templates/${template.id}/edit`} variant="outline" size="sm">
                    Редакт.
                  </ButtonLink>
                  <ButtonLink href={`/mentor/templates/${template.id}/intro`} variant="outline" size="sm">
                    Предстарт.
                  </ButtonLink>
                  <ButtonLink href={`/mentor/templates/${template.id}/days`} variant="outline" size="sm">
                    Дни
                  </ButtonLink>
                  {template.status === 'draft' && (
                    <>
                      <Button onClick={() => handleSubmit(template.id)} variant="primary" size="sm">
                        Отправить
                      </Button>
                      <Button onClick={() => handleDelete(template.id)} variant="danger" size="sm">
                        Удалить
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
