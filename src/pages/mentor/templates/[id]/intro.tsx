import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import RichTextEditor from '@/components/editor/RichTextEditor';
import AttachmentsEditor from '@/components/mentor/AttachmentsEditor';
import type { AttachmentData } from '@/types/attachments';
import styles from './edit.module.css';
import { canEditMarathonTemplate } from '@/lib/templateStatus';

type Template = {
  id: string;
  title: string;
  description?: string;
  durationDays: number;
  status: 'draft' | 'pending_review' | 'approved';
  introText: string | null;
  introAttachments: AttachmentData[];
};

function toPayloadAttachment(attachment: AttachmentData) {
  return {
    kind: attachment.kind,
    url: attachment.url,
    fileName: attachment.fileName ?? null,
    mimeType: attachment.mimeType ?? null,
    sizeBytes: attachment.sizeBytes ?? null,
    position: attachment.position,
    pairId: attachment.pairId ?? null,
    description: attachment.description ?? null,
  };
}

export default function TemplateIntroPage() {
  const router = useRouter();
  const { id } = router.query;
  const templateId = typeof id === 'string' ? id : undefined;

  const [template, setTemplate] = useState<Template | null>(null);
  const [introText, setIntroText] = useState('');
  const [introAttachments, setIntroAttachments] = useState<AttachmentData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'mentor') {
      router.push('/login');
      return;
    }

    if (!templateId) return;

    async function load() {
      try {
        const res = await apiFetch(`/api/marathons/${templateId}`, {
          credentials: 'include',
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить шаблон');
        }

        const data: Template = json.data;
        setTemplate(data);
        setIntroText(data.introText || '');
        setIntroAttachments(data.introAttachments || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router, templateId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!templateId || !template) return;

    setError(null);
    setSaving(true);

    try {
      const res = await apiFetch(`/api/marathons/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          durationDays: template.durationDays,
          introText,
          introAttachments: introAttachments.map(toPayloadAttachment),
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось сохранить предстартовую страницу');
      }

      router.push(`/mentor/templates/${templateId}/days`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="containerMd">
        <p>Загрузка...</p>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="containerMd">
        <p className="error">{error || 'Шаблон не найден.'}</p>
        <Link href="/mentor/templates">
          <button className="btn btnOutline">Назад к шаблонам</button>
        </Link>
      </main>
    );
  }

  const isEditable = canEditMarathonTemplate(template.status);

  return (
    <main className="containerMd">
      <h1 className="pageTitle">Шаг 2 из 3. Предстартовая страница</h1>
      <p className="textMuted">
        Приветственный текст и материалы, которые участники увидят до старта потока.
        Этот шаг можно пропустить и заполнить позже.
      </p>

      {!isEditable && (
        <p className="error">Шаблон на проверке — изменить предстартовую страницу нельзя.</p>
      )}
      {template.status === 'approved' && (
        <p className="textMuted">
          Шаблон одобрен. Изменения сохранятся сразу и будут видны во всех потоках.
        </p>
      )}

      <form onSubmit={handleSave}>
        <div className="formGroup">
          <label htmlFor="introText">Приветственный текст (визуальный редактор)</label>
          <RichTextEditor
            value={introText}
            onChange={setIntroText}
            disabled={!isEditable}
            placeholder="Расскажите о марафоне, как готовиться, что будет в программе..."
          />
        </div>

        {templateId && (
          <div className={styles.attachmentsRow}>
            <AttachmentsEditor
              templateId={templateId}
              kinds={['audio', 'file', 'video']}
              attachments={introAttachments}
              onChange={setIntroAttachments}
              disabled={!isEditable}
            />
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className={styles.actions}>
          {isEditable && (
            <button type="submit" disabled={saving} className="btn btnPrimary">
              {saving
                ? 'Сохранение...'
                : template.status === 'draft'
                  ? 'Сохранить и перейти к дням'
                  : 'Сохранить изменения'}
            </button>
          )}
          <Link href={`/mentor/templates/${templateId}/days`}>
            <button type="button" className="btn btnOutline">
              {template.status === 'draft' ? 'Пропустить' : 'К дням'}
            </button>
          </Link>
          <Link href="/mentor/templates">
            <button type="button" className="btn btnOutline">Назад к шаблонам</button>
          </Link>
        </div>
      </form>
    </main>
  );
}
