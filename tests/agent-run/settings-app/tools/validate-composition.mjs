// Validates settings.composition.json with the package's own validator, and checks that
// composition.js allows exactly the tags the document uses.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateComposition } from '@oddkin/components/composition';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const document = JSON.parse(readFileSync(join(ROOT, 'settings.composition.json'), 'utf8'));

const result = validateComposition(document);
console.log(JSON.stringify(result, null, 2));

const tags = new Set();
const collect = (nodes = []) =>
  nodes.forEach((node) => {
    if (typeof node === 'string') return;
    tags.add(node.element);
    collect(node.children);
  });
collect(document.root);
console.log(`tags used: ${[...tags].join(', ')}`);

let allowMatches = true;
const host = join(ROOT, 'composition.js');
if (existsSync(host)) {
  const match = readFileSync(host, 'utf8').match(/const ALLOW = (\[[^\]]*\]);/);
  const allow = match ? JSON.parse(match[1].replace(/'/g, '"')) : [];
  allowMatches = allow.length === tags.size && allow.every((tag) => tags.has(tag));
  console.log(`composition.js allow-list: ${allow.join(', ')} (${allowMatches ? 'matches' : 'DOES NOT match'} the document)`);
}

process.exitCode = result.ok && allowMatches ? 0 : 1;
