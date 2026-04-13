const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "App.jsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix AMD prompt emojis
const replacements = [
  ["â˜", "★"],
  ['â†"', "→"],
  ["â†", "→"],
  ['âœ"', "✓"],
  ["âœ", "✓"],
  ["ðŸš«", "✗"],
];

let count = 0;
for (const [corrupt, fix] of replacements) {
  if (content.includes(corrupt)) {
    content = content.split(corrupt).join(fix);
    count++;
  }
}

fs.writeFileSync(filePath, content, "utf8");
console.log(`Fixed ${count} AMD emoji patterns`);
