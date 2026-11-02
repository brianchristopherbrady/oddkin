// RF-02: the README status check (docs/commercialization/release-foundation-plan.md). The root
// README and each package README must not state a milestone's progress, a version the manifests do
// not have, an element count the metadata does not have, a command no package's `bin` provides, or
// a peer dependency as a dependency. Two rules serve RF-03 and RF-04: a supported-browser version
// must be the floor's, and a claim that the elements are accessible must say that screen readers
// are not yet verified.
//   node scripts/check-readme-status.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
// The packages whose READMEs state an element count, from their generated metadata.
const COUNTED = ['@oddkin/components', '@oddkin/ai'];

/** Versions, commands, peers, element counts, and the browser floor, from the generated facts. */
export function readFacts(root) {
  const packages = {};
  const bins = new Set();
  for (const dir of readdirSync(join(root, 'packages')).sort()) {
    const path = join(root, 'packages', dir, 'package.json');
    if (!existsSync(path)) continue;
    const manifest = json(path);
    const bin =
      typeof manifest.bin === 'string' ? { [manifest.name]: manifest.bin } : (manifest.bin ?? {});
    for (const name of Object.keys(bin)) bins.add(name);
    packages[manifest.name] = {
      dir,
      version: manifest.version,
      peers: Object.keys(manifest.peerDependencies ?? {}),
    };
  }
  const counts = {};
  for (const name of COUNTED) {
    const dir = packages[name]?.dir;
    const metadata = dir && join(root, 'packages', dir, 'oddkin.metadata.json');
    if (metadata && existsSync(metadata))
      counts[name] = Object.keys(json(metadata).components).length;
  }
  return {
    packages,
    bins: [...bins].sort(),
    counts,
    floor: json(join(root, 'docs/compatibility/features.json')).floor,
  };
}

const PRERELEASE = /\b\d+\.\d+\.\d+-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*\b/g;
const PINNED = /@oddkin\/([a-z-]+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)/g;
const VERSIONED = /\bversioned `?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)`?/g;
const COMMAND = /^oddkin(?:-[a-z]+)*$/;
const SHELL = new Set(['sh', 'bash', 'shell', 'console']);
const BROWSER =
  /\b(Chrome|Edge|Firefox|Safari)((?:\s+and\s+(?:Chrome|Edge|Firefox|Safari))*)\s+(\d+(?:\.\d+)?)\b/g;
const ACCESSIBLE =
  /\baccessible,?\s+(?:and\s+)?(?:themed|themeable|custom elements|components|elements|web components)\b|\bWCAG(?:\s+\d+(?:\.\d+)?)?(?:\s+A{1,3})?\s+(?:compliant|conformant|compliance|conformance)\b|\b(?:conforms?|complies)\s+(?:with\s+|to\s+)?WCAG\b/i;

/**
 * The problems of one README. `name` is the package it documents, or undefined for the root
 * README, whose version is the one all packages share.
 */
export function checkReadme(text, facts, name) {
  const problems = [];
  const own = name ? facts.packages[name] : undefined;
  const version = own?.version ?? facts.packages['@oddkin/core']?.version;
  const commands = new Set(facts.bins);
  const report = (line, message) => problems.push({ line, message });
  const checkCommand = (line, command) => {
    if (!commands.has(command))
      report(
        line,
        `names the command \`${command}\`, which no package's \`bin\` provides (${facts.bins.join(', ')})`,
      );
  };
  let fence;
  text.split('\n').forEach((source, index) => {
    const line = index + 1;
    const opening = /^\s*```\s*([a-z]*)/.exec(source);
    if (opening) {
      fence = fence === undefined ? opening[1] : undefined;
      return;
    }
    for (const [found] of source.matchAll(PRERELEASE))
      if (found !== version) report(line, `says ${found}; the manifests are at ${version}`);
    for (const [, pkg, found] of source.matchAll(PINNED)) {
      const actual = facts.packages[`@oddkin/${pkg}`]?.version;
      // A pinned prerelease is reported above.
      if (actual && found !== actual && !found.includes('-'))
        report(line, `pins @oddkin/${pkg}@${found}; its manifest is at ${actual}`);
    }
    for (const sentence of source.split(/(?<=[.;])\s+/)) {
      if (!/\bfloor\b|\bsupported browsers?\b/i.test(sentence)) continue;
      for (const [, first, others, found] of sentence.matchAll(BROWSER))
        for (const browser of [first, ...(others.match(/Chrome|Edge|Firefox|Safari/g) ?? [])]) {
          const floor = facts.floor[browser.toLowerCase()];
          if (floor && found !== floor)
            report(
              line,
              `names ${browser} ${found} as supported; the floor is ${browser} ${floor} (docs/compatibility/features.json)`,
            );
        }
    }
    if (fence !== undefined) {
      const command = /^\s*(?:\$\s+)?(?:npx\s+)?(\S+)/.exec(source)?.[1];
      if (SHELL.has(fence) && command && /^oddkin/.test(command) && COMMAND.test(command))
        checkCommand(line, command);
      return;
    }
    for (const [, found] of source.matchAll(VERSIONED))
      if (found !== version)
        report(line, `says the package is versioned ${found}; its manifest is at ${version}`);
    const milestone = /\bM\d+\s+in progress\b/i.exec(source);
    if (milestone)
      report(
        line,
        `says "${milestone[0]}": a status comes from the manifests and metadata, not from a milestone`,
      );
    for (const [found, pkg, count] of source.matchAll(/`(@oddkin\/[a-z-]+)`\s+(?:has\s+)?(\d+)\b/g))
      if (pkg in facts.counts && Number(count) !== facts.counts[pkg])
        report(line, `says ${found.trim()}; ${pkg}'s metadata lists ${facts.counts[pkg]} elements`);
    for (const [found, count, qualifier] of source.matchAll(
      /\b(\d+)\s+(AI\s+|component\s+)?elements\b/g,
    )) {
      // Outside a counted package's README, an unqualified count is the named-package rule's.
      const pkg = qualifier?.startsWith('AI')
        ? '@oddkin/ai'
        : qualifier
          ? '@oddkin/components'
          : name;
      if (pkg in facts.counts && Number(count) !== facts.counts[pkg])
        report(line, `says "${found}"; ${pkg}'s metadata lists ${facts.counts[pkg]} elements`);
    }
    if (/\b(?:command|commands|command-line|CLI)\b/i.test(source))
      for (const [, code] of source.matchAll(/`([^`]+)`/g))
        if (COMMAND.test(code)) checkCommand(line, code);
    const claim = ACCESSIBLE.exec(source);
    if (claim && !/\bscreen readers (?:are )?not (?:yet )?verified\b/i.test(source))
      report(
        line,
        `says "${claim[0]}" without saying that screen readers are not yet verified (RF-03; docs/support.md#accessibility)`,
      );
    if (!own) return;
    for (const sentence of source.split(/(?<=[.;])\s+/)) {
      if (/\bpeer\b/i.test(sentence)) continue;
      const claimed = [];
      const depends = /\bdepends on\b(.*)$/i.exec(sentence);
      if (depends) claimed.push(...depends[1].matchAll(/@oddkin\/[a-z-]+/g));
      const stated =
        /((?:`@oddkin\/[a-z-]+`[,\s]*(?:and\s+|or\s+)?)+)(?:is|are)\s+(?:a\s+)?(?:runtime\s+)?dependenc(?:y|ies)\b/.exec(
          sentence,
        );
      if (stated) claimed.push(...stated[1].matchAll(/@oddkin\/[a-z-]+/g));
      for (const [pkg] of claimed)
        if (own.peers.includes(pkg))
          report(line, `describes ${pkg} as a dependency; it is a peer dependency of ${name}`);
    }
  });
  return problems;
}

/** Every README the check covers: the root's and each package's, with the package it documents. */
export function readmes(root, facts) {
  const files = [{ path: join(root, 'README.md'), name: undefined }];
  for (const [name, { dir }] of Object.entries(facts.packages)) {
    const path = join(root, 'packages', dir, 'README.md');
    if (existsSync(path)) files.push({ path, name });
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const facts = readFacts(root);
  const unbuilt = COUNTED.filter((name) => !(name in facts.counts));
  if (unbuilt.length) {
    console.error(
      `README status: no metadata for ${unbuilt.join(', ')}; run \`npm run build\` first.`,
    );
    process.exit(1);
  }
  const files = readmes(root, facts);
  let failed = 0;
  for (const { path, name } of files)
    for (const { line, message } of checkReadme(readFileSync(path, 'utf8'), facts, name)) {
      console.error(`${relative(root, path).replace(/\\/g, '/')}:${line}: ${message}`);
      failed++;
    }
  if (failed) {
    console.error(`README status: ${failed} problem(s).`);
    process.exit(1);
  }
  console.log(
    `README status OK: ${files.length} READMEs against the manifests, metadata, bins, and browser floor.`,
  );
}
