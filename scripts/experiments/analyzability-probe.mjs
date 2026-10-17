// Experiment (M3): can `MoteElement.with({...})` declarations be analyzed statically,
// without executing modules, using TypeScript 7's (unstable) API?
// Usage: node scripts/experiments/analyzability-probe.mjs [path/to/tsconfig.json]
// Prints JSON: one entry per element class with its properties, as source-declared
// (prop kind, attribute, reflect, default, description) and checker-resolved types.
import { resolve } from 'node:path';
import { API } from 'typescript/unstable/sync';
import {
  isCallExpression,
  isClassDeclaration,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  SyntaxKind,
} from 'typescript/unstable/ast';

const config = resolve(process.argv[2] ?? 'examples/core-counter/tsconfig.json');
const api = new API({ cwd: process.cwd() });

function literal(node, diagnostics, where) {
  switch (node.kind) {
    case SyntaxKind.StringLiteral:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
      return node.text;
    case SyntaxKind.NumericLiteral:
      return Number(node.text);
    case SyntaxKind.TrueKeyword:
      return true;
    case SyntaxKind.FalseKeyword:
      return false;
    case SyntaxKind.ArrayLiteralExpression:
      return node.elements.map((e) => literal(e, diagnostics, where));
    case SyntaxKind.ArrowFunction:
      return { factory: true };
    default:
      diagnostics.push({
        code: 'analyzer.dynamic.value',
        where,
        kind: SyntaxKind[node.kind] ?? node.kind,
      });
      return { dynamic: true };
  }
}

function readOptions(node, diagnostics, where) {
  const out = {};
  if (!node) return out;
  if (!isObjectLiteralExpression(node)) {
    diagnostics.push({ code: 'analyzer.dynamic.options', where });
    return out;
  }
  for (const p of node.properties) {
    if (isPropertyAssignment(p) && isIdentifier(p.name))
      out[p.name.text] = literal(p.initializer, diagnostics, where);
    else diagnostics.push({ code: 'analyzer.dynamic.option', where });
  }
  return out;
}

function kebab(name) {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

try {
  const snapshot = api.updateSnapshot({ openProjects: [config] });
  const project = snapshot.getProjects()[0];
  const { program, checker } = project;
  const results = [];
  for (const fileName of program.getSourceFileNames()) {
    if (program.isSourceFileDefaultLibrary?.(program.getSourceFile(fileName))) continue;
    if (fileName.includes('/node_modules/') || fileName.includes('/packages/')) continue;
    const sourceFile = program.getSourceFile(fileName);
    const visit = (node) => {
      if (isClassDeclaration(node) && node.name) {
        const heritage = node.heritageClauses?.[0]?.types?.[0]?.expression;
        if (
          heritage &&
          isCallExpression(heritage) &&
          isPropertyAccessExpression(heritage.expression) &&
          heritage.expression.name.text === 'with'
        ) {
          const diagnostics = [];
          const definitions = heritage.arguments[0];
          const properties = [];
          const classType = checker.getTypeAtLocation(node.name);
          const members = new Map(checker.getPropertiesOfType(classType).map((s) => [s.name, s]));
          if (!definitions || !isObjectLiteralExpression(definitions)) {
            diagnostics.push({ code: 'analyzer.dynamic.definitions', where: node.name.text });
          } else {
            for (const p of definitions.properties) {
              if (!isPropertyAssignment(p) || !isIdentifier(p.name)) {
                diagnostics.push({
                  code: 'analyzer.dynamic.property',
                  where: node.name.text,
                  kind: SyntaxKind[p.kind],
                });
                continue;
              }
              const name = p.name.text;
              const call = p.initializer;
              const callee =
                isCallExpression(call) && isPropertyAccessExpression(call.expression)
                  ? call.expression
                  : undefined;
              if (
                !callee ||
                !isIdentifier(callee.expression) ||
                callee.expression.text !== 'prop'
              ) {
                diagnostics.push({
                  code: 'analyzer.dynamic.definition',
                  where: `${node.name.text}.${name}`,
                });
                continue;
              }
              const kind = callee.name.text;
              const args = call.arguments;
              const where = `${node.name.text}.${name}`;
              const values = kind === 'enum' ? literal(args[0], diagnostics, where) : undefined;
              const options = readOptions(kind === 'enum' ? args[1] : args[0], diagnostics, where);
              const symbol = members.get(name);
              const type = symbol
                ? checker.typeToString(checker.getTypeOfSymbol(symbol))
                : undefined;
              const attribute =
                options.attribute === false || kind === 'object' || kind === 'array'
                  ? null
                  : (options.attribute ?? kebab(name));
              properties.push({
                name,
                kind,
                type,
                attribute,
                reflect: options.reflect === true,
                ...(values ? { values } : {}),
                ...(options.default !== undefined ? { default: options.default } : {}),
                ...(options.description ? { description: options.description } : {}),
              });
            }
          }
          results.push({
            class: node.name.text,
            file: fileName.slice(fileName.indexOf('examples/')),
            properties,
            diagnostics,
          });
        }
      }
      node.forEachChild(visit);
    };
    sourceFile.forEachChild(visit);
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  api.close();
}
