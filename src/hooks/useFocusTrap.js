import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

function getFocusableChildren(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.closest("[inert]") && !el.hidden
  );
}

/**
 * useFocusTrap — traps keyboard focus inside a container.
 *
 * @param {boolean} active - enable/disable the trap
 * @returns {React.RefObject} ref to attach to the modal container
 *
 * Behavior:
 *   - On mount: focuses the first focusable element
 *   - Tab/Shift+Tab cycle inside the container
 *   - Escape is NOT handled (let the modal handle it via onClose)
 *   - On unmount: restores focus to the element that opened the modal
 */
export function useFocusTrap(active = true) {
  const ref = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    // Store currently focused element before trapping
    previousActiveElement.current = document.activeElement;

    const focusable = getFocusableChildren(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;

      const focusable = getFocusableChildren(container);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Restore focus on unmount
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [active]);

  return ref;
}

export default useFocusTrap;
