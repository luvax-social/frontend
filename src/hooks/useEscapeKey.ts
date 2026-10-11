import { useEffect } from 'react';

/**
 * Closes an overlay when Escape is pressed.
 *
 * The design has no Escape handling on any surface, so this is a deliberate
 * improvement rather than a conformance fix. It is one hook rather than a
 * listener per component so that every overlay behaves identically and a new one
 * cannot be added without the behaviour.
 *
 * @param {boolean} isOpen whether the overlay is currently showing
 * @param {Function} onClose called when Escape is pressed while open
 */
export const useEscapeKey = (isOpen: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
};
