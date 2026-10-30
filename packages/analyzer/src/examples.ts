/**
 * Colocated `*.examples.ts` files (ADR 0021): find `defineExamples('tag', { name: { … } })`
 * calls by parsing, never by executing, and record each example's name, fixture presence, and
 * preview roles. Example files are development-only sources outside the package build, so they
 * are discovered on disk rather than taken from the program. An example whose values the source
 * spells out (literals, or module-level constants of literals) also records them, as
 * `toExamplesJSON()` serializes them, so a published package carries them without its sources.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import type { AnalyzerDiagnostic, SourceLocation } from './extract.js';
import type { AuthoredText } from './references.js';

export interface ExampleInfo {
  readonly component: string;
  readonly name: string;
  readonly file: string;
  readonly hasFixture: boolean;
  readonly previewRoles?: readonly string[];
  /** A common mistake: the diagnostic it demonstrates and the correct example to use instead. */
  readonly incorrect?: { readonly diagnostic: string; readonly correct: string };
  /** Other custom elements its fixture renders, read from literal markup and `createElement()`. */
  readonly uses?: readonly string[];
  /** Literal label, guidance, and mistake explanation, for the authored-reference check. */
  readonly texts?: readonly AuthoredText[];
  /**
   * The example's values as `toExamplesJSON()` serializes them (label, props, attributes, slots,
   * preset, guidance, and `hasFixture` for a fixture), when every one is spelled out in the source.
   */
  readonly definition?: Readonly<Record<string, JsonValue>>;
  readonly location: SourceLocation;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** A value the source does not spell out. */
const COMPUTED = Symbol('computed');
type Evaluated = JsonValue | undefined | typeof COMPUTED;

function propertyKey(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return String(Number(name.text));
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression))
    return name.expression.text;
  return undefined;
}

/** The module's top-level `const` bindings with an initializer, by name. */
function moduleConstants(source: ts.SourceFile): Map<string, ts.Expression> {
  const found = new Map<string, ts.Expression>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name) && declaration.initializer)
        found.set(declaration.name.text, declaration.initializer);
  }
  return found;
}

/**
 * `node`'s value after `JSON.parse(JSON.stringify(value))`, when the source spells it out:
 * literals, arrays, objects, template literals, and `JSON.stringify()` of those, directly or through
 * a module-level constant. `undefined` is dropped from objects and is `null` in arrays, as in JSON.
 */
function evaluate(
  node: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
  seen: ReadonlySet<string> = new Set(),
): Evaluated {
  const at = (child: ts.Expression) => evaluate(child, constants, seen);
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  )
    return at(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node)) {
    if (node.text === 'undefined') return undefined;
    const initializer = constants.get(node.text);
    if (!initializer || seen.has(node.text)) return COMPUTED;
    return evaluate(initializer, constants, new Set([...seen, node.text]));
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      const value = at(span.expression);
      if (value === COMPUTED) return COMPUTED;
      text += `${String(value)}${span.literal.text}`;
    }
    return text;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const items: JsonValue[] = [];
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = at(element.expression);
        if (!Array.isArray(spread)) return COMPUTED;
        items.push(...spread);
      } else if (ts.isOmittedExpression(element)) items.push(null);
      else {
        const value = at(element);
        if (value === COMPUTED) return COMPUTED;
        items.push(value ?? null);
      }
    }
    return items;
  }
  if (ts.isObjectLiteralExpression(node)) {
    // A Map, then own properties: a key such as __proto__ stays an ordinary property, as in JSON.
    const entries = new Map<string, JsonValue>();
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = at(property.expression);
        if (typeof spread !== 'object' || spread === null || Array.isArray(spread)) return COMPUTED;
        for (const [key, value] of Object.entries(spread)) entries.set(key, value);
        continue;
      }
      const key = property.name && propertyKey(property.name);
      const value =
        key === undefined
          ? COMPUTED
          : ts.isPropertyAssignment(property)
            ? at(property.initializer)
            : ts.isShorthandPropertyAssignment(property)
              ? at(property.name)
              : COMPUTED;
      if (value === COMPUTED) return COMPUTED;
      if (value === undefined) entries.delete(key as string);
      else entries.set(key as string, value);
    }
    return Object.fromEntries(entries);
  }
  if (
    ts.isCallExpression(node) &&
    node.arguments.length === 1 &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'JSON' &&
    node.expression.name.text === 'stringify'
  ) {
    const value = at(node.arguments[0] as ts.Expression);
    return value === COMPUTED || value === undefined ? COMPUTED : JSON.stringify(value);
  }
  return COMPUTED;
}

/** An example's values as `toExamplesJSON()` gives them, or `undefined` when one is computed. */
function exampleDefinition(
  example: ts.ObjectLiteralExpression,
  constants: ReadonlyMap<string, ts.Expression>,
): Record<string, JsonValue> | undefined {
  const entries = new Map<string, JsonValue>();
  let fixture = false;
  for (const field of example.properties) {
    const key = field.name && propertyKey(field.name);
    if (key === 'fixture') {
      fixture = true;
      continue;
    }
    const value =
      key === undefined
        ? COMPUTED
        : ts.isPropertyAssignment(field)
          ? evaluate(field.initializer, constants)
          : ts.isShorthandPropertyAssignment(field)
            ? evaluate(field.name, constants)
            : COMPUTED;
    if (value === COMPUTED) return undefined;
    if (value !== undefined) entries.set(key as string, value);
  }
  if (fixture) entries.set('hasFixture', true);
  return Object.fromEntries(entries);
}

const EXAMPLE_FILE = /\.examples\.(m?ts|m?js)$/;
const SKIP = new Set(['node_modules', 'dist']);

/** Example files under `dir`, sorted. */
export function findExampleFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(path);
      } else if (EXAMPLE_FILE.test(entry.name)) out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

const text = (node: ts.Node | undefined): string | undefined =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
const keyOf = (name: ts.PropertyName): string | undefined =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;

const TAG = /<([a-z][a-z0-9]*-[a-z0-9-]*)[\s>/]/g;
/** Custom-element tags written literally under `node`: markup in strings and templates, `createElement('x-y')`. */
function literalTags(node: ts.Node): Set<string> {
  const tags = new Set<string>();
  const visit = (child: ts.Node): void => {
    if (
      ts.isStringLiteral(child) ||
      ts.isNoSubstitutionTemplateLiteral(child) ||
      ts.isTemplateHead(child) ||
      ts.isTemplateMiddle(child) ||
      ts.isTemplateTail(child)
    ) {
      for (const match of `${child.text} `.matchAll(TAG)) tags.add(match[1] as string);
      if (
        ts.isStringLiteral(child) &&
        /^[a-z][a-z0-9]*-[a-z0-9-]*$/.test(child.text) &&
        ts.isCallExpression(child.parent) &&
        ts.isPropertyAccessExpression(child.parent.expression) &&
        child.parent.expression.name.text === 'createElement'
      )
        tags.add(child.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return tags;
}

export function extractExamples(
  files: readonly string[],
  root: string,
): { examples: ExampleInfo[]; diagnostics: AnalyzerDiagnostic[] } {
  const examples: ExampleInfo[] = [];
  const diagnostics: AnalyzerDiagnostic[] = [];
  for (const path of files) {
    const file = relative(root, path).split(sep).join('/');
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const at = (node: ts.Node): SourceLocation => {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
      return { file, line: line + 1, column: character + 1 };
    };
    const dynamic = (node: ts.Node, message: string) =>
      diagnostics.push({
        code: 'analyzer.examples.dynamic',
        severity: 'warning',
        message,
        source: at(node),
        suggestion:
          'Use a string literal tag and an object literal of examples with literal names.',
      });

    // Local names bound to `defineExamples` from the Workbench examples entry.
    const names = new Set<string>();
    const constants = moduleConstants(source);
    for (const statement of source.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        text(statement.moduleSpecifier) === '@oddkin/workbench/examples' &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        for (const element of statement.importClause.namedBindings.elements)
          if ((element.propertyName ?? element.name).text === 'defineExamples')
            names.add(element.name.text);
      }
    }

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        names.has(node.expression.text)
      ) {
        const [tagArg, setArg] = node.arguments;
        const component = text(tagArg);
        if (!component || !setArg || !ts.isObjectLiteralExpression(setArg)) {
          dynamic(node, 'defineExamples() needs a literal tag and an object literal of examples.');
          return;
        }
        for (const property of setArg.properties) {
          const name = property.name && keyOf(property.name);
          if (
            !ts.isPropertyAssignment(property) ||
            !name ||
            !ts.isObjectLiteralExpression(property.initializer)
          ) {
            dynamic(property, `An example of <${component}> is not a literal entry.`);
            continue;
          }
          let hasFixture = false;
          let previewRoles: string[] | undefined;
          let incorrect: ExampleInfo['incorrect'] | null | undefined;
          const texts: AuthoredText[] = [];
          const authored = (node: ts.Expression | undefined, field: string) => {
            const value = node && text(node);
            if (node && value)
              texts.push({
                text: value,
                subject: component,
                at: `example:${component}/${name} ${field}`,
                source: at(node),
              });
          };
          for (const field of property.initializer.properties) {
            const key = field.name && keyOf(field.name);
            if (key === 'fixture') hasFixture = true;
            if ((key === 'label' || key === 'guidance') && ts.isPropertyAssignment(field))
              authored(field.initializer, key);
            if (key === 'incorrect') {
              // Read literally: an example that cannot be shown to be a mistake is left out
              // rather than listed as a usable one.
              const value = ts.isPropertyAssignment(field) ? field.initializer : undefined;
              const read = (name: string) =>
                value && ts.isObjectLiteralExpression(value)
                  ? value.properties
                      .filter(ts.isPropertyAssignment)
                      .map((p) => (keyOf(p.name) === name ? text(p.initializer) : undefined))
                      .find((v) => v !== undefined)
                  : undefined;
              const diagnostic = read('diagnostic');
              const correct = read('correct');
              if (value && ts.isObjectLiteralExpression(value))
                for (const p of value.properties)
                  if (ts.isPropertyAssignment(p) && keyOf(p.name) === 'explanation')
                    authored(p.initializer, 'explanation');
              incorrect = diagnostic && correct ? { diagnostic, correct } : null;
              if (!incorrect)
                dynamic(
                  field,
                  `Incorrect example "${name}" of <${component}> needs literal diagnostic and correct names; it is left out.`,
                );
            }
            if (key !== 'previewRoles') continue;
            const value = ts.isPropertyAssignment(field) ? field.initializer : undefined;
            const roles =
              value && ts.isArrayLiteralExpression(value) ? value.elements.map(text) : undefined;
            if (!roles || roles.some((role) => role === undefined))
              dynamic(
                field,
                `Preview roles of example "${name}" of <${component}> are not literal.`,
              );
            else previewRoles = roles as string[];
          }
          if (incorrect === null) continue;
          const uses = [...literalTags(property.initializer)]
            .filter((tag) => tag !== component)
            .sort();
          const definition = exampleDefinition(property.initializer, constants);
          examples.push({
            component,
            name,
            file,
            hasFixture,
            ...(previewRoles ? { previewRoles } : {}),
            ...(incorrect ? { incorrect } : {}),
            ...(uses.length ? { uses } : {}),
            ...(texts.length ? { texts } : {}),
            ...(definition ? { definition } : {}),
            location: at(property),
          });
        }
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { examples, diagnostics };
}
