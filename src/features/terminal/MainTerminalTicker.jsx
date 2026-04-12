import React, { useEffect } from "react";

/**
 * MainTerminalTicker — manages market refresh ticks and quote rotation intervals.
 * Renders nothing; only drives side-effects that trigger re-renders of the parent.
 *
 * Props:
 *   setMarketRefresh — (fn) => void  — increments to force re-render each second
 *   setQuoteIndex    — (fn) => void  — rotates through ROTATING_QUOTES every 15s
 */
export default function MainTerminalTicker({ setMarketRefresh, setQuoteIndex }) {
  useEffect(() => {
    const interval = setInterval(() => setMarketRefresh((r) => r + 1), 1000);
    return () => clearInterval(interval);
  }, [setMarketRefresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((current) => (current + 1) % 8); // ROTATING_QUOTES.length = 8
    }, 15000);
    return () => clearInterval(interval);
  }, [setQuoteIndex]);

  return null;
}
