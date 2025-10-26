#!/usr/bin/env node
/**
 * Simple Markdown relative link checker (no deps).
 * - Scans docs/ and optional extra files.
 * - Checks [text](path) and images ![](path) that are relative (no http/mailto/#).
 * - Resolves against the file's directory.
 * - Prints a report; always exits 0 (for local use only).
 */

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function isRelativeLink(link) {
  if (!link) return false;
  const l = link.trim();
  const lowered = l.toLowerCase();
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) return false;
  if (lowered.startsWith('mailto:') || lowered.startsWith('tel:') || lowered.startsWith('javascript:')) return false;
  if (l.startsWith('#')) return false;
  if (l.startsWith('/')) return false; // treat as site-absolute; skip
  return true;
}

function collectMarkdownFiles(startDir) {
  const results = [];
  function walk(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) {
        walk(p);
      } else if (it.isFile() && p.toLowerCase().endsWith('.md')) {
        results.push(p);
      }
    }
  }
  walk(startDir);
  return results;
}

function checkFile(mdPath) {
  const content = fs.readFileSync(mdPath, 'utf8');
  const dir = path.dirname(mdPath);
  const linkRe = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const issues = [];
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    const raw = m[1];
    const link = raw.split('#')[0];
    if (!isRelativeLink(link)) continue;
    const target = path.resolve(dir, link);
    if (!fs.existsSync(target)) {
      issues.push({ link: raw, resolved: target });
    }
  }
  return issues;
}

function main() {
  const args = process.argv.slice(2);
  const files = new Set();
  // Always include docs/
  const docsDir = path.join(repoRoot, 'docs');
  if (fs.existsSync(docsDir)) {
    collectMarkdownFiles(docsDir).forEach(f => files.add(f));
  }
  // Extra explicit files
  for (const a of args) {
    const p = path.join(repoRoot, a);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        collectMarkdownFiles(p).forEach(f => files.add(f));
      } else if (stat.isFile() && p.endsWith('.md')) {
        files.add(p);
      }
    }
  }

  let totalIssues = 0;
  const report = [];

  for (const f of Array.from(files).sort()) {
    const issues = checkFile(f);
    if (issues.length) {
      totalIssues += issues.length;
      report.push(`\n[Broken Links] ${path.relative(repoRoot, f)}`);
      for (const it of issues) {
        report.push(` - ${it.link} -> ${path.relative(repoRoot, it.resolved)} (missing)`);
      }
    }
  }

  if (totalIssues === 0) {
    console.log('docs-check-links: ✓ no broken relative links found');
  } else {
    console.log(report.join('\n'));
    console.log(`\nTotal broken links: ${totalIssues}`);
  }
  process.exit(0);
}

main();

