import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';
import styles from './UnsavedChangesDialog.module.css';

type UnsavedChangesDialogProps = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onStay: () => void;
  onLeave: () => void;
  onSaveAndLeave: () => void;
};

export default function UnsavedChangesDialog({
  open,
  saving,
  error,
  onStay,
  onLeave,
  onSaveAndLeave,
}: UnsavedChangesDialogProps) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    saveButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onStay();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, saving, onStay]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onStay();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
      >
        <h2 id="unsaved-changes-title" className={styles.title}>
          Есть несохранённые изменения
        </h2>
        <p id="unsaved-changes-description" className={styles.text}>
          Если уйти сейчас, введённые данные не сохранятся.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button
            ref={saveButtonRef}
            variant="primary"
            onClick={onSaveAndLeave}
            loading={saving}
            disabled={saving}
          >
            Сохранить и выйти
          </Button>
          <Button variant="outline" onClick={onLeave} disabled={saving}>
            Выйти без сохранения
          </Button>
          <Button variant="ghost" onClick={onStay} disabled={saving}>
            Остаться
          </Button>
        </div>
      </div>
    </div>
  );
}
