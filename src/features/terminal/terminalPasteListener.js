import { useEffect, useRef, useState, useCallback } from "react";

const ZONE_LABELS = {
  ss: "Indicators Zone",
  vwap: "VWAP Chart Zone",
  mp: "30-Min MP Zone",
  p1news: "Economic Calendar Zone",
  p1prem: "Premarket Chart Zone",
  p1lvl: "Key Levels Zone",
};

const MAX_SCREENSHOTS = 4;

/**
 * usePasteListener — BFF hook owning all clipboard paste behavior.
 *
 * Owns the document-level 'paste' event listener, routes image blobs to the
 * correct zone handler, shows toast feedback, and drives the PasteZone flash
 * animation via the returned flashingZoneId.
 *
 * @param {object} params
 * @param {string|null} params.activeZone        - Currently focused zone ID
 * @param {object}   params.handlers             - Map of zoneId → state setter
 * @param {function} params.showToast            - Stable showToast(message, type, duration)
 * @param {number}   [params.screenshotsLength]  - Current screenshot count for ss-zone inference
 *
 * @returns {{ flashingZoneId: string|null, triggerFlash: (zoneId: string) => void }}
 */
export function usePasteListener({ activeZone, handlers, showToast, screenshotsLength = 0 }) {
  const [flashingZoneId, setFlashingZoneId] = useState(null);
  const flashTimeoutRef = useRef(null);

  const triggerFlash = useCallback((zoneId) => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashingZoneId(zoneId);
    flashTimeoutRef.current = setTimeout(() => setFlashingZoneId(null), 500);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!activeZone) return;

      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find((i) => i.type.startsWith("image/"));

      if (!imgItem) return;
      e.preventDefault();

      const file = imgItem.getAsFile();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target.result.split(",")[1];
        const imgObj = { name: "pasted.png", b64, type: "image/png" };
        const zoneLabel = ZONE_LABELS[activeZone] ?? activeZone;
        const setter = handlers[activeZone];

        switch (activeZone) {
          case "ss": {
            const newCount = screenshotsLength + 1;
            if (newCount > MAX_SCREENSHOTS) {
              if (setter) setter((prev) => [...prev.slice(1), imgObj]);
              showToast(
                `${zoneLabel} full (${MAX_SCREENSHOTS}/${MAX_SCREENSHOTS}) — oldest removed`,
                "info"
              );
            } else {
              if (setter) setter((prev) => [...prev, imgObj]);
              showToast(`Screenshot Captured to ${zoneLabel}`, "success");
            }
            triggerFlash(activeZone);
            break;
          }

          case "vwap":
          case "mp":
          case "p1news":
          case "p1prem":
          case "p1lvl": {
            if (setter) setter(imgObj);
            showToast(`Screenshot Captured to ${zoneLabel}`, "success");
            triggerFlash(activeZone);
            break;
          }

          default:
            break;
        }
      };
      reader.readAsDataURL(file);
    };

    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [activeZone, handlers, showToast, triggerFlash, screenshotsLength]);

  return { flashingZoneId, triggerFlash };
}

export { ZONE_LABELS, MAX_SCREENSHOTS };
