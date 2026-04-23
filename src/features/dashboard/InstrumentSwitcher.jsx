import React from "react";
import { CandlestickChart } from "lucide-react";
import { useActiveInstrument } from "./ActiveInstrumentContext.jsx";

export function InstrumentSwitcher() {
  const { activeSymbol, instruments, setActiveInstrument } = useActiveInstrument();

  return (
    <div className="cc-switcher">
      <div className="cc-switcher__label">
        <CandlestickChart size={14} />
        <span>Active Instrument</span>
      </div>
      <div className="cc-switcher__row">
        {instruments.map((instrument) => {
          const isActive = instrument.symbol === activeSymbol;
          return (
            <button
              key={instrument.symbol}
              type="button"
              className={`cc-switcher__button${isActive ? " is-active" : ""}`}
              onClick={() => setActiveInstrument(instrument.symbol)}
            >
              <span className="cc-switcher__button-title">{instrument.shortLabel}</span>
              <span className="cc-switcher__button-meta">{instrument.market}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default InstrumentSwitcher;
