import React, { useEffect, useState } from "react";
import { getISTState } from "../../utils/tradingUtils.js";
import { ROTATING_QUOTES } from "./terminalWorkspaceState.js";

/**
 * MainTerminalProvider — pure effect provider for market refresh, IST state, and quote rotation.
 *
 * No props required.
 *
 * Calls onTick(ist, activeQuote, quoteIndex) every 15 seconds via setMarketRefresh.
 *
 * Also provides:
 *   quoteIndex, setQuoteIndex — state for rotating quotes
 *   activeQuote               — derived from ROTATING_QUOTES[quoteIndex]
 *   ist                        — current getISTState() value (updated on each tick)
 */
export default function MainTerminalProvider({ onTick }) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [, setMarketRefresh] = useState(0);

  const ist = getISTState();
  const activeQuote = ROTATING_QUOTES[quoteIndex] || ROTATING_QUOTES[0];

  // Rotate quotes every 45 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % ROTATING_QUOTES.length);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Market refresh tick every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketRefresh((n) => n + 1);
      onTick?.(getISTState(), activeQuote, quoteIndex);
    }, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTick]);

  return null;
}
