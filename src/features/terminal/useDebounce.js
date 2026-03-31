import { useCallback, useRef } from "react";

/**
 * useDebounce — lightweight debounce for callbacks (e.g., form saves).
 * Unlike lodash, this has zero external dependencies.
 *
 * @param {function} fn   - Function to debounce
 * @param {number}  ms   - Delay in milliseconds (default 800)
 *
 * @returns {function} debounced function — stable identity via useCallback
 */
export function useDebounce(fn, ms = 800) {
  const timer = useRef(null);

  return useCallback(
    (...args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fn(...args);
      }, ms);
    },
    [fn, ms],
  );
}
