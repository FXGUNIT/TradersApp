/**
 * Atomic write helper for JSON domain files.
 * Uses temp-file + rename for crash-safe writes.
 * renameSync is atomic on POSIX; best-effort rename on Windows (same volume = safe).
 */
import { writeFileSync, renameSync, existsSync } from "node:fs";

const TMP_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function tmpName(path) {
  const rand = Array.from({ length: 12 }, () =>
    TMP_CHARS[Math.floor(Math.random() * TMP_CHARS.length)]
  ).join("");
  return `${path}.tmp.${Date.now()}.${rand}`;
}

/**
 * Write JSON to path atomically.
 * On error the tmp file is removed; original file is untouched.
 * @param {string} path
 * @param {unknown} data  — will be JSON.stringify'd
 */
export function writeAtomic(path, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = tmpName(path);
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  } catch (err) {
    try { if (existsSync(tmp)) writeFileSync(tmp, "", "utf8"); } catch { /* ignore */ }
    throw err;
  }
}
