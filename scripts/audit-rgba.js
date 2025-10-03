#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_PATTERNS = ['rgba(', 'rgb(', 'linear-gradient('];
const ignoreDirs = new Set(['node_modules', '.git', '.bmad-core', 'tools/cloudbase-cli']);
const results = [];

function shouldProcess(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..')) return false;
  const segments = rel.split(path.sep);
  return !segments.some(seg => ignoreDirs.has(seg));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    TARGET_PATTERNS.forEach(pattern => {
      if (line.includes(pattern)) {
        results.push({ file: filePath, line: index + 1, snippet: line.trim() });
      }
    });
  });
}

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (!shouldProcess(fullPath)) return;
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (/\.(wxss|css|js|ts|json|md)$/i.test(entry.name)) {
      scanFile(fullPath);
    }
  });
}

walk(ROOT);
const summary = results.map(
  ({ file, line, snippet }) => `${path.relative(ROOT, file)}:${line} ${snippet}`
);
console.log(summary.join('\n'));
console.log(`\nTOTAL: ${results.length}`);
