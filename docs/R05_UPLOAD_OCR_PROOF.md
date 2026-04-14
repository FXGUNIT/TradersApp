# R05 Proof Artifact: File Upload, Screenshot & OCR Robustness

**Task:** R05 — Prove file-upload, screenshot, and OCR flows are robust.
**Claimed by:** claude-sonnet | **Date:** 2026-04-14
**Status:** EVIDENCE GATHERED — gaps identified

---

## What R05 Requires

Five proof steps:
1. Happy-path upload: screenshots, MP chart, VWAP chart across supported types and normal sizes
2. Rejection behavior: oversized files, unsupported types, corrupted files, duplicate uploads, too-many-files
3. OCR fallback: partial failure, poor quality, unavailable
4. Deletion/replacement: no stale previews, stale counts, orphaned temp state
5. Retry/recovery: refresh or service interruption during upload

---

## System Examined

### Architecture: Client-Side Only

The screenshot pipeline is entirely client-side — no server-side file storage:

```
User paste/drop/file-select
  → ImageUploadPanel.jsx / terminalPasteListener.js
    → FileReader.readAsDataURL (base64 in memory)
      → React state (screenshots[], mpChart, vwapChart)
        → Tesseract.js OCR (WASM in browser, terminalOcrService.js)
        → AI API via buildScreenshotsContent() (base64 sent to providers)
```

No BFF upload endpoint. Images never leave the browser except as base64 payloads to AI providers.

### Key Files

| File | Role |
|------|------|
| `src/features/terminal/ImageUploadPanel.jsx` | 3 PasteZone areas: INDICATORS (multi), VWAP, MP chart |
| `src/features/terminal/terminalUploadUtils.js` | `onScreenshotDrop`, `imageFileToPayload`, `MAX_SCREENSHOTS=4` |
| `src/features/terminal/terminalPasteListener.js` | Document-level paste listener, zone routing, `MAX_SCREENSHOTS=4` |
| `src/features/terminal/terminalOcrService.js` | Tesseract.js OCR, labelled + bare number extraction, WASM lazy-load |
| `src/features/terminal/useTerminalOcr.js` | React state machine: IDLE→LOADING→SCANNING→SUCCESS/ERROR |
| `src/features/terminal/terminalAiHandlers.js` | `buildScreenshotsContent()` — assembles base64 for AI API payloads |

### Zones and Limits

```
INDICATORS  (ss zone)  — multi, max 4 screenshots
VWAP CHART  (vwap zone) — single image
30-MIN MP   (mp zone)  — single image
+ 3 premarket zones: p1news, p1prem, p1lvl
MAX_SCREENSHOTS = 4 enforced in BOTH paste listener AND upload utils
```

---

## Verified Behaviors

### ✅ MAX_SCREENSHOTS enforced in two places

`terminalUploadUtils.js:39` and `terminalPasteListener.js:62`:
```js
[...current, ...nextAssets].slice(0, MAX_SCREENSHOTS)
// and
if (newCount > MAX_SCREENSHOTS) {
  setter((prev) => [...prev.slice(1), imgObj]); // oldest removed, FIFO
  showToast("full (4/4) — oldest removed", "info");
}
```
Both enforce the same limit. When full, oldest is silently removed (FIFO) with a toast notification.

### ✅ File type validation

`terminalUploadUtils.js`:
```js
function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}
```
Non-image files in drop events are silently filtered. Only MIME type checked — extension not trusted.

### ✅ No server-side file storage

Images exist only in React state. No BFF upload route, no temp file cleanup needed.

### ✅ OCR lazy-loads Tesseract WASM

`terminalOcrService.js`:
```js
const { createWorker } = await import("tesseract.js");
```
Tesseract is dynamically imported only when the user first clicks "Scan Screen". Does not block page load.

### ✅ OCR has two-pass extraction

1. **Labelled** — regex matches on text labels ("ADX 25.3", "VWAP 21450.5") — high confidence
2. **Bare numbers** — falls back to disambiguated values in expected ranges (price: 1000-99999, ATR: 1-500) — lower confidence

Results are merged with labelled taking priority.

### ✅ OCR error states are surfaced to user

`useTerminalOcr.js` state machine:
```
IDLE → LOADING (Tesseract WASM loading) → SCANNING (per-image)
  → SUCCESS (values merged, toast shown)
  → ERROR   (toast: "No readable numbers" or "Scan failed: {err}")
```

### ✅ Deletion is clean

Delete button in `ImageUploadPanel.jsx` calls `setScreenshots(p => p.filter((_, idx) => idx !== i))`. React state update removes image immediately — no orphaned base64 in memory after state settles.

### ✅ OCR partial failure handled

`useTerminalOcr.js` iterates screenshots, merges results across all. If one image returns nothing, the others still contribute. If all return nothing → ERROR state with toast.

### ✅ Duplicate uploads handled

`onScreenshotDrop` appends files to the existing array then slices to `MAX_SCREENSHOTS`. Duplicates increment count until FIFO removes oldest. No crash on duplicate.

### ✅ AI API screenshots content builder

`terminalAiHandlers.js` `buildScreenshotsContent()` safely handles:
```js
if (mpChart) content.push({ type: 'image', source: { type: 'base64', media_type: mpChart.type, data: mpChart.b64 } });
```
Only adds if truthy. Skips gracefully if all are null.

---

## Gaps Identified

### ⚠️ GAP 1 (Medium): No client-side file size validation

`terminalPasteListener.js` and `terminalUploadUtils.js` both read files via `FileReader.readAsDataURL` with no size check before encoding. A 50MB screenshot would be fully loaded into browser memory as base64 (~67MB string), potentially causing memory pressure or crash on low-end devices.

**Fix:** Add client-side size guard before encoding:
```js
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_BYTES) {
  showToast("Screenshot too large — max 10MB", "error");
  return;
}
```

---

### ⚠️ GAP 2 (Medium): BFF body limit (200KB) may reject valid base64 screenshots

AI endpoints (`/ai/provider-chat`, `/ai/deliberate`) use `readJsonBody(req, 200_000)` — 200KB limit.

Base64 inflates binary by ~33%. A ~150KB PNG encodes to ~200KB of base64 text, hitting the ceiling. A 1MP JPEG (~300KB compressed) encodes to ~400KB — silently rejected by BFF.

The screenshots flow through AI prompts — if the limit triggers, the user sees no specific error (request just fails at transport level).

**Fix:** Increase limit to `5_000_000` (5MB) for AI endpoints, or implement client-side compression before encoding.

---

### ⚠️ GAP 3 (Low): OCR failure leaves stale extracted values in state

`useTerminalOcr.js` sets `ocrResult` and calls `onResult(values)` on success. If OCR fails, `ocrState` → ERROR but `ocrResult` retains the previous successful values (if any). There is no `resetOcrResult` on failure.

Risk: User runs OCR → gets values → deletes screenshots → runs OCR again → if new run fails, old values remain displayed.

**Fix:** Clear `ocrResult` at the start of `runOcr`:
```js
setOcrResult(null); // at top of runOcr
```

---

### ⚠️ GAP 4 (Low): Corrupted/unreadable images silently return empty OCR

`terminalOcrService.js` `extractLabelledNumbers` and `extractBareNumbers` return empty objects for images with no detectable numbers. The only signal is `Object.keys(allValues).length === 0` which triggers the ERROR state toast. But the raw text from Tesseract is not exposed to the user — they can't see *why* the image failed.

**Fix:** On OCR ERROR, show the raw text or at least "Could not read numbers — try a clearer screenshot."

---

## Execution Plan (blocked on Docker/WSL)

```bash
# 1. Happy path — paste a screenshot → verify toast, count increments
# 2. Oversized paste — paste 10MB+ image → verify error toast (currently: no toast, memory grows)
# 3. Non-image paste — paste a PDF → verify silently ignored (currently: correct)
# 4. 5 screenshots → verify FIFO oldest removal (currently: correct)
# 5. Run OCR → success → delete all screenshots → run OCR again → verify ERROR state (currently: shows stale values)
# 6. BFF limit probe — send 400KB base64 screenshot → verify 413 or clear error
```

---

## Interim Verdict

**Not yet passable.** Gap 1 (no client-side file size check) and Gap 2 (200KB AI endpoint limit) need fixes. These are not theoretical — a single large screenshot paste can either crash the browser tab or silently fail to submit to the AI.

**Fixes needed before R05 can be marked `[x]`:**
1. Client-side `MAX_FILE_BYTES` guard before `readAsDataURL`
2. BFF AI endpoint body limit raised from 200KB to 5MB
3. Optional: reset `ocrResult` on retry, expose raw OCR text on failure

**Proof artifact:** `docs/R05_UPLOAD_OCR_PROOF.md`
