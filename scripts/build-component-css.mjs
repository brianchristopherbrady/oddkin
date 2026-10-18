// Write the opt-in document stylesheets of @oddkin/components (reset, base, utilities) from
// their TypeScript sources into packages/components/dist/css/*.css. Each file starts with the
// canonical layer order (ADR 0039) and keeps its rules inside its layer. Run after `tsc -b`.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'packages/components/dist/css');
const { documentStylesheets } = await import(pathToFileURL(join(dist, 'index.js')).href);
const { LAYER_ORDER } = await import(
  pathToFileURL(join(root, 'packages/tokens/dist/generate/index.js')).href
);

const indent = (text) =>
  text
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `  ${line.replace(/^ {4}/, '')}` : ''))
    .join('\n');

const written = [];
for (const [name, sheet] of Object.entries(documentStylesheets)) {
  const text = `@layer ${LAYER_ORDER.join(', ')};\n\n@layer ${sheet.layer} {\n${indent(sheet.styles.cssText)}\n}\n`;
  await writeFile(join(dist, `${name}.css`), text);
  written.push(`${name}.css`);
}
console.log(`Component CSS: ${written.join(', ')}`);
