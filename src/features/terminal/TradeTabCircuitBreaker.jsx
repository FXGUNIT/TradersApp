import React, { useEffect, useRef, useState } from "react";

const CIRCUIT_KEY = "tilt_circuit_until";

function getCircuitSecs() {
  try {
    const v = localStorage.getItem(CIRCUIT_KEY);
    if (!v) return 0;
    return Math.max(0, Math.ceil((parseInt(v, 10) - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

export default function TradeTabCircuitBreaker({
  execBlocked,
  onCircuitSecsChange,
  circuitSecs,
}) {
  const circuitTimerRef = useRef(null);

  useEffect(() => {
    if (!execBlocked) {
      if (circuitTimerRef.current) {
        clearInterval(circuitTimerRef.current);
        circuitTimerRef.current = null;
      }
      return;
    }

    circuitTimerRef.current = setInterval(() => {
      const secs = getCircuitSecs();
      onCircuitSecsChange(secs);
      if (secs <= 0 && circuitTimerRef.current) {
        clearInterval(circuitTimerRef.current);
        circuitTimerRef.current = null;
      }
    }, 1000);

    return () => {
      if (circuitTimerRef.current) {
        clearInterval(circuitTimerRef.current);
        circuitTimerRef.current = null;
      }
    };
  }, [execBlocked, onCircuitSecsChange]);

  return null;
}

export { getCircuitSecs };
