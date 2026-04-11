/**
 * Security Alert Utilities — Forensic Data Gathering + Telegram Alerts
 *
 * J01 (Phase 11): Telegram token removed from browser bundle.
 * All Telegram sends now route through BFF at /telegram/send-message and
 * /telegram/send-forensic-alert. Tokens live in BFF environment variables only.
 *
 * Privacy note (J04): gatherForensicData() calls ipify.org + ipapi.co from the
 * browser. This is reviewed separately under J04 — geo-enrichment may need to
 * be moved server-side depending on privacy/legal requirements.
 */
import { bffFetch } from '../services/gateways/base.js';

// ── Forensic data (J04 — privacy-sensitive) ────────────────────────────────────

export const gatherForensicData = async () => {
  try {
    const forensic = {};

    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let osName = 'Unknown';

    if (/Edg/.test(userAgent)) browserName = 'Edge';
    else if (/Chrome/.test(userAgent)) browserName = 'Chrome';
    else if (/Safari/.test(userAgent)) browserName = 'Safari';
    else if (/Firefox/.test(userAgent)) browserName = 'Firefox';
    else if (/Opera|OPR/.test(userAgent)) browserName = 'Opera';

    if (/Windows/.test(userAgent)) osName = 'Windows';
    else if (/Mac/.test(userAgent)) osName = 'macOS';
    else if (/Linux/.test(userAgent)) osName = 'Linux';
    else if (/Android/.test(userAgent)) osName = 'Android';
    else if (/iPhone|iPad/.test(userAgent)) osName = 'iOS';

    forensic.browser = browserName;
    forensic.os = osName;
    forensic.screenResolution = `${window.screen.width}x${window.screen.height}`;

    // J04: These calls originate from the browser — privacy/legal review required.
    // Consider moving to BFF server-side enrichment for GDPR compliance.
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      forensic.ip = ipData.ip || 'Unknown';
    } catch {
      forensic.ip = 'Unknown';
    }

    try {
      const geoRes = await fetch('https://ipapi.co/json/');
      const geoData = await geoRes.json();
      forensic.city = geoData.city || 'Unknown';
      forensic.region = geoData.region || 'Unknown';
      forensic.country = geoData.country_name || 'Unknown';
      forensic.isp = geoData.org || 'Unknown';
    } catch {
      forensic.city = 'Unknown';
      forensic.region = 'Unknown';
      forensic.country = 'Unknown';
      forensic.isp = 'Unknown';
    }

    forensic.timestamp = new Date().toLocaleString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });

    return forensic;
  } catch (error) {
    console.error('Forensic data gathering failed:', error);
    return {
      browser: 'Unknown', os: 'Unknown', screenResolution: 'Unknown',
      ip: 'Unknown', city: 'Unknown', region: 'Unknown',
      country: 'Unknown', isp: 'Unknown', timestamp: new Date().toLocaleString(),
    };
  }
};

// ── Telegram alert via BFF proxy (J01) ───────────────────────────────────────

/**
 * Send a plain Telegram alert message via the BFF proxy.
 * Token never leaves the browser.
 *
 * @param {string} message - HTML message body
 */
export const sendTelegramAlert = async (message) => {
  // Graceful no-op if BFF is unavailable (fail silently in production)
  if (!message?.trim()) return;

  try {
    const result = await bffFetch('/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, parse_mode: 'HTML' }),
    });
    if (result === null) {
      console.warn('[SecurityAlert] BFF unavailable — Telegram alert dropped');
    } else if (!result.ok) {
      console.warn('[SecurityAlert] Telegram send failed:', result.error);
    }
  } catch (error) {
    console.warn('[SecurityAlert] Telegram alert failed:', error);
  }
};

/**
 * Send a formatted forensic breach alert via the BFF proxy.
 * Gathers browser/OS/screen data, formats the message server-side (no HTML in browser).
 *
 * @param {string} targetEmail
 * @param {'BREACH' | string} alertType
 */
export const sendForensicAlert = async (targetEmail, alertType = 'BREACH') => {
  const forensic = await gatherForensicData();

  try {
    const result = await bffFetch('/telegram/send-forensic-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, alertType, forensic }),
    });
    if (result === null) {
      console.warn('[SecurityAlert] BFF unavailable — forensic alert dropped');
    } else if (!result.ok) {
      console.warn('[SecurityAlert] Forensic alert failed:', result.error);
    }
  } catch (error) {
    console.warn('[SecurityAlert] Forensic alert failed:', error);
  }
};
