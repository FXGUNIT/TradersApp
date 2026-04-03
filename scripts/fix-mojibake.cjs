/**
 * Fixes mojibake encoding corruption in source files.
 *
 * CORRUPTION PATH (confirmed via byte-level analysis):
 * Original: — (U+2014) = UTF-8 bytes E2 80 94
 * Step 1: Saved as Windows-1252 (or Latin-1) → treated as â € "
 * Step 2: Re-read as UTF-8 → Windows-1252 chars decoded as individual UTF-8
 * Result: C3 A2 E2 82 AC E2 80 9D = "â € " (showing as `â€"` in JSON)
 *
 * FIX: Replace the corrupted sequences with correct Unicode characters.
 */
const fs = require('fs');

/**
 * In JavaScript strings (UTF-16), the bytes above map to:
 * C3 A2 → U+00E2 = â (Latin small letter a with circumflex)
 * E2 82 AC → U+20AC = € (Euro sign)
 * E2 80 9D → U+201D = " (right double quotation mark)
 */
const FIXES = [
  // appShellChrome.jsx — AMD phases + TIME_OPTIONS
  // `â € "` (8 bytes, 3 chars) = corrupted em dash
  ['â€"', '\u2014'], // em dash —
  // lightning bolt: C3 A2 C5 A1 → âš = â (U+00E2) + š (U+0161)
  // Actual bytes: E2 98 A2 → ⚡ U+26A1 (correct UTF-8 lightning)
  // But in corrupted file: C3 A2 (â) is followed by something
  ['âš', '\u26A1'], // ⚡ lightning bolt

  // AppScreenRegistry.jsx — L371: `â˜€ï¸?` = corrupted ☀️
  // â = C3 A2, € = E2 82 AC, ï = C3 AF, ¿ = C2 BF
  // Correct ☀️ = U+2600 U+FE0F = E2 98 80 E2 83 8F
  ['â˜€ï', '\u2600\uFE0F'], // ☀️ sun + variation selector

  // AppScreenRegistry.jsx — L373: `ðŸ" ` AMBER
  // ð = C3 B0, Ÿ = C5 B8, " = C2 94,   = C2 A0
  // Correct 🟠 = U+1F7E0 = F0 9F 9F A0
  // But corrupted: C3 B0 C5 B8 C2 94 C2 A0
  ['ðŸ" ', '\u{1F7E0}'], // 🟠 orange circle

  // AppScreenRegistry.jsx — L374: `ðŸŒ™` MIDNIGHT
  // Correct 🌙 = U+1F319 = F0 9F 8C 99
  // Corrupted: C3 B0 C5 B8 (ðŸ) + ?
  ['ðŸŒ™', '\u{1F319}'], // 🌙 crescent moon

  // AppScreenRegistry.jsx — L392: `ðŸ"` SESSIONS
  // Correct 📱 = U+1F4F1 = F0 9F 93 B1
  ['ðŸ"', '\u{1F4F1}'], // 📱 mobile phone

  // authCredentialHandlers.js — L542: `ð'¤` NEW TRADER
  // Correct 👤 = U+1F464 = F0 9F 91 A4
  // Corrupted: C3 B0 C5 B8 E2 80 98 C2 A4
  ['ð' + '\u2018' + '¤', '\u{1F464}'], // 👤 person

  // authCredentialHandlers.js — L542: `ð¡¢` PENDING (🟡)
  // Correct 🟡 = U+1F7E1 = F0 9F 9F A1
  // Corrupted: C3 B0 C5 B8 C5 B8 C2 A1 C2 A2
  ['ð\u0178\u0178\u00A1' + '¢', '\u{1F7E1}'], // 🟡 yellow circle
];

function fixFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  const original = content;
  let count = 0;

  // Sort by length descending to avoid partial replacement
  const sorted = [...FIXES].sort((a, b) => b[0].length - a[0].length);

  for (const [mojibake, correct] of sorted) {
    if (content.includes(mojibake)) {
      const occ = (content.match(new RegExp(mojibake.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      content = content.split(mojibake).join(correct);
      count += occ;
      console.log(`  Replaced ${occ}x: ${JSON.stringify(mojibake)} → ${JSON.stringify(correct)}`);
    }
  }

  if (count > 0) {
    // Verify: check for remaining Latin-1 Supplement chars
    const remaining = [];
    content.split('\n').forEach((line, i) => {
      for (let j = 0; j < line.length; j++) {
        const cp = line.codePointAt(j);
        if (cp >= 0xC0 && cp <= 0xFF) {
          remaining.push(`L${i+1}c${j}: U+${cp.toString(16).toUpperCase()}`);
          break; // only report line once
        }
      }
    });
    if (remaining.length > 0) {
      console.log(`  WARN: ${remaining.length} lines still have Latin-1 chars: ${remaining.slice(0,5).join(', ')}`);
    } else {
      console.log(`  VERIFIED CLEAN: No Latin-1 chars remain`);
    }
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`  SAVED: ${filepath} (${count} replacements)`);
  } else {
    console.log(`  OK: ${filepath.split('/').pop()}`);
  }
}

console.log('=== Mojibake Fix Script ===');
[
  'c:/Users/Asus/Desktop/TradersApp/src/features/identity/authCredentialHandlers.js',
  'c:/Users/Asus/Desktop/TradersApp/src/features/shell/AppScreenRegistry.jsx',
  'c:/Users/Asus/Desktop/TradersApp/src/features/shell/appShellChrome.jsx',
  'c:/Users/Asus/Desktop/TradersApp/src/App.jsx',
].forEach(fixFile);
