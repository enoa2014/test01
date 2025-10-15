const fs = require('fs');
const path = require('path');

const roots = ['wx-project', 'cloudfunctions'];
const exts = new Set(['.json', '.wxml', '.wxss', '.js']);

let processed = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!exts.has(path.extname(entry.name))) {
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    fs.writeFileSync(fullPath, content, 'utf8');
    processed += 1;
  }
}

for (const root of roots) {
  walk(path.resolve(__dirname, '..', root));
}

console.log(`Checked ${processed} files and rewrote them as UTF-8 without BOM.`);
