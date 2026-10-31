// Checks the pages' import maps against the module graph the browser would load, with the project
// directory as the web root. `--generate` prints, per page, the import map Node's resolver implies
// (the packages' "default" export condition). Run with --experimental-vm-modules (V8 parses imports).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'http://localhost/';
const PAGES = ['index.html', 'composition.html'];
const generate = process.argv.includes('--generate');

if (typeof vm.SourceTextModule !== 'function') {
  console.error('Run with: node --experimental-vm-modules tools/check-imports.mjs');
  process.exit(2);
}

const toFile = (url) => join(ROOT, ...decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean));
const toWebPath = (file) => './' + relative(ROOT, file).split(sep).join('/');
const isBare = (spec) => !/^(\.{0,2}\/|[a-z][a-z0-9+.-]*:)/i.test(spec);

function readPage(page) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const maps = [...html.matchAll(/<script\s+type="importmap"\s*>([\s\S]*?)<\/script>/g)];
  const entries = [...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"\s*>\s*<\/script>/g)].map((m) => m[1]);
  const inline = [...html.matchAll(/<script\s+type="module"\s*>/g)].length;
  const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((m) => m[1]);
  return { maps: maps.map((m) => JSON.parse(m[1])), entries, inline, styles };
}

// The import map algorithm for top-level "imports": exact match, else the longest "/"-ending prefix.
function mapLookup(imports, spec, base) {
  if (Object.hasOwn(imports, spec)) return new URL(imports[spec], base).href;
  const prefix = Object.keys(imports)
    .filter((key) => key.endsWith('/') && spec.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? new URL(spec.slice(prefix.length), new URL(imports[prefix], base)).href : undefined;
}

function requestsOf(file) {
  const source = readFileSync(file, 'utf8');
  const module = new vm.SourceTextModule(source, { identifier: file });
  const requests = module.moduleRequests ?? module.dependencySpecifiers.map((specifier) => ({ specifier, attributes: {} }));
  const dynamic = [];
  source.split('\n').forEach((line, i) => {
    if (/(^|[^.\w$])import\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) dynamic.push(`${i + 1}: ${line.trim()}`);
  });
  return { requests, dynamic };
}

let failed = false;
const fail = (message) => {
  failed = true;
  console.log(`  ERROR ${message}`);
};

for (const page of PAGES) {
  if (!existsSync(join(ROOT, page))) {
    console.log(`== ${page}: not found`);
    failed = true;
    continue;
  }
  const pageURL = new URL(page, ORIGIN).href;
  const { maps, entries, inline, styles } = readPage(page);
  console.log(`== ${page}`);
  if (maps.length !== 1 && !generate) fail(`expected one import map, found ${maps.length}`);
  if (inline) fail(`${inline} inline module script(s); this check covers src= modules only`);
  const imports = maps[0]?.imports ?? {};
  for (const href of styles) {
    const url = new URL(href, pageURL);
    if (url.origin === new URL(ORIGIN).origin && !existsSync(toFile(url))) fail(`stylesheet ${href} does not exist`);
  }
  for (const [key, target] of Object.entries(imports)) {
    if (!existsSync(toFile(new URL(target, pageURL)))) fail(`map target for ${key} does not exist: ${target}`);
  }

  const used = new Set();
  const implied = {};
  const seen = new Set();
  const queue = entries.map((src) => new URL(src, pageURL).href);
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const file = toFile(url);
    if (!existsSync(file)) {
      fail(`module ${url} does not exist`);
      continue;
    }
    const { requests, dynamic } = requestsOf(file);
    for (const line of dynamic) console.log(`  note: dynamic import in ${toWebPath(file)}:${line}`);
    for (const { specifier, attributes } of requests) {
      if (attributes && Object.keys(attributes).length)
        console.log(`  note: import attributes ${JSON.stringify(attributes)} for ${specifier} in ${toWebPath(file)}`);
      let target;
      if (isBare(specifier)) {
        // Node's resolver, from the project directory: the packages' own "exports" with "default".
        const nodeTarget = toWebPath(fileURLToPath(import.meta.resolve(specifier)));
        implied[specifier] = nodeTarget;
        target = generate ? new URL(nodeTarget, pageURL).href : mapLookup(imports, specifier, pageURL);
        if (!target) {
          fail(`bare specifier "${specifier}" (imported by ${toWebPath(file)}) is not mapped`);
          continue;
        }
        used.add(specifier);
        if (!generate && new URL(nodeTarget, pageURL).href !== target)
          fail(`"${specifier}" maps to ${toWebPath(toFile(target))}; package exports give ${nodeTarget}`);
      } else {
        target = new URL(specifier, url).href;
      }
      queue.push(target);
    }
  }

  const files = [...seen].map((url) => toWebPath(toFile(url)));
  const coreDev = files.filter((f) => f.startsWith('./node_modules/@oddkin/core/dist/') && !f.startsWith('./node_modules/@oddkin/core/dist/prod/'));
  const coreProd = files.filter((f) => f.startsWith('./node_modules/@oddkin/core/dist/prod/'));
  if (coreDev.length && coreProd.length) fail(`both development and production builds of @oddkin/core load: ${coreDev.length} + ${coreProd.length} modules`);
  console.log(`  modules: ${seen.size}; bare specifiers: ${Object.keys(implied).length}`);
  if (process.argv.includes('--list')) for (const file of files.sort()) console.log(`  ${file}`);
  if (generate) {
    const sorted = Object.fromEntries(Object.entries(implied).sort(([a], [b]) => a.localeCompare(b)));
    console.log(JSON.stringify({ imports: sorted }, null, 2));
  } else {
    for (const key of Object.keys(imports)) if (!used.has(key)) console.log(`  note: map entry "${key}" is never imported`);
  }
}

console.log(failed ? 'FAILED' : 'OK');
process.exitCode = failed ? 1 : 0;
