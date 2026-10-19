/**
 * Colocated `*.examples.ts` files (ADR 0021): find `defineExamples('tag', { name: { … } })`
 * calls by parsing, never by executing, and record each example's name, fixture presence, and
 * preview roles. Example files are development-only sources outside the package build, so they
 * are discovered on disk rather than taken from the program.
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
  readonly location: SourceLocation;
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
          examples.push({
            component,
            name,
            file,
            hasFixture,
            ...(previewRoles ? { previewRoles } : {}),
            ...(incorrect ? { incorrect } : {}),
            ...(uses.length ? { uses } : {}),
            ...(texts.length ? { texts } : {}),
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
