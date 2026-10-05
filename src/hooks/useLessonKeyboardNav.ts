import { useEffect, useRef } from 'react';

interface Options {
  onPrevious?: () => void;
  onNext?: () => void;
  enabled?: boolean;
}

// Dove le frecce servono per scrivere o muoversi: editor di codice, campi, quiz
const TYPING_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="radiogroup"], [role="slider"], [role="tablist"], [role="menu"], [role="listbox"]';

/**
 * Frecce ← / → per passare al task (o alla lezione) precedente / successivo.
 * Disattivate quando il focus è in un campo o nell'editor di codice e quando è
 * aperto un dialog o un pannello.
 */
export function useLessonKeyboardNav({ onPrevious, onNext, enabled = true }: Options) {
  // Ref per non dover ri-registrare il listener a ogni render
  const handlers = useRef({ onPrevious, onNext });
  handlers.current = { onPrevious, onNext };

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest(TYPING_SELECTOR)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      const handler = e.key === 'ArrowLeft' ? handlers.current.onPrevious : handlers.current.onNext;
      if (!handler) return;
      e.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
