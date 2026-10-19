/**
 * Packaged contract text for `@oddkin/core`. `docs/architecture/core-contracts.md` is the only
 * place to edit: ranges marked `<!-- contract:core/<name> "Title" -->` … `<!-- /contract:core/<name> -->`
 * become the sections of `packages/core/CONTRACTS.md`, and `packages/core/contracts.json` maps each
 * stable id to its section anchor. Ranges may nest, and one id may have several ranges.
 */
import { createHash } from 'node:crypto';

export const SOURCE = 'docs/architecture/core-contracts.md';
export const TARGETS = {
  markdown: 'packages/core/CONTRACTS.md',
  index: 'packages/core/contracts.json',
};

const START = /^<!-- contract:([a-z][a-z0-9-]*)\/([a-z0-9-]+) "([^"]+)" -->$/;
const END = /^<!-- \/contract:([a-z][a-z0-9-]*)\/([a-z0-9-]+) -->$/;
const MARKER = /<!-- \/?contract:/;
const HEADING = /^#{1,6} /;

/** Relative links point into this repository, which an installed package does not contain. */
function packagedLine(line) {
  return line
    .replace(/\[([^\]]+)\]\((?!https?:\/\/|mailto:|#)[^)\s]+\)/g, '$1')
    .replace(/ ?\[R\d+(?:, ?R\d+)*\](?!\()/g, '');
}

function section(parts) {
  const blocks = parts.map((lines) => {
    const out = [...lines];
    while (out[0] === '') out.shift();
    while (out.at(-1) === '') out.pop();
    if (HEADING.test(out[0] ?? '')) {
      out.shift();
      while (out[0] === '') out.shift();
    }
    let fenced = false;
    return out
      .map((line) => {
        if (line.startsWith('```')) fenced = !fenced;
        if (fenced || line.startsWith('```')) return line;
        return HEADING.test(line) ? line.replace(/^#{1,6} /, '### ') : packagedLine(line);
      })
      .join('\n');
  });
  return blocks.join('\n\n');
}

/**
 * @param {string} source text of `core-contracts.md`
 * @returns {{ markdown: string, index: string, ids: string[], problems: string[] }}
 */
export function generateContracts(source, scope = 'core') {
  const problems = [];
  const contracts = new Map();
  const open = [];
  source.split(/\r?\n/).forEach((line, i) => {
    const at = `${SOURCE}:${i + 1}`;
    const start = START.exec(line);
    const end = END.exec(line);
    if (start) {
      const [, owner, name, title] = start;
      const id = `contract:${owner}/${name}`;
      if (owner !== scope) problems.push(`${at}: ${id} is not a contract:${scope}/ id`);
      if (open.some((o) => o.id === id)) problems.push(`${at}: ${id} is already open`);
      const entry = contracts.get(id) ?? { name, title, parts: [] };
      if (entry.title !== title)
        problems.push(`${at}: ${id} is titled both "${entry.title}" and "${title}"`);
      contracts.set(id, entry);
      open.push({ id, at, lines: [] });
    } else if (end) {
      const id = `contract:${end[1]}/${end[2]}`;
      const top = open.at(-1);
      if (top?.id !== id) problems.push(`${at}: ${id} closes ${top ? top.id : 'nothing'}`);
      else contracts.get(id).parts.push(open.pop().lines);
    } else if (MARKER.test(line)) {
      problems.push(`${at}: malformed contract marker`);
    } else {
      for (const o of open) o.lines.push(line);
    }
  });
  for (const o of open) problems.push(`${o.at}: ${o.id} is never closed`);

  const sections = [...contracts].map(([id, { name, title, parts }]) => {
    const text = section(parts);
    if (parts.length && !text.trim()) problems.push(`${id} has no text`);
    return { id, name, title, text };
  });
  const markdown = [
    '# `@oddkin/core` contracts',
    '',
    `<!-- Generated from ${SOURCE} by \`npm run contracts\`. Edit the source, not this file. -->`,
    '',
    'What `@oddkin/core` guarantees, for people and tools reading the installed package. Each section has a stable id (`contract:core/<name>`) and an anchor with the same name; `contracts.json` maps ids to anchors.',
    '',
    '| Id | Section |',
    '| --- | --- |',
    ...sections.map((s) => `| \`${s.id}\` | [${s.title}](#${s.name}) |`),
    ...sections.flatMap((s) => [
      '',
      `<a id="${s.name}"></a>`,
      '',
      `## ${s.title}`,
      '',
      `Id: \`${s.id}\``,
      '',
      s.text,
    ]),
    '',
  ].join('\n');
  const index = {
    package: `@oddkin/${scope}`,
    source: SOURCE,
    file: 'CONTRACTS.md',
    contracts: Object.fromEntries(
      sections.map((s) => [
        s.id,
        {
          title: s.title,
          anchor: s.name,
          sha256: createHash('sha256').update(s.text).digest('hex'),
        },
      ]),
    ),
  };
  return {
    markdown,
    index: `${JSON.stringify(index, null, 2)}\n`,
    ids: sections.map((s) => s.id),
    problems,
  };
}
