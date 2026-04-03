const fs = require('fs');

// AppScreenRegistry.jsx — L373 AMBER emoji
const f2 = 'c:/Users/Asus/Desktop/TradersApp/src/features/shell/AppScreenRegistry.jsx';
let c2 = fs.readFileSync(f2, 'utf8');
// Characters at L373: U+00F0 U+0178 U+0178 U+00A0 → 🟠
const amber_before = '\u00F0\u0178\u0178\u00A0';
const amber_after = '\u{1F7E0}';
if (c2.includes(amber_before)) { c2 = c2.split(amber_before).join(amber_after); console.log('Fixed AMBER'); }
else { console.log('AMBER pattern not found'); }
fs.writeFileSync(f2, c2);

// appShellChrome.jsx — AMD phase icons
const f3 = 'c:/Users/Asus/Desktop/TradersApp/src/features/shell/appShellChrome.jsx';
let c3 = fs.readFileSync(f3, 'utf8');
// L358: U+00E2 U+2014 U+2030 → ●
const b1 = '\u00E2\u2014\u2030';
const b1r = '\u25CF';
if (c3.includes(b1)) { c3 = c3.split(b1).join(b1r); console.log('Fixed L358'); }
// L370: U+00E2 U+2014 U+02C6 → ◉
const b2 = '\u00E2\u2014\u02C6';
const b2r = '\u25C9';
if (c3.includes(b2)) { c3 = c3.split(b2).join(b2r); console.log('Fixed L370'); }
// L376: U+00E2 U+0178 U+00B3 → ⊙
const b3 = '\u00E2\u0178\u00B3';
const b3r = '\u2299';
if (c3.includes(b3)) { c3 = c3.split(b3).join(b3r); console.log('Fixed L376'); }
fs.writeFileSync(f3, c3);

// Verify
console.log('\nFinal:');
['authCredentialHandlers.js', 'AppScreenRegistry.jsx', 'appShellChrome.jsx'].forEach(name => {
  const f = 'c:/Users/Asus/Desktop/TradersApp/src/features/' + (name === 'authCredentialHandlers.js' ? 'identity/' : 'shell/') + name;
  const c = fs.readFileSync(f, 'utf8');
  const bad = [];
  c.split('\n').forEach((l, i) => {
    for (let j = 0; j < l.length; j++) {
      const cp = l.codePointAt(j);
      if (cp >= 0xC0 && cp <= 0xFF) { bad.push('L' + (i+1)); break; }
    }
  });
  console.log(name + ': ' + (bad.length ? 'BAD: ' + bad.join(',') : 'CLEAN ✓'));
});
