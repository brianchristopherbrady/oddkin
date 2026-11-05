// RF-19: the error-message audit (docs/commercialization/release-foundation-plan.md). Lists every
// diagnostic code the packages emit with its message, read from their sources, and flags each
// message that neither names what to do nor links to the page that does.
//   node scripts/list-diagnostics.mjs            check docs/diagnostics.md is current; list flags
//   node scripts/list-diagnostics.mjs --write    rewrite docs/diagnostics.md
//   node scripts/list-diagnostics.mjs --strict   also fail while any message is flagged
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// The analyzer's TypeScript (the workspace root may hold a native compiler without the JS API).
const ts = createRequire(join(root, 'packages/analyzer/package.json'))('typescript');

/** A stable diagnostic code: lowercase segments joined by dots (diagnostic.v1's pattern). */
const CODE = /^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*)+$/;
/** Keys of a code-to-message map that name files instead. */
const FILE = /\.(c?m?js|ts|json|css|html|md|txt|svg|png|woff2?)$/;
/** Calls that emit a diagnostic: `out.error(…)`, `report(…)`, `new OddkinError(…)`, `this.#invalid(…)`. */
const EMITTER =
  /^(error|warn|warning|info|report|diagnose|diagnostic|fail|invalid|issue|problem)$|Error$/i;

/**
 * Whether a message names what to do, or links to the page that does: an instruction (an
 * imperative, or `must`, `should`, `needs`, `instead`), or a link.
 */
export function namesAnAction(text) {
  const t = text.replace(/\$\{[^}]*\}|\{[^}]*\}/g, 'x');
  if (/https?:\/\/|\bdocs\/|\.md\b|\bsee\b/i.test(t)) return true;
  if (/\bnothing to do\b|\bno action\b/i.test(t)) return true;
  if (
    /\b(must|should|needs?|requires?|expects?|expected|instead|only accepts?|allows? (at most|at least|only)|cannot|can't|do not|don't)\b/i.test(
      t,
    )
  )
    return true;
  return new RegExp(
    `(^|[.;:!?(]\\s*|\\b(?:then|or|and|to|please)\\s+)(${VERBS.join('|')})\\b`,
    'i',
  ).test(t);
}
const VERBS = [
  'add',
  'allow',
  'apply',
  'ask',
  'assign',
  'avoid',
  'branch',
  'build',
  'call',
  'change',
  'check',
  'choose',
  'close',
  'configure',
  'create',
  'declare',
  'define',
  'delete',
  'drop',
  'edit',
  'enable',
  'export',
  'fix',
  'flatten',
  'give',
  'import',
  'include',
  'install',
  'keep',
  'leave',
  'list',
  'load',
  'make',
  'mark',
  'move',
  'name',
  'omit',
  'open',
  'pass',
  'pick',
  'point',
  'provide',
  'publish',
  'put',
  'raise',
  'read',
  'rebuild',
  'register',
  'reinstall',
  'reload',
  'remove',
  'rename',
  'replace',
  'restart',
  'retry',
  'return',
  'run',
  'select',
  'send',
  'set',
  'spell',
  'split',
  'start',
  'supply',
  'try',
  'turn',
  'update',
  'upgrade',
  'use',
  'wait',
  'wrap',
  'write',
];

const text = (node, sf) => {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(sf).slice(1, -1);
  if (ts.isParenthesizedExpression(node)) return text(node.expression, sf);
  // `DEV ? 'message' : ''`: the development message.
  if (ts.isConditionalExpression(node))
    return [text(node.whenTrue, sf), text(node.whenFalse, sf)].find((s) => s && /\s/.test(s));
  return undefined;
};
const wordy = (s) => s !== undefined && /[A-Za-z]/.test(s) && /\s/.test(s.trim());
const severityOf = (callee) =>
  /warn/i.test(callee) ? 'warning' : /info/i.test(callee) ? 'info' : 'error';
/** The called name: `out.error` → `error`, `this.#invalid` → `invalid`. */
const calleeName = (node) =>
  (ts.isPropertyAccessExpression(node) ? node.name.getText() : node.getText()).replace(/^#/, '');

/** Diagnostics read from one source file. */
export function extractDiagnostics(source, file = 'source.ts') {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out = [];
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const code = (node) => {
    const value =
      node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        ? node.text
        : undefined;
    return value && CODE.test(value) ? value : undefined;
  };
  const visit = (node) => {
    // report(code, …, message, suggestion?), new OddkinError(code, message), out.warn(code, …)
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      node.arguments?.length &&
      EMITTER.test(calleeName(node.expression))
    ) {
      const args = [...node.arguments];
      const at = args.findIndex((a) => code(a));
      if (at >= 0) {
        const texts = args
          .filter((_, i) => i !== at)
          .map((a) => text(a, sf))
          .filter(wordy);
        out.push({
          code: code(args[at]),
          severity: ts.isNewExpression(node) ? 'error' : severityOf(calleeName(node.expression)),
          message: texts[0] ?? '',
          ...(texts[1] ? { suggestion: texts[1] } : {}),
          line: line(node),
        });
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const props = new Map();
      for (const p of node.properties)
        if (ts.isPropertyAssignment(p) && p.name) {
          const key = ts.isStringLiteral(p.name) ? p.name.text : p.name.getText(sf);
          props.set(key, p.initializer);
          // A map of codes to messages: { 'ai.attachment.size': '{name} is larger than {limit}.' }
          const message = text(p.initializer, sf);
          if (code(p.name) && !FILE.test(p.name.text) && wordy(message))
            out.push({ code: p.name.text, severity: '', message, line: line(p) });
        }
      const c = code(props.get('code'));
      const message = text(props.get('message'), sf);
      if (c) {
        const severity = text(props.get('severity'), sf);
        const suggestion = text(props.get('suggestion'), sf);
        out.push({
          code: c,
          severity: ['error', 'warning', 'info'].includes(severity) ? severity : '',
          message: wordy(message) ? message : '',
          ...(wordy(suggestion) ? { suggestion } : {}),
          line: line(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Every package's diagnostics, by package, from `packages/<dir>/src` (no tests or examples). */
export function listDiagnostics(base = root) {
  const list = [];
  for (const dir of readdirSync(join(base, 'packages')).sort()) {
    const src = join(base, 'packages', dir, 'src');
    if (!existsSync(src)) continue;
    const walk = (path) => {
      for (const name of readdirSync(path).sort()) {
        const full = join(path, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(m?ts)$/.test(name) && !/\.d\.ts$|\.test\.ts$|\.examples\.ts$/.test(name))
          for (const d of extractDiagnostics(readFileSync(full, 'utf8'), full))
            list.push({
              package: dir,
              file: relative(base, full).replace(/\\/g, '/'),
              ...d,
              // A message computed at run time is reviewed by hand (null).
              action: d.message ? namesAnAction(`${d.message} ${d.suggestion ?? ''}`) : null,
            });
      }
    };
    walk(src);
  }
  return list;
}

const cell = (s) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** The Markdown list: per package, each code with its message and whether it names an action. */
export function renderDiagnostics(list) {
  const flagged = list.filter((d) => d.action === false).length;
  const computed = list.filter((d) => d.action === null).length;
  const lines = [
    '# Diagnostic codes and their messages',
    '',
    "<!-- Generated by `node scripts/list-diagnostics.mjs --write` from the packages' sources. Do not edit. -->",
    '',
    `RF-19's audit ([release-foundation-plan.md](./commercialization/release-foundation-plan.md)): every code a package emits, with its message (\`{…}\` marks a value filled in at run time). A message should name what to do, or link to the page that does; **no** marks one that does neither, and *review* one whose message is computed at run time. ${list.length} messages, ${new Set(list.map((d) => d.code)).size} codes; ${flagged} flagged, ${computed} to review.`,
    '',
  ];
  for (const pkg of [...new Set(list.map((d) => d.package))]) {
    const rows = list.filter((d) => d.package === pkg);
    lines.push(
      `## @oddkin/${pkg}`,
      '',
      '| Code | Severity | Message | Names what to do | Where |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const d of rows) {
      const message = d.message
        ? cell(
            `${d.message}${d.suggestion ? ` (suggestion: ${d.suggestion})` : ''}`.replace(
              /\$\{([^}]*)\}/g,
              '{$1}',
            ),
          )
        : '*(computed at run time)*';
      const verdict = d.action === null ? '*review*' : d.action ? 'yes' : '**no**';
      lines.push(
        `| \`${d.code}\` | ${d.severity || '—'} | ${message} | ${verdict} | \`${d.file}:${d.line}\` |`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = join(root, 'docs/diagnostics.md');
  const list = listDiagnostics();
  const rendered = renderDiagnostics(list);
  const flagged = list.filter((d) => d.action === false);
  if (process.argv.includes('--write')) {
    writeFileSync(target, rendered);
    console.log(`Wrote docs/diagnostics.md: ${list.length} messages, ${flagged.length} flagged.`);
  } else {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== rendered) {
      console.error(
        'docs/diagnostics.md is out of date: run `node scripts/list-diagnostics.mjs --write`.',
      );
      process.exit(1);
    }
    for (const d of flagged)
      console.log(`${d.file}:${d.line}: ${d.code}: names no action: ${d.message}`);
    if (process.argv.includes('--strict') && flagged.length) process.exit(1);
    console.log(`Diagnostics: ${list.length} messages, ${flagged.length} flagged.`);
  }
}
