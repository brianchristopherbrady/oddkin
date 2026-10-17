// Recompute the CSP hash for an example page's inline import map after editing it.
// Usage: node scripts/update-csp-hash.mjs examples/core-counter/index.html
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/update-csp-hash.mjs <page.html>');
  process.exit(1);
}
const html = readFileSync(file, 'utf8');
const inline = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html)?.[1];
if (inline === undefined) {
  console.error(`${file}: no inline import map found`);
  process.exit(1);
}
const hash = createHash('sha256').update(inline).digest('base64');
writeFileSync(file, html.replace(/'sha256-[^']+'/, `'sha256-${hash}'`));
console.log(`${file}: sha256-${hash}`);
