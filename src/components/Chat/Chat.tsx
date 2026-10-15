import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import styles from './Chat.module.css';
import { apiFetch } from '@/lib/apiClient';
import EmojiPicker, { insertEmojiAtCursor } from './EmojiPicker';
import { PhotoPreviews, MessageImages } from './ChatAttachments';
import {
  useChatPhotos,
  CHAT_IMAGE_ACCEPT,
} from '@/hooks/useChatPhotos';
import type { ChatAttachment } from '@/types/chat';

export type ChatParticipant = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type ChatStreamInfo = {
  id: string;
  status: string;
  startDate: string;
  template: { id: string; title: string; durationDays: number } | null;
};

export type ConversationSummary = {
  id: string;
  type: 'mentor_pair' | 'group';
  streamId: string | null;
  stream: ChatStreamInfo | null;
  members: ChatParticipant[];
  otherMember: ChatParticipant | null;
  lastMessage: {
    id: string;
    text: string;
    attachments: ChatAttachment[];
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
};

type MessageData = {
  id: string;
  text: string;
  attachments: ChatAttachment[];
  senderId: string;
  sender: ChatParticipant | null;
  createdAt: string;
};

type ChatProps = {
  myUserId: string;
  /** If provided, auto-open (or create) this conversation after load. */
  autoOpen?: {
    conversationId?: string;
    streamId?: string;
    participantId?: string;
    group?: boolean;
  };
  /** Called with a freshly created conversation (from participantId auto-open). */
  onCreatedConversation?: (conversationId: string) => void;
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

export default function Chat({ myUserId, autoOpen, onCreatedConversation }: ChatProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [members, setMembers] = useState<ChatParticipant[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openingRef = useRef<Set<string>>(new Set());
  const processedAutoOpenKey = useRef<string | null>(null);
  const {
    photos,
    uploading,
    error: photoError,
    addFiles,
    remove: removePhoto,
    reset: resetPhotos,
    toAttachments,
  } = useChatPhotos();

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/api/messages', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось загрузить диалоги');
      }
      setConversations(json.data || []);
      setLoadingList(false);
      return json.data as ConversationSummary[];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      setLoadingList(false);
      return [];
    }
  }, []);

  const openConversation = useCallback(
    async (conversationId: string) => {
      setActiveId(conversationId);
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
    },
    []
  );

  const createConversation = useCallback(
    async (streamId: string, participantId?: string) => {
      setError(null);
      try {
        const res = await apiFetch('/api/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            participantId
              ? { type: 'mentor_pair', streamId, participantId }
              : { type: 'group', streamId }
          ),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось создать диалог');
        }
        const conversation = json.data;
        onCreatedConversation?.(conversation.id);
        await openConversation(conversation.id);
        await loadConversations();
        return conversation.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
        return null;
      }
    },
    [openConversation, loadConversations, onCreatedConversation]
  );

  const handleAutoOpen = useCallback(
    async (conversations: ConversationSummary[], autoOpen: ChatProps['autoOpen']) => {
      if (!autoOpen) return;
      const key = JSON.stringify(autoOpen);
      if (processedAutoOpenKey.current === key) return;
      processedAutoOpenKey.current = key;
      if (autoOpen.conversationId) {
        const existing = conversations.find((c) => c.id === autoOpen.conversationId);
        if (existing) {
          await openConversation(existing.id);
        }
        return;
      }
      if (autoOpen.streamId) {
        const existing = conversations.find(
          (c) =>
            c.streamId === autoOpen.streamId &&
            (autoOpen.group ? c.type === 'group' : c.type === 'mentor_pair')
        );
        if (existing) {
          await openConversation(existing.id);
          return;
        }
        if (!autoOpen.group && autoOpen.participantId) {
          const key = `${autoOpen.streamId}:${autoOpen.participantId}`;
          if (openingRef.current.has(key)) return;
          openingRef.current.add(key);
          const pairExisting = conversations.find(
            (c) =>
              c.type === 'mentor_pair' &&
              c.streamId === autoOpen.streamId &&
              c.otherMember?.id === autoOpen.participantId
          );
          if (pairExisting) {
            await openConversation(pairExisting.id);
          } else {
            await createConversation(autoOpen.streamId, autoOpen.participantId);
          }
        } else if (autoOpen.group) {
          const key = `group:${autoOpen.streamId}`;
          if (openingRef.current.has(key)) return;
          openingRef.current.add(key);
          await createConversation(autoOpen.streamId);
        }
      }
    },
    [openConversation, createConversation]
  );

  const autoOpenKey = JSON.stringify(autoOpen ?? null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadConversations();
      if (cancelled) return;
      await handleAutoOpen(list, autoOpen);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations, handleAutoOpen, autoOpenKey]);

  useEffect(() => {
    if (!activeId) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/messages/${activeId}`, { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setMessages(json.data?.messages || []);
          setMembers(json.data?.members || []);
        }
      } catch {
        // ignore transient polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    resetPhotos();
  }, [activeId, resetPhotos]);

  async function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && photos.length === 0) || !activeId) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/messages/${activeId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, attachments: toAttachments() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Не удалось отправить сообщение');
      }
      const message = json.data as MessageData;
      setMessages((prev) => [...prev, message]);
      setText('');
      resetPhotos();
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setSending(false);
    }
  }

  const active = conversations.find((c) => c.id === activeId) || null;
  const title = active
    ? active.type === 'group'
      ? active.stream?.template?.title || 'Групповой чат потока'
      : active.otherMember?.name || 'Чат'
    : '';

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Диалоги</h2>
        {loadingList && <p className={styles.muted}>Загрузка...</p>}
        {!loadingList && conversations.length === 0 && (
          <p className={styles.muted}>Пока нет диалогов</p>
        )}
        <ul className={styles.list}>
          {conversations.map((conversation) => {
            const isGroup = conversation.type === 'group';
            const name = isGroup
              ? conversation.stream?.template?.title || 'Групповой чат'
              : conversation.otherMember?.name || 'Чат';
            const subtitle = conversation.stream?.template?.title;
            return (
              <li key={conversation.id}>
                <button
                  className={
                    activeId === conversation.id
                      ? `${styles.convButton} ${styles.convButtonActive}`
                      : styles.convButton
                  }
                  onClick={() => openConversation(conversation.id)}
                >
                  <div className={styles.convRow}>
                    <span className={styles.convName}>{name}</span>
                    {conversation.unreadCount > 0 && (
                      <span className={styles.badge}>{conversation.unreadCount}</span>
                    )}
                  </div>
                  {subtitle && (
                    <span className={styles.convSubtitle}>{subtitle}</span>
                  )}
                  {conversation.lastMessage && (
                    <span className={styles.convLast}>
                      {conversation.lastMessage.text ||
                        (conversation.lastMessage.attachments?.length
                          ? 'Фото'
                          : '')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={styles.chat}>
        {!activeId && (
          <div className={styles.empty}>
            <p>Выберите диалог слева, чтобы начать переписку.</p>
          </div>
        )}

        {activeId && (
          <>
            <header className={styles.chatHeader}>
              <div>
                <h3 className={styles.chatTitle}>{title}</h3>
                {active?.type === 'group' && (
                  <p className={styles.muted}>
                    Участники: {members.map((m) => m.name).join(', ')}
                  </p>
                )}
              </div>
            </header>

            <div className={styles.messages}>
              {loadingMessages && <p className={styles.muted}>Загрузка...</p>}
              {!loadingMessages && messages.length === 0 && (
                <p className={styles.muted}>Напишите первое сообщение</p>
              )}
              {messages.map((message) => {
                const mine = message.senderId === myUserId;
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
                    <MessageImages attachments={message.attachments || []} />
                    {message.text && (
                      <div className={styles.bubbleText}>{message.text}</div>
                    )}
                    <div className={styles.bubbleTime}>
                      {formatTime(message.createdAt)}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {error && <p className={styles.error}>{error}</p>}
            {photoError && <p className={styles.error}>{photoError}</p>}

            <form
              className={styles.composer}
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <PhotoPreviews
                photos={photos}
                onRemove={removePhoto}
                disabled={sending || uploading}
              />
              <div className={styles.composerRow}>
                <input
                  ref={inputRef}
                  className={styles.input}
                  type="text"
                  value={text}
                  placeholder="Написать сообщение..."
                  onChange={(e) => setText(e.target.value)}
                  disabled={sending}
                />
                <EmojiPicker
                  onSelect={(emoji) =>
                    insertEmojiAtCursor(inputRef.current, text, emoji, setText)
                  }
                  disabled={sending}
                />
                <button
                  className={styles.attachBtn}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading}
                  title="Прикрепить фото"
                  aria-label="Прикрепить фото"
                >
                  <ImagePlus size={18} />
                </button>
                <button
                  className={styles.sendBtn}
                  type="submit"
                  disabled={
                    sending ||
                    uploading ||
                    (!text.trim() && photos.length === 0)
                  }
                >
                  Отправить
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={CHAT_IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    void addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {uploading && <span className={styles.muted}>Загрузка фото...</span>}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
