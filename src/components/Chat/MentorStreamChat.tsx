import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './MentorStreamChat.module.css';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { ChatParticipant, ConversationSummary } from './Chat';

type MessageData = {
  id: string;
  text: string;
  senderId: string;
  sender: ChatParticipant | null;
  createdAt: string;
};

type EnrollmentPreview = {
  participant: { id: string; name: string; email: string } | null;
};

type MentorStreamChatProps = {
  streamId: string;
  enrollments: EnrollmentPreview[];
  streamStatus?: string;
  initialParticipantId?: string;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MentorStreamChat({
  streamId,
  enrollments,
  streamStatus,
  initialParticipantId,
}: MentorStreamChatProps) {
  const userId = useAuthStore((s) => s.userId);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [members, setMembers] = useState<ChatParticipant[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const initialOpenedRef = useRef(false);

  const streamConversations = useMemo(() => conversations.filter((c) => c.streamId === streamId), [conversations, streamId]);
  const groupConversation = useMemo(() => streamConversations.find((c) => c.type === 'group') ?? null, [streamConversations]);
  const isFinished = streamStatus === 'finished' || groupConversation?.stream?.status === 'finished' || streamConversations.some((c) => c.stream?.status === 'finished');

  // map participantId -> pair conversation
  const pairByParticipantId = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const c of streamConversations) {
      if (c.type === 'mentor_pair' && c.otherMember) {
        map.set(c.otherMember.id, c);
      }
    }
    return map;
  }, [streamConversations]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const activeIsGroup = activeConversation?.type === 'group';
  const title = activeConversation
    ? activeIsGroup
      ? activeConversation.stream?.template?.title || 'Общий чат потока'
      : activeConversation.otherMember?.name || 'Личный чат'
    : 'Чат потока';

  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/messages', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setConversations(json.data || []);
      }
    } catch {
      // ignore
    }
  }, [userId]);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/messages/${conversationId}`, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить переписку');
      }
      setMessages(json.data?.messages || []);
      setMembers(json.data?.members || []);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refreshActiveMessages = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await apiFetch(`/api/messages/${activeConversationId}`, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages(json.data?.messages || []);
        setMembers(json.data?.members || []);
        setConversations((prev) => prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c)));
      }
    } catch {
      // ignore
    }
  }, [activeConversationId]);

  const createGroupConversation = useCallback(async () => {
    if (!userId || isFinished) return;
    setCreating('group');
    setError(null);
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'group', streamId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось создать чат');
      }
      const conversationId = (json.data as { id?: string } | null)?.id;
      if (conversationId) {
        await refreshConversations();
        await openConversation(conversationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setCreating(null);
    }
  }, [userId, streamId, isFinished, refreshConversations, openConversation]);

  const createPairConversation = useCallback(
    async (participantId: string) => {
      if (!userId || isFinished) return;
      setCreating(participantId);
      setError(null);
      try {
        const res = await apiFetch('/api/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'mentor_pair', streamId, participantId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось создать чат');
        }
        const conversationId = (json.data as { id?: string } | null)?.id;
        if (conversationId) {
          await refreshConversations();
          await openConversation(conversationId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setCreating(null);
      }
    },
    [userId, streamId, isFinished, refreshConversations, openConversation]
  );

  const handleSelectGroup = useCallback(async () => {
    if (groupConversation) {
      await openConversation(groupConversation.id);
    } else {
      await createGroupConversation();
    }
  }, [groupConversation, openConversation, createGroupConversation]);

  const handleSelectParticipant = useCallback(
    async (participantId: string) => {
      const existing = pairByParticipantId.get(participantId);
      if (existing) {
        await openConversation(existing.id);
      } else {
        await createPairConversation(participantId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairByParticipantId, openConversation, createPairConversation]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/messages', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setConversations(json.data || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      void refreshConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, [userId, refreshConversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    const interval = setInterval(() => {
      void refreshActiveMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConversationId, refreshActiveMessages]);

  useEffect(() => {
    if (initialParticipantId && !initialOpenedRef.current && !loadingList && pairByParticipantId.size >= 0) {
      const hasParticipant = enrollments.some((e) => e.participant?.id === initialParticipantId);
      if (hasParticipant) {
        initialOpenedRef.current = true;
        void handleSelectParticipant(initialParticipantId);
      }
    }
  }, [initialParticipantId, loadingList, pairByParticipantId, enrollments, handleSelectParticipant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !activeConversationId || sending || isFinished) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/messages/${activeConversationId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось отправить сообщение');
      }
      const message = json.data as MessageData;
      setMessages((prev) => [...prev, message]);
      setText('');
      void refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setSending(false);
    }
  }

  if (!userId) return null;

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <h3 className={styles.sidebarTitle}>Чаты потока</h3>
        {loadingList && <p className={styles.muted}>Загрузка...</p>}
        <ul className={styles.list}>
          <li>
            <button
              type="button"
              className={
                activeConversationId === groupConversation?.id ? `${styles.convButton} ${styles.convButtonActive}` : styles.convButton
              }
              onClick={() => void handleSelectGroup()}
              disabled={isFinished && !groupConversation}
            >
              <div className={styles.convRow}>
                <span className={styles.convName}>Общий чат</span>
                {groupConversation && groupConversation.unreadCount > 0 && (
                  <span className={styles.badge}>{groupConversation.unreadCount}</span>
                )}
              </div>
              <span className={styles.convSubtitle}>
                {groupConversation?.stream?.template?.title || 'Все участники + ментор'}
              </span>
              {groupConversation?.lastMessage && <span className={styles.convLast}>{groupConversation.lastMessage.text}</span>}
            </button>
          </li>
          {enrollments
            .filter((e) => e.participant)
            .map((e) => {
              const p = e.participant!;
              const conv = pairByParticipantId.get(p.id);
              const isActive = activeConversationId === conv?.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={isActive ? `${styles.convButton} ${styles.convButtonActive}` : styles.convButton}
                    onClick={() => void handleSelectParticipant(p.id)}
                    disabled={isFinished && !conv}
                  >
                    <div className={styles.convRow}>
                      <span className={styles.convName}>{p.name}</span>
                      {conv && conv.unreadCount > 0 && <span className={styles.badge}>{conv.unreadCount}</span>}
                    </div>
                    <span className={styles.convSubtitle}>{p.email}</span>
                    {conv?.lastMessage ? (
                      <span className={styles.convLast}>{conv.lastMessage.text}</span>
                    ) : (
                      <span className={styles.convLastMuted}>Нет сообщений — нажмите чтобы начать</span>
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
        {isFinished && <p className={styles.finishedNote}>Чат потока закрыт</p>}
      </aside>

      <section className={styles.chat}>
        {!activeConversationId && (
          <div className={styles.empty}>
            <p>Выберите чат слева. Общий — для всех, личный — с участником.</p>
          </div>
        )}
        {activeConversationId && (
          <>
            <header className={styles.chatHeader}>
              <h4 className={styles.chatTitle}>{title}</h4>
              {activeIsGroup && members.length > 0 && (
                <p className={styles.muted}>Участники: {members.map((m) => m.name).join(', ')}</p>
              )}
            </header>
            <div className={styles.messages}>
              {loadingMessages && <p className={styles.muted}>Загрузка...</p>}
              {!loadingMessages && messages.length === 0 && (
                <p className={styles.muted}>{creating ? 'Создаём чат...' : isFinished ? 'Сообщений нет' : 'Напишите первое сообщение'}</p>
              )}
              {messages.map((message) => {
                const mine = message.senderId === userId;
                return (
                  <div key={message.id} className={mine ? `${styles.bubble} ${styles.bubbleMine}` : `${styles.bubble} ${styles.bubbleTheirs}`}>
                    {!mine && <div className={styles.bubbleSender}>{message.sender?.name || 'Неизвестно'}</div>}
                    <div className={styles.bubbleText}>{message.text}</div>
                    <div className={styles.bubbleTime}>{formatTime(message.createdAt)}</div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {isFinished ? (
              <div className={styles.composer}>
                <p className={styles.muted}>Чат потока закрыт</p>
              </div>
            ) : (
              <form
                className={styles.composer}
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <input
                  className={styles.input}
                  type="text"
                  value={text}
                  placeholder="Написать сообщение..."
                  onChange={(e) => setText(e.target.value)}
                  disabled={sending || !!creating}
                />
                <button className={styles.sendBtn} type="submit" disabled={sending || !!creating || !text.trim()}>
                  Отправить
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
