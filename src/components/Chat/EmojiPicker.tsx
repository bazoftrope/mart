import { useEffect, useRef, useState } from 'react';
import styles from './EmojiPicker.module.css';

type EmojiCategory = {
  key: string;
  label: string;
  emoji: string[];
};

/**
 * Курируемый набор эмодзи (без внешних зависимостей).
 * Полный Unicode-набор (~1800 символов) здесь не нужен: он раздувает бандл
 * и поповер. При необходимости список расширяется вручную.
 */
const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys',
    label: 'Смайлы',
    emoji: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
      '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒',
      '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
      '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥',
      '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐',
      '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲',
      '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢',
      '🤮', '🤧', '😷', '🤒', '🤕', '😈', '👻', '💀',
    ],
  },
  {
    key: 'gestures',
    label: 'Жесты',
    emoji: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️',
      '🖖', '👋', '🤝', '🙏', '💪', '🦾', '✊', '👊',
      '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤟', '🫶',
    ],
  },
  {
    key: 'hearts',
    label: 'Сердца',
    emoji: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '♥️', '💯', '🔥', '✨', '⭐',
    ],
  },
  {
    key: 'food',
    label: 'Еда',
    emoji: [
      '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
      '🥝', '🍅', '🥑', '🥦', '🥬', '🥒', '🌶️', '🥕',
      '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖',
      '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩',
      '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙',
      '🌮', '🌯', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛',
      '🍣', '🍱', '🥟', '🍤', '🍚', '🍧', '🍨', '🍦',
      '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫',
      '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼',
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🥂', '🍷',
    ],
  },
  {
    key: 'sport',
    label: 'Спорт',
    emoji: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🥍', '🏏',
      '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌',
      '🎿', '⛷️', '🏂', '🏋️', '🤸', '🤼', '🤺', '🤾',
      '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
      '🚴', '🚵', '🏃', '🚶', '💃', '🕺', '🏆', '🥇',
      '🥈', '🥉', '🏅', '🎯',
    ],
  },
  {
    key: 'nature',
    label: 'Природа',
    emoji: [
      '🌸', '🌼', '🌻', '🌺', '🌷', '🌱', '🌲', '🌳',
      '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂',
      '🍃', '🌞', '🌝', '🌚', '🌙', '⭐', '🌟', '✨',
      '⚡', '🔥', '💧', '🌈', '☀️', '⛅', '☁️', '🌧️',
      '⛈️', '❄️', '⛄', '🌊',
    ],
  },
  {
    key: 'other',
    label: 'Разное',
    emoji: [
      '✅', '❌', '⚠️', '❗', '❓', '💡', '📌', '📎',
      '✏️', '📝', '📅', '⏰', '⌛', '🚀', '💤', '💬',
      '👀', '🙈', '🙉', '🙊', '💐', '🎀', '🎉', '🎊',
      '🎈', '🎁', '🧡', '👏', '🤗', '😴', '🥗', '💪',
    ],
  },
];

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
};

export default function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].key);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const category =
    EMOJI_CATEGORIES.find((item) => item.key === activeCategory) ??
    EMOJI_CATEGORIES[0];

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label="Выбрать эмодзи"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span aria-hidden>🙂</span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Выбор эмодзи">
          <div className={styles.tabs} role="tablist">
            {EMOJI_CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={item.key === activeCategory}
                className={
                  item.key === activeCategory
                    ? `${styles.tab} ${styles.tabActive}`
                    : styles.tab
                }
                onClick={() => setActiveCategory(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.grid}>
            {category.emoji.map((emoji, index) => (
              <button
                key={`${category.key}-${index}`}
                type="button"
                className={styles.emojiBtn}
                onClick={() => onSelect(emoji)}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Вставляет эмодзи в позицию курсора поля ввода и возвращает фокус.
 * `input` может быть null (поле не отрендерено) — тогда эмодзи добавится в конец.
 */
export function insertEmojiAtCursor(
  input: HTMLInputElement | null,
  value: string,
  emoji: string,
  setValue: (next: string) => void
): void {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + emoji + value.slice(end);
  setValue(next);

  requestAnimationFrame(() => {
    if (!input) return;
    input.focus();
    const caret = start + emoji.length;
    input.setSelectionRange(caret, caret);
  });
}
