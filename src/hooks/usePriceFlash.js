import { useRef, useEffect, useCallback } from "react";

/**
 * usePriceFlash — triggers CSS price-tick animations on value change.
 *
 * Usage:
 *   const ref = usePriceFlash(currentPrice, previousPrice);
 *   <span ref={ref} className="data-price">1,234.50</span>
 *
 * Or for multi-element updates:
 *   usePriceFlash(currentPrice, previousPrice, elementRef);
 */
export function usePriceFlash(currentPrice, previousPrice, elementRef) {
  const internalRef = useRef(null);
  const resolvedRef = elementRef || internalRef;
  const lastAnnouncedRef = useRef(null);

  useEffect(() => {
    if (currentPrice == null || previousPrice == null) return;
    if (currentPrice === previousPrice) return;

    const el = resolvedRef.current;
    if (!el) return;

    const direction = currentPrice > previousPrice ? "up" : "down";

    // Remove old state
    el.classList.remove("data-price--up", "data-price--down");

    // Force reflow so re-adding the same class re-triggers animation
    void el.offsetWidth;

    // Apply new direction
    el.classList.add(`data-price--${direction}`);

    // Announce to screen readers via live region
    const delta = currentPrice > previousPrice
      ? (currentPrice - previousPrice).toFixed(2)
      : (previousPrice - currentPrice).toFixed(2);
    const announcement = `${direction === "up" ? "up" : "down"} ${delta}`;

    // Avoid duplicate announcements for same tick
    if (lastAnnouncedRef.current !== announcement) {
      lastAnnouncedRef.current = announcement;
      const liveRegion = document.getElementById("live-announcer");
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }

    // Strip animation class after it completes (var(--duration-suspend) ~= 600ms)
    const duration = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--duration-suspend")
        .trim() || "600",
      10
    );
    const timer = setTimeout(() => {
      el.classList.remove("data-price--up", "data-price--down");
    }, duration + 50);

    return () => clearTimeout(timer);
  }, [currentPrice, previousPrice, resolvedRef]);

  return internalRef;
}

/**
 * useLivePrice — manages a rolling price history and triggers flash on tick.
 * Returns ref to attach to price display element.
 *
 * @param {number|null} price — latest price
 * @param {string} [elementQuery] — CSS selector if attaching to non-ref element
 */
export function useLivePrice(price, elementQuery = "[data-live-price]") {
  const historyRef = useRef({ current: null, previous: null });
  const elRef = useRef(null);

  useEffect(() => {
    if (price == null) return;

    historyRef.current.previous = historyRef.current.current;
    historyRef.current.current = price;

    if (historyRef.current.previous == null) return;

    const direction = price > historyRef.current.previous ? "up" : "down";
    const el = elRef.current || document.querySelector(elementQuery);
    if (!el) return;

    el.classList.remove("data-price--up", "data-price--down");
    void el.offsetWidth;
    el.classList.add(`data-price--${direction}`);

    const delta = (price - historyRef.current.previous).toFixed(2);
    const sign = direction === "up" ? "+" : "-";
    const liveRegion = document.getElementById("live-announcer");
    if (liveRegion) {
      liveRegion.textContent = `${sign}${delta}`;
    }

    const duration = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--duration-suspend")
        .trim() || "600",
      10
    );
    const timer = setTimeout(() => {
      el.classList.remove("data-price--up", "data-price--down");
    }, duration + 50);

    return () => clearTimeout(timer);
  }, [price, elementQuery]);

  return elRef;
}

export default usePriceFlash;
