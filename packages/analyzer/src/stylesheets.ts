/**
 * Document stylesheets a package publishes (opt-in CSS such as a reset, page layout classes, and
 * recipes for native elements: component-contracts.md §2.1), as metadata records an agent or a
 * documentation site can use without reading the CSS: what to import, its cascade layer, the
 * classes it defines, the theme tokens it reads, and the variables an author may set.
 */

import ts from 'typescript';

/** One stylesheet, as the package builds it. */
export interface StylesheetInput {
  /** File name without `.css`, e.g. `typography`. */
  readonly name: string;
  /** The package export that loads it, e.g. `@oddkin/components/css/typography.css`. */
  readonly import: string;
  /** The cascade layer its rules are in, e.g. `odd.components`. */
  readonly layer: string;
  /** Its rules (without the layer wrapper). */
  readonly css: string;
  /** What it is for, from its source documentation. */
  readonly description?: string;
  /** Where it is defined, relative to the package root. */
  readonly source?: { readonly file: string; readonly line: number };
}

/** The published record: `stylesheets["stylesheet:<name>"]`. */
export interface StylesheetRecord {
  readonly name: string;
  readonly import: string;
  readonly layer: string;
  readonly description?: string;
  /** Classes it defines that carry the library prefix, without the dot. */
  readonly classes: readonly string[];
  /** Theme tokens it reads, by token name. */
  readonly tokens: readonly string[];
  /** Prefixed custom properties it reads that are not theme tokens: hooks an author may set. */
  readonly variables: readonly string[];
  readonly source?: { readonly file: string; readonly line: number };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Records for `inputs`. `prefix` is the library's class and variable prefix (`odd-`); `tokens`
 * maps a theme token's CSS variable to its name.
 */
export function stylesheetRecords(
  inputs: readonly StylesheetInput[],
  prefix: string,
  tokens: ReadonlyMap<string, string> = new Map(),
): Record<string, StylesheetRecord> {
  const classPattern = new RegExp(`\\.(${escape(prefix)}[A-Za-z0-9_-]+)`, 'g');
  const variablePattern = new RegExp(`var\\(\\s*(--${escape(prefix)}[A-Za-z0-9_-]+)`, 'g');
  const unique = (values: Iterable<string>) => [...new Set(values)].sort();
  const records = [...inputs]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((input): [string, StylesheetRecord] => {
      // Comments can quote selectors that the sheet does not define.
      const css = input.css.replace(/\/\*[\s\S]*?\*\//g, '');
      const read = unique([...css.matchAll(variablePattern)].map((m) => m[1] as string));
      return [
        `stylesheet:${input.name}`,
        {
          name: input.name,
          import: input.import,
          layer: input.layer,
          ...(input.description ? { description: input.description } : {}),
          classes: unique([...css.matchAll(classPattern)].map((m) => m[1] as string)),
          tokens: unique(read.flatMap((v) => (tokens.has(v) ? [tokens.get(v) as string] : []))),
          variables: read.filter((v) => !tokens.has(v)),
          ...(input.source ? { source: input.source } : {}),
        },
      ];
    });
  return Object.fromEntries(records);
}

/**
 * The documentation of each stylesheet in a module that exports a `mapName` object from file name
 * to stylesheet constant (`{ reset, 'avatar-group': avatarGroup }`): each key's JSDoc summary
 * and the line of its constant.
 */
export function stylesheetDocs(
  text: string,
  file: string,
  mapName = 'documentStylesheets',
): Map<string, { readonly description?: string; readonly line: number }> {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const declarations = new Map<string, ts.VariableDeclaration>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations)
      if (ts.isIdentifier(d.name)) declarations.set(d.name.text, d);
  }
  let literal = declarations.get(mapName)?.initializer;
  while (literal && (ts.isAsExpression(literal) || ts.isSatisfiesExpression(literal)))
    literal = literal.expression;
  const docs = new Map<string, { readonly description?: string; readonly line: number }>();
  if (!literal || !ts.isObjectLiteralExpression(literal)) return docs;
  for (const p of literal.properties) {
    const key =
      p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : '';
    const constant = ts.isShorthandPropertyAssignment(p)
      ? p.name.text
      : ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer)
        ? p.initializer.text
        : '';
    const d = declarations.get(constant);
    if (!key || !d) continue;
    const description = ts
      .getJSDocCommentsAndTags(d)
      .map((doc) => (ts.isJSDoc(doc) ? (ts.getTextOfJSDocComment(doc.comment) ?? '') : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    docs.set(key, {
      ...(description ? { description } : {}),
      line: source.getLineAndCharacterOfPosition(d.parent.parent.getStart()).line + 1,
    });
  }
  return docs;
}
