const fs = require('fs');

// Fix AppScreenRegistry.jsx
const f2 = 'c:/Users/Asus/Desktop/TradersApp/src/features/shell/AppScreenRegistry.jsx';
let c2 = fs.readFileSync(f2, 'utf8');

const sessions_before = '\u00F0\u0178\u201C\u00B1';
const sessions_after = '\u{1F4F1}';
if (c2.includes(sessions_before)) { c2 = c2.split(sessions_before).join(sessions_after); console.log('Fixed SESSIONS'); }

const lumiere_garbage = '\u02DC\u008C';
if (c2.includes(lumiere_garbage)) { c2 = c2.split(lumiere_garbage).join(''); console.log('Fixed LUMIERE garbage'); }

fs.writeFileSync(f2, c2);

// Fix appShellChrome.jsx - read fresh
const f3 = 'c:/Users/Asus/Desktop/TradersApp/src/features/shell/appShellChrome.jsx';
let c3 = fs.readFileSync(f3, 'utf8');
const emdash = '\u00E2\u20AC\u201D';
if (c3.includes(emdash)) {
  const count = (c3.match(/\u00E2\u20AC\u201D/g) || []).length;
  c3 = c3.split(emdash).join('\u2014');
  console.log('Fixed em dashes x' + count);
}
fs.writeFileSync(f3, c3);

// Verify each file
const files = [
  'c:/Users/Asus/Desktop/TradersApp/src/features/identity/authCredentialHandlers.js',
  'c:/Users/Asus/Desktop/TradersApp/src/features/shell/AppScreenRegistry.jsx',
  'c:/Users/Asus/Desktop/TradersApp/src/features/shell/appShellChrome.jsx',
];
console.log('\nVerification:');
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const bad = [];
  c.split('\n').forEach((l, i) => {
    for (let j = 0; j < l.length; j++) {
      const cp = l.codePointAt(j);
      if (cp >= 0xC0 && cp <= 0xFF) {
        bad.push('L' + (i+1) + 'c' + j + ':U+' + cp.toString(16).toUpperCase());
      }
    }
  });
  console.log(f.split('/').pop() + ': ' + (bad.length ? 'BAD: ' + bad.slice(0,3).join(', ') : 'CLEAN'));
});
