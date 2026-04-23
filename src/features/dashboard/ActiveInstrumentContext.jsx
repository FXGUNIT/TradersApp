import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "tradersapp.activeInstrument";

export const DASHBOARD_INSTRUMENTS = Object.freeze([
  {
    symbol: "NIFTY",
    label: "NIFTY 50",
    shortLabel: "NIFTY",
    market: "NSE Index",
    sessionType: "nse",
    timeframe: "5min",
    models: ["direction", "regime", "session", "magnitude"],
  },
  {
    symbol: "BANKNIFTY",
    label: "Bank Nifty",
    shortLabel: "BANKNIFTY",
    market: "NSE Index",
    sessionType: "nse",
    timeframe: "5min",
    models: ["direction", "regime", "session"],
  },
  {
    symbol: "NSEOPTIONS",
    label: "Nifty Options",
    shortLabel: "OPTIONS",
    market: "NSE Options",
    sessionType: "nse",
    timeframe: "5min",
    models: ["direction", "regime", "alpha"],
  },
]);

const DEFAULT_SYMBOL = DASHBOARD_INSTRUMENTS[0].symbol;
const ActiveInstrumentContext = createContext(null);

function readStoredSymbol() {
  if (typeof window === "undefined") {
    return DEFAULT_SYMBOL;
  }

  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_SYMBOL;
  } catch {
    return DEFAULT_SYMBOL;
  }
}

function findInstrument(symbol) {
  const normalized = String(symbol || "").trim().toUpperCase();
  return (
    DASHBOARD_INSTRUMENTS.find((instrument) => instrument.symbol === normalized) ||
    DASHBOARD_INSTRUMENTS[0]
  );
}

export function ActiveInstrumentProvider({ children, initialSymbol }) {
  const [activeSymbol, setActiveSymbol] = useState(() =>
    findInstrument(initialSymbol || readStoredSymbol()).symbol,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, activeSymbol);
    } catch {
      // Best-effort persistence only.
    }
  }, [activeSymbol]);

  const activeInstrument = findInstrument(activeSymbol);

  return (
    <ActiveInstrumentContext.Provider
      value={{
        activeInstrument,
        activeSymbol: activeInstrument.symbol,
        instruments: DASHBOARD_INSTRUMENTS,
        setActiveInstrument: (symbol) => setActiveSymbol(findInstrument(symbol).symbol),
      }}
    >
      {children}
    </ActiveInstrumentContext.Provider>
  );
}

export function useActiveInstrument() {
  const value = useContext(ActiveInstrumentContext);
  if (!value) {
    throw new Error("useActiveInstrument must be used inside ActiveInstrumentProvider");
  }
  return value;
}

export default ActiveInstrumentProvider;
