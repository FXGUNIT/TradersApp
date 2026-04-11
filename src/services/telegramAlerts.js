/**
 * Telegram Alerts Service
 *
 * J01 (Phase 11): All sends now route through BFF at /telegram/send-message.
 * Token never leaves the browser bundle.
 *
 * Note: sendForensicAlert lives in src/utils/securityAlertUtils.js where it
 * uses the /telegram/send-forensic-alert BFF endpoint (server-side formatting).
 * This file only contains the plain alert path.
 */
import { bffFetch } from './gateways/base.js';

/**
 * Send a plain Telegram alert message via the BFF proxy.
 * @param {string} message - HTML message body
 */
export async function sendTelegramAlert(message) {
  if (!message?.trim()) return;

  try {
    const result = await bffFetch('/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, parse_mode: 'HTML' }),
    });
    if (result === null) {
      console.warn('[TelegramAlerts] BFF unavailable — alert dropped');
    } else if (!result.ok) {
      console.warn('[TelegramAlerts] Telegram send failed:', result.error);
    }
  } catch (error) {
    console.warn('[TelegramAlerts] Telegram alert failed:', error);
  }
}
