// Token register check: the default theme's tokens are a reviewed set, each role says what it is
// for, shipped CSS uses them, and no other `--odd-*` name floats around.
//
// 1. Register: every token belongs to a reviewed family in scripts/token-register.json. A token
//    outside every family, or a family with no token, fails: new tokens are reviewed, not found.
// 2. Purpose: a role token (semantic, layout, or component tier) whose value is exactly one other
//    token must say why it is its own token (a description in preset.ts), unless the theme file
//    sets it (an override is the theme's stated choice) or it is a `type.*` text-style part.
// 3. Use: every role token is read by shipped CSS, or the register lists it as offered to
//    consumers, with the reason.
// 4. Names: every `--odd-*` name shipped CSS reads is a token, a documented CSS property of an
//    element (metadata `customization.variables`), or a layout recipe knob (layout-recipes.md).
// 5. Misuse: a token's kind matches the property it sets (a colour on a colour property, a
//    radius on a radius, a shadow on box-shadow, motion on transitions, type on font
//    properties, and only focus tokens on outline-offset), when the var() is the whole value.
//
// Usage: node scripts/check-tokens.mjs (after `npm run build`). Contract: theming-and-styling.md §10.8.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as csstree from 'css-tree';
import { cssSources } from './compat/check-css.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const ROLE_TIERS = new Set(['semantic', 'layout', 'component']);

export function loadRegister() {
  return JSON.parse(read('scripts/token-register.json'));
}

export function loadInspection() {
  const path = 'packages/tokens/dist/inspect/default.inspect.json';
  if (!existsSync(join(root, path))) throw new Error(`${path} is missing: run npm run build first`);
  return JSON.parse(read(path));
}

/** Documented `--odd-*` names: element CSS properties and layout recipe knobs. */
export function loadDocumented() {
  const names = new Set();
  for (const pkg of ['components', 'ai'])
    for (const m of read(`packages/${pkg}/oddkin.metadata.json`).matchAll(
      /"cssprop:[a-z0-9-]+#(--odd-[a-z0-9-]+)"/g,
    ))
      names.add(m[1]);
  for (const doc of [
    'docs/architecture/layout-recipes.md',
    'docs/architecture/component-contracts.md',
  ])
    for (const m of read(doc).matchAll(/`(--odd-[a-z0-9-]+)`/g)) names.add(m[1]);
  return names;
}

const single = (definition) =>
  typeof definition === 'string' ? /^\{([^}]+)\}$/.exec(definition)?.[1] : undefined;

/** Families of the register: a name matches its first family, by exact name or `prefix.*`. */
export function familyOf(register, name) {
  return register.families.find((family) =>
    family.tokens.some((pattern) =>
      pattern.endsWith('.*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
    ),
  );
}

/** Tokens read by CSS, plus every token their values name (card.padding reads layout.inset). */
function withReferences(tokens, read) {
  const byName = new Map(tokens.map((token) => [token.name, token]));
  const used = new Set(read);
  const queue = [...read];
  while (queue.length) {
    const definition = byName.get(queue.pop())?.definition;
    const texts = typeof definition === 'object' ? Object.values(definition) : [definition];
    for (const text of texts)
      for (const m of String(text ?? '').matchAll(/\{([^}]+)\}/g))
        if (!used.has(m[1])) {
          used.add(m[1]);
          queue.push(m[1]);
        }
  }
  return used;
}

/** Checks 1 to 3 over the theme's tokens; `read` is the set of tokens shipped CSS reads. */
export function checkRegister(register, tokens, read) {
  const used = withReferences(tokens, read);
  const problems = [];
  const counts = new Map(register.families.map((family) => [family.name, 0]));
  for (const token of tokens) {
    const family = familyOf(register, token.name);
    if (!family) {
      problems.push(
        `${token.name}: not in the token register (scripts/token-register.json); add it to a family with its purpose, or remove the token`,
      );
      continue;
    }
    counts.set(family.name, (counts.get(family.name) ?? 0) + 1);
    const target = single(token.definition);
    if (
      ROLE_TIERS.has(token.category) &&
      target &&
      !token.description &&
      token.origin !== 'overridden' &&
      !token.name.startsWith('type.')
    )
      problems.push(
        `${token.name}: a role that only names ${target}; give it a description (what it applies to, and why it is its own token) in preset.ts, or use ${target}`,
      );
    if (ROLE_TIERS.has(token.category) && !used.has(token.name) && !register.offered[token.name])
      problems.push(
        `${token.name}: no shipped CSS reads it; use it, list it under "offered" with the reason, or remove it`,
      );
  }
  for (const [name, count] of counts)
    if (count === 0) problems.push(`register family "${name}" matches no token; remove it`);
  for (const name of Object.keys(register.offered))
    if (!tokens.some((token) => token.name === name))
      problems.push(`offered "${name}" is not a token; remove it from the register`);
    else if (used.has(name))
      problems.push(`offered "${name}" is now read by shipped CSS; remove it from "offered"`);
  return problems;
}

const KIND = [
  [
    'color',
    (t) => t.type === 'color',
    /^(color|background(-color)?|border(-[a-z]+)*-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color|scrollbar-color)$/,
  ],
  [
    'radius',
    (t) => /^(radius\.|control\.radius$|card\.radius$)/.test(t.name),
    /^border(-[a-z]+)*-radius$/,
  ],
  ['shadow', (t) => t.type === 'shadow', /^box-shadow$/],
  ['stacking', (t) => t.name.startsWith('z-index.'), /^z-index$/],
  [
    'motion',
    (t) => t.type === 'duration' || t.type === 'cubicBezier',
    /^(transition|animation)(-[a-z-]+)?$/,
  ],
  ['font family', (t) => t.type === 'fontFamily', /^font-family$/],
  ['font weight', (t) => t.type === 'fontWeight', /^font-weight$/],
  [
    'line height',
    (t) => /^(line-height\.|type\.[a-z]+\.line-height$)/.test(t.name),
    /^line-height$/,
  ],
  [
    'letter spacing',
    (t) => /^(letter-spacing\.|type\.[a-z]+\.letter-spacing$)/.test(t.name),
    /^letter-spacing$/,
  ],
];

/** Checks 4 and 5 over one stylesheet's text. */
export function checkCss(text, { file, tokensByVariable, documented }) {
  const problems = [];
  const used = new Set();
  const ast = csstree.parse(text, { parseValue: true, parseCustomProperty: true });
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(declaration) {
      const property = declaration.property;
      csstree.walk(declaration.value, {
        visit: 'Function',
        enter(fn) {
          const first = fn.name === 'var' ? fn.children.first : null;
          if (first?.type !== 'Identifier' || !first.name.startsWith('--odd-')) return;
          const token = tokensByVariable.get(first.name);
          if (!token) {
            if (!documented.has(first.name))
              problems.push(
                `${file}: ${property} reads ${first.name}, which is not a token or a documented CSS property`,
              );
            return;
          }
          used.add(token.name);
          if (property.startsWith('--')) return;
          const whole =
            declaration.value.type === 'Value' &&
            declaration.value.children.size === 1 &&
            declaration.value.children.first === fn;
          if (!whole) return;
          if (property === 'outline-offset' && !token.name.startsWith('focus.'))
            problems.push(`${file}: outline-offset uses ${token.name}; use focus.offset`);
          const kind = KIND.find(([, matches]) => matches(token));
          if (kind && !kind[2].test(property))
            problems.push(`${file}: ${property} uses ${token.name}, a ${kind[0]} token`);
        },
      });
    },
  });
  return { problems, used };
}

export async function run() {
  const register = loadRegister();
  const { tokens } = loadInspection();
  const tokensByVariable = new Map(tokens.map((token) => [token.cssVariable, token]));
  const documented = loadDocumented();
  const problems = [];
  const read = new Set();
  const sources = (await cssSources()).filter(
    (source) => source.shipped && !source.file.startsWith('packages/tokens/'),
  );
  for (const source of sources) {
    const result = checkCss(source.text, { file: source.file, tokensByVariable, documented });
    problems.push(...result.problems);
    for (const name of result.used) read.add(name);
  }
  problems.push(...checkRegister(register, tokens, read));
  return { problems, tokens: tokens.length, sheets: sources.length, used: read.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { problems, tokens, sheets, used } = await run();
  for (const problem of problems) console.error(problem);
  console.log(
    `Token register: ${tokens} tokens, ${used} read by ${sheets} shipped stylesheets, ${problems.length} problem(s).`,
  );
  process.exitCode = problems.length ? 1 : 0;
}
