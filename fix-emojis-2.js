// Node.js script to fix corrupted emojis in App.jsx
import fs from "fs";

const file = "src/App.jsx";
let content = fs.readFileSync(file, "utf8");

// Fix corrupted emojis using byte sequences
// These are the corrupted versions of common emojis

// Replace the corrupted sequences
content = content.replace(/\u{1F465}\u{0161}\u{00A8}/gu, "\u{1F6A8}"); // 👥š¨ -> 🚨
content = content.replace(
  /\u{00E2}\u{009A}\u{0099}\u{0020}\u{00EF}\u{00B8}\u{00A8}\u{0020}MALICIOUS/gu,
  "\u{1F6A8} MALICIOUS",
);
content = content.replace(
  /\u{00E2}\u{009A}\u{0099}\u{00EF}\u{00B8}/gu,
  "\u{26A0}\u{FE0F}",
); // âšï¸ -> ⚠️
content = content.replace(
  /\u{1F465}\u{203A}\u{00A1}\u{00EF}\u{00B8}/gu,
  "\u{2705}",
); // 👥›¡ï¸ -> ✅
content = content.replace(/\u{1F465}"\u{00B1}/gu, "\u{2705}"); // 👥"± -> ✅
content = content.replace(
  /\u{00E2}\u{009A}\u{0099}\u{0020}/gu,
  "\u{26A0}\u{FE0F}",
); // âš  -> ⚠️
content = content.replace(/\u{00EF}\u{00B8}/gu, ""); // ï¸ -> remove

fs.writeFileSync(file, content, "utf8");
console.warn("Fixed corrupted emojis in", file);
