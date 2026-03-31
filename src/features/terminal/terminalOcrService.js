/**
 * terminalOcrService.js — Tesseract.js OCR service for chart number extraction.
 *
 * Lazy-loaded (dynamic import) to avoid blocking initial page render.
 * Runs on demand when the user clicks "Scan Screen".
 *
 * Extraction strategy:
 *   1. Run Tesseract on the screenshot image buffer
 *   2. Find LABELLED number patterns first  ("ADX 25.3", "VWAP 21450.5")
 *   3. Fall back to DISAMBIGUATED numbers   (ADX range 0-100, ATR range 1-500, prices 4-7 digits)
 *   4. Merge results across all screenshots, preferring labelled over disambiguated
 *
 * Regex patterns follow trading chart conventions:
 *   - ADX / CI       → 0-100 range
 *   - ATR            → 1-500 range (chart-specific)
 *   - VWAP / Price   → 4-7 digit range with optional decimals
 *   - Session H/L/O  → 4-7 digit range
 */

import { createWorker } from "tesseract.js";

// ─── Regex patterns ────────────────────────────────────────────────────────────

/**
 * Matches labelled numeric values in chart text.
 * Captures: [full match, label, number string]
 *
 * Handles: "ADX 25.3", "VWAP 21450.5", "ATR 145.20", "Price: 21450"
 * Skips:   "Volume 1234567" (volume not in extractedVals), "Time 14:30"
 */
const LABEL_PATTERNS = [
  // ADX / CI / VR — 0 to ~100 range, 1-2 decimal places
  { key: "adx",   re: /\b(?:ADX|Average Directional Index)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,3})?)/i },
  { key: "ci",    re: /\b(?:CI|Compression Index|Compression)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,3})?)/i },

  // ATR — 1-500 range
  { key: "atr",   re: /\b(?:ATR|Average True Range)\s*[:\-]?\s*(\d{1,3}(?:\.\d{1,2})?)/i },

  // VWAP — 4-7 digit range (futures price levels)
  { key: "vwap",  re: /\b(?:VWAP)\s*[:\-]?\s*(\d{4,7}(?:\.\d{1,4})?)/i },

  // Current price — 4-7 digit range
  { key: "currentPrice",
    re: /\b(?:Price|Current(?: Price)?|Last(?: Price)?|Market(?: Price)?)\s*[:\-]?\s*(\d{4,7}(?:\.\d{1,4})?)/i },

  // Session levels — 4-7 digit range
  { key: "sessionHigh",
    re: /\b(?:Session(?: )?High|PDH|Day(?: )?High)\s*[:\-]?\s*(\d{4,7}(?:\.\d{1,4})?)/i },
  { key: "sessionLow",
    re: /\b(?:Session(?: )?Low|PDL|Day(?: )?Low)\s*[:\-]?\s*(\d{4,7}(?:\.\d{1,4})?)/i },
  { key: "sessionOpen",
    re: /\b(?:Session(?: )?Open|OPen)\s*[:\-]?\s*(\d{4,7}(?:\.\d{1,4})?)/i },

  // Volume — captured but not stored in extractedVals (kept for future use)
  { key: "volume",
    re: /\b(?:Volume|Vol)\s*[:\-]?\s*(\d{4,10}(?:[,.\d]*)?)/i },

  // VWAP Slope direction (Up/Down/Flat labels, converted to numeric)
  { key: "vwapSlope",
    re: /\b(?:VWAP(?: )?Slope)\s*[:\-]?\s*(Up|Down|Flat|Neutral)/i },

  // Five-day and twenty-day ATR
  { key: "fiveDayATR",
    re: /\b(?:5(?:[- ])?Day\s*ATR|ATR\s*5(?:D)?)\s*[:\-]?\s*(\d{1,4}(?:\.\d{1,2})?)/i },
  { key: "twentyDayATR",
    re: /\b(?:20(?:[- ])?Day\s*ATR|ATR\s*20(?:D)?)\s*[:\-]?\s*(\d{1,4}(?:\.\d{1,2})?)/i },
];

/**
 * Disambiguation regex — finds bare numbers in expected chart ranges.
 * Only used when labelled extraction fails.
 *
 * Filters out year-like numbers (2024, 2025) and small numbers (1-3 digits)
 * that could be noise.
 */
const BARE_NUM_RE = /\b(\d{4,7}(?:[.,]\d{1,4})?)\b/g; // 4-7 digits = likely price

// Thresholds for disambiguation
const PRICE_MIN = 1000;    // Below this is noise for futures charts
const PRICE_MAX = 99999;
const ATR_MIN   = 1;
const ATR_MAX   = 500;
const ADX_MIN   = 0;
const ADX_MAX   = 100;

// ─── Core extraction helpers ──────────────────────────────────────────────────

/**
 * Extract all labelled numbers from raw OCR text.
 * Returns a partial ExtractedVals object.
 */
function extractLabelledNumbers(rawText) {
  const result = {};
  for (const { key, re } of LABEL_PATTERNS) {
    const match = rawText.match(re);
    if (!match) continue;

    const raw = match[1].trim();

    // VWAP Slope — convert text direction to numeric (-1, 0, +1)
    if (key === "vwapSlope") {
      if (/down/i.test(raw))        { result[key] = -1; }
      else if (/flat|neutral/i.test(raw)) { result[key] = 0; }
      else                           { result[key] = 1; }
      continue;
    }

    // Parse numeric value (handle comma separators)
    const num = parseFloat(raw.replace(/,/g, ""));
    if (Number.isFinite(num)) {
      // Reject obvious noise
      if (num < PRICE_MIN && num > 999) continue; // e.g. year numbers 2024
      result[key] = num;
    }
  }
  return result;
}

/**
 * Extract disambiguated bare numbers from OCR text.
 * Returns candidates with their likely field based on value range.
 */
function extractBareNumbers(rawText) {
  const candidates = [];
  let match;

  const text = rawText.replace(/\b(202[4-9]|203\d)\b/g, ""); // strip year noise

  while ((match = BARE_NUM_RE.exec(text)) !== null) {
    const raw = match[1].replace(/,/g, ".");
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) continue;
    if (num < PRICE_MIN || num > PRICE_MAX) continue;

    // Classify by magnitude
    if (num >= ATR_MIN && num <= ATR_MAX) {
      candidates.push({ num, likelyField: "atr", confidence: 0.7 });
    }
    if (num >= ADX_MIN && num <= ADX_MAX) {
      candidates.push({ num, likelyField: "adx", confidence: 0.6 });
    }
    // Default: price
    candidates.push({ num, likelyField: "price", confidence: 0.5 });
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  const result = {};
  const usedFields = new Set();

  for (const c of candidates) {
    if (usedFields.has(c.likelyField)) continue;
    if (c.likelyField === "price") {
      if (!usedFields.has("currentPrice")) {
        result.currentPrice = c.num;
        usedFields.add("currentPrice");
      }
    } else {
      result[c.likelyField] = c.num;
      usedFields.add(c.likelyField);
    }
  }

  return result;
}

/**
 * Merge two partial ExtractedVals objects.
 * `labelled` takes priority over `bare`.
 */
function mergeResults(labelled, bare) {
  return { ...bare, ...labelled };
}

// ─── Main OCR function ─────────────────────────────────────────────────────────

/**
 * Run Tesseract OCR on a screenshot and extract indicator values.
 *
 * @param {object}   screenshot       - { type, b64 } image object
 * @param {function} [onProgress]     - Called with { status, progress 0-1 }
 *
 * @returns {Promise<object>}         - Partial ExtractedVals object
 */
export async function runScreenOcr(screenshot, onProgress) {
  // Dynamic import — Tesseract.js WASM core loaded only when first needed
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof onProgress === "function") {
        onProgress({ status: m.status, progress: m.progress });
      }
    },
  });

  try {
    // Build data URL from base64
    const dataUrl = `data:${screenshot.type};base64,${screenshot.b64}`;

    const { data: { text } } = await worker.recognize(dataUrl);

    const labelled = extractLabelledNumbers(text);
    const bare     = extractBareNumbers(text);
    const merged   = mergeResults(labelled, bare);

    // Clean up: remove nulls and unwanted keys (volume)
    const cleaned = {};
    const unwanted = new Set(["volume"]);
    for (const [k, v] of Object.entries(merged)) {
      if (unwanted.has(k)) continue;
      if (v === null || v === undefined) continue;
      cleaned[k] = v;
    }

    return { rawText: text, values: cleaned };
  } finally {
    await worker.terminate();
  }
}
