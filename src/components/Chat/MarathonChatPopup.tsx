import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import styles from './MarathonChatPopup.module.css';
import { apiFetch } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type { ChatParticipant, ConversationSummary } from './Chat';

type Tab = 'group' | 'mentor';

type MessageData = {
  id: string;
  text: string;
  senderId: string;
  sender: ChatParticipant | null;
  createdAt: string;
};

type MarathonChatPopupProps = {
  streamId: string;
  streamStatus?: string;
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

export default function MarathonChatPopup({ streamId, streamStatus }: MarathonChatPopupProps) {
  const userId = useAuthStore((s) => s.userId);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('group');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [members, setMembers] = useState<ChatParticipant[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState<Tab | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const streamConversations = conversations.filter((c) => c.streamId === streamId);
  const groupConversation = streamConversations.find((c) => c.type === 'group') ?? null;
  const mentorConversation =
    streamConversations.find((c) => c.type === 'mentor_pair') ?? null;
  const unreadTotal =
    (groupConversation?.unreadCount ?? 0) + (mentorConversation?.unreadCount ?? 0);

  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/messages', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setConversations(json.data || []);
      }
    } catch {
      // ignore transient polling errors
    }
  }, [userId]);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/messages/${conversationId}`, {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить переписку');
      }
      setMessages(json.data?.messages || []);
      setMembers(json.data?.members || []);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refreshActiveMessages = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await apiFetch(`/api/messages/${activeConversationId}`, {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages(json.data?.messages || []);
        setMembers(json.data?.members || []);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      }
    } catch {
      // ignore transient polling errors
    }
  }, [activeConversationId]);

  const createConversation = useCallback(
    async (tab: Tab) => {
      if (!userId) return;
      setCreating(tab);
      setError(null);
      try {
        const res = await apiFetch('/api/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            tab === 'group'
              ? { type: 'group', streamId }
              : { type: 'mentor_pair', streamId }
          ),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось создать диалог');
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
    [userId, streamId, refreshConversations, openConversation]
  );

  const activateTab = useCallback(
    async (tab: Tab) => {
      setActiveTab(tab);
      setError(null);
      const existing = conversations.find(
        (c) =>
          c.streamId === streamId &&
          c.type === (tab === 'group' ? 'group' : 'mentor_pair')
      );
      if (existing) {
        await openConversation(existing.id);
      } else {
        await createConversation(tab);
      }
    },
    [conversations, streamId, openConversation, createConversation]
  );

  const handleToggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    void activateTab(activeTab);
  }, [open, activeTab, activateTab]);

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
        // ignore initial load errors; the poll interval will retry
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
    if (!open || !activeConversationId) return;
    const interval = setInterval(() => {
      void refreshActiveMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [open, activeConversationId, refreshActiveMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || !activeConversationId || sending) return;
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

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;
  const isFinished =
    streamStatus === 'finished' ||
    activeConversation?.stream?.status === 'finished' ||
    streamConversations.some((c) => c.stream?.status === 'finished');
  const tabTitle =
    activeTab === 'group'
      ? activeConversation?.stream?.template?.title || 'Общий чат'
      : activeConversation?.otherMember?.name || 'Чат с ментором';

  return (
    <div className={styles.launcher}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={handleToggle}
        aria-label="Чат марафона"
        aria-expanded={open}
      >
        <MessageCircle size={22} />
        {unreadTotal > 0 && (
          <span className={styles.badge}>
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.popup}>
          <header className={styles.popupHeader}>
            <div className={styles.popupHeaderText}>
              <h2 className={styles.popupTitle}>{tabTitle}</h2>
              {activeTab === 'group' && members.length > 0 && (
                <p className={styles.popupSubtitle}>
                  Участники: {members.map((m) => m.name).join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Закрыть чат"
            >
              <X size={18} />
            </button>
          </header>

          <div className={styles.tabs}>
            <button
              type="button"
              className={
                activeTab === 'group'
                  ? `${styles.tab} ${styles.tabActive}`
                  : styles.tab
              }
              onClick={() => {
                void activateTab('group');
              }}
              disabled={isFinished && !groupConversation}
            >
              Общий
            </button>
            <button
              type="button"
              className={
                activeTab === 'mentor'
                  ? `${styles.tab} ${styles.tabActive}`
                  : styles.tab
              }
              onClick={() => {
                void activateTab('mentor');
              }}
              disabled={isFinished && !mentorConversation}
            >
              Ментор
            </button>
          </div>

          <div className={styles.messages}>
            {loadingList && loadingMessages && (
              <p className={styles.muted}>Загрузка...</p>
            )}
            {!loadingMessages && messages.length === 0 && (
              <p className={styles.muted}>
                {isFinished ? 'Чат потока закрыт' : creating ? 'Создаём чат...' : 'Напишите первое сообщение'}
              </p>
            )}
            {messages.map((message) => {
              const mine = message.senderId === userId;
              return (
                <div
                  key={message.id}
                  className={
                    mine
                      ? `${styles.bubble} ${styles.bubbleMine}`
                      : `${styles.bubble} ${styles.bubbleTheirs}`
                  }
                >
                  {!mine && (
                    <div className={styles.bubbleSender}>
                      {message.sender?.name || 'Неизвестно'}
                    </div>
                  )}
                  <div className={styles.bubbleText}>{message.text}</div>
                  <div className={styles.bubbleTime}>
                    {formatTime(message.createdAt)}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {isFinished && <p className={styles.muted}>Чат потока закрыт</p>}

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
              placeholder={isFinished ? 'Чат закрыт' : 'Написать сообщение...'}
              onChange={(e) => setText(e.target.value)}
              disabled={sending || creating === activeTab || isFinished}
            />
            <button
              className={styles.sendBtn}
              type="submit"
              disabled={sending || creating === activeTab || isFinished || !text.trim()}
            >
              Отправить
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
