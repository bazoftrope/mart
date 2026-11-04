import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

type UnsavedChangesGuardOptions = {
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<string | null>;
  onDiscard: () => void;
};

type UnsavedChangesGuard = {
  dialogOpen: boolean;
  saving: boolean;
  saveError: string | null;
  requestNavigation: (action: () => void) => void;
  stay: () => void;
  leave: () => void;
  saveAndLeave: () => Promise<void>;
};

function isGuardableLink(anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;
  if (url.href === window.location.href) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function useUnsavedChangesGuard({
  dirty,
  saving,
  onSave,
  onDiscard,
}: UnsavedChangesGuardOptions): UnsavedChangesGuard {
  const router = useRouter();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingPending, setSavingPending] = useState(false);

  const dirtyRef = useRef(dirty);
  const skipPopRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const requestNavigation = useCallback((action: () => void) => {
    if (!dirtyRef.current) {
      action();
      return;
    }
    setSaveError(null);
    setPending(() => action);
  }, []);

  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const target = isGuardableLink(anchor);
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      setSaveError(null);
      setPending(() => () => {
        void router.push(target);
      });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [router]);

  useEffect(() => {
    router.beforePopState(() => {
      if (skipPopRef.current) {
        skipPopRef.current = false;
        return true;
      }
      if (!dirtyRef.current) return true;

      setSaveError(null);
      setPending(() => () => {
        skipPopRef.current = true;
        router.back();
      });
      return false;
    });

    return () => {
      router.beforePopState(() => true);
    };
  }, [router]);

  const stay = useCallback(() => {
    setPending(null);
    setSaveError(null);
  }, []);

  const leave = useCallback(() => {
    const action = pending;
    setPending(null);
    setSaveError(null);
    onDiscard();
    action?.();
  }, [pending, onDiscard]);

  const saveAndLeave = useCallback(async () => {
    if (!pending) return;

    setSavingPending(true);
    setSaveError(null);
    const error = await onSave();
    setSavingPending(false);

    if (error) {
      setSaveError(error);
      return;
    }

    const action = pending;
    setPending(null);
    action();
  }, [pending, onSave]);

  return {
    dialogOpen: pending !== null,
    saving: savingPending || saving,
    saveError,
    requestNavigation,
    stay,
    leave,
    saveAndLeave,
  };
}
