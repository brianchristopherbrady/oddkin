/**
 * A standard Custom Elements Manifest from a library's published declarations (`.d.ts`), for a
 * library that publishes types but no manifest and whose source this analyzer does not read
 * (metadata-and-analyzer.md §8). It takes only what declarations state: the tags in
 * `HTMLElementTagNameMap`, each element class's own public members with their declared types,
 * and the JSDoc tags declarations keep (`@slot`, `@csspart`, `@cssprop`, `@cssstate`, `@fires`,
 * `@attr`). What they cannot state, attributes without `@attr`, defaults, and the module that
 * registers each tag, stays out of the manifest and is reported. Nothing is executed.
 */
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { sortDiagnostics } from './emit.js';
import type { AnalyzerDiagnostic } from './extract.js';

export interface DeclarationsAnalyzeOptions {
  /** The declaration files to read, e.g. the package's `types` entry. */
  readonly declarations: readonly string[];
  /** The package root; module paths are relative to it (default: the first file's directory). */
  readonly root?: string;
}

interface Text {
  readonly text: string;
}
interface Named {
  readonly name: string;
  readonly description?: string;
}
type Member =
  | (Named & { readonly kind: 'field'; readonly type?: Text; readonly readonly?: true })
  | (Named & {
      readonly kind: 'method';
      readonly parameters?: readonly (Named & { readonly type?: Text; readonly optional?: true })[];
      readonly return?: { readonly type: Text };
    });
export interface DeclaredElement extends Named {
  readonly kind: 'class';
  readonly tagName: string;
  readonly customElement: true;
  readonly superclass?: { readonly name: string };
  readonly members?: readonly Member[];
  readonly attributes?: readonly (Named & { readonly type?: Text })[];
  readonly events?: readonly (Named & { readonly type?: Text })[];
  readonly slots?: readonly Named[];
  readonly cssParts?: readonly Named[];
  readonly cssProperties?: readonly Named[];
  readonly cssStates?: readonly Named[];
}
export interface DeclarationsManifest {
  readonly schemaVersion: '2.1.0';
  readonly modules: readonly {
    readonly kind: 'javascript-module';
    readonly path: string;
    readonly declarations: readonly DeclaredElement[];
    readonly exports?: readonly {
      readonly kind: 'js';
      readonly name: string;
      readonly declaration: { readonly name: string; readonly module: string };
    }[];
  }[];
}
export interface DeclarationsAnalyzeResult {
  readonly manifest: DeclarationsManifest;
  readonly diagnostics: readonly AnalyzerDiagnostic[];
}

/** `{type} name - description`, as CEM's JSDoc tags write it. */
function tagText(text: string): { name: string; type?: string; description?: string } {
  let rest = text.trim();
  let type: string | undefined;
  if (rest.startsWith('{')) {
    let depth = 0;
    let end = 0;
    for (; end < rest.length; end++) {
      if (rest[end] === '{') depth++;
      else if (rest[end] === '}' && --depth === 0) break;
    }
    type = rest.slice(1, end).trim();
    rest = rest.slice(end + 1).trim();
  }
  const [first = '', ...words] = rest.split(/\s+/);
  const description = words.join(' ').replace(/^-\s*/, '').trim();
  return {
    name: first,
    ...(type ? { type } : {}),
    ...(description ? { description } : {}),
  };
}

/** Read `options.declarations` and describe the elements their `HTMLElementTagNameMap` names. */
export function analyzeDeclarations(
  options: DeclarationsAnalyzeOptions,
): DeclarationsAnalyzeResult {
  const files = options.declarations.map((file) => resolve(file));
  const root = resolve(options.root ?? dirname(files[0] ?? '.'));
  const program = ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  });
  const checker = program.getTypeChecker();
  const diagnostics: AnalyzerDiagnostic[] = [];
  const rel = (file: string) => relative(root, file).split(sep).join('/');
  const where = (node: ts.Node) => {
    const sf = node.getSourceFile();
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return { file: rel(sf.fileName), line: line + 1, column: character + 1 };
  };
  const own = (sf: ts.SourceFile) =>
    !program.isSourceFileDefaultLibrary(sf) &&
    !program.isSourceFileFromExternalLibrary(sf) &&
    !rel(sf.fileName).startsWith('..');
  const docOf = (node: ts.Node & { name?: ts.Node }) => {
    const symbol = node.name ? checker.getSymbolAtLocation(node.name) : undefined;
    const text = symbol ? ts.displayPartsToString(symbol.getDocumentationComment(checker)) : '';
    return text.trim() ? { description: text.trim() } : {};
  };
  const nameOf = (name: ts.PropertyName | undefined) =>
    name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;

  const maps: ts.InterfaceDeclaration[] = [];
  for (const sf of program.getSourceFiles().filter(own)) {
    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === 'HTMLElementTagNameMap')
        maps.push(node);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  if (!maps.length)
    diagnostics.push({
      code: 'analyzer.declarations.noTags',
      severity: 'warning',
      message:
        'No declaration adds to HTMLElementTagNameMap, so no element and its tag are known: the manifest is empty.',
      suggestion:
        "Declare each tag: declare global { interface HTMLElementTagNameMap { 'my-element': MyElement } }.",
    });

  const modules = new Map<string, { declarations: DeclaredElement[]; exports: string[] }>();
  for (const map of maps)
    for (const entry of map.members) {
      if (!ts.isPropertySignature(entry)) continue;
      const tag = nameOf(entry.name);
      if (!tag?.includes('-')) continue;
      const reference = entry.type && ts.isTypeReferenceNode(entry.type) ? entry.type : undefined;
      let symbol = reference ? checker.getSymbolAtLocation(reference.typeName) : undefined;
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declaration = symbol?.declarations?.find(
        (d): d is ts.ClassDeclaration | ts.InterfaceDeclaration =>
          ts.isClassDeclaration(d) || ts.isInterfaceDeclaration(d),
      );
      if (!declaration || !declaration.name || !own(declaration.getSourceFile())) {
        diagnostics.push({
          code: 'analyzer.declarations.unresolved',
          severity: 'warning',
          message: `<${tag}> maps to ${entry.type?.getText() ?? 'no type'}, which is not a class or interface these declarations define: it is left out.`,
          source: where(entry),
        });
        continue;
      }
      const name = declaration.name.text;
      const members: Member[] = [];
      const accessors = new Map<string, { get?: ts.GetAccessorDeclaration; set?: true }>();
      for (const member of declaration.members) {
        const flags = ts.getCombinedModifierFlags(member as ts.Declaration);
        const memberName = nameOf(member.name);
        if (
          !memberName ||
          memberName.startsWith('_') ||
          flags &
            (ts.ModifierFlags.Private | ts.ModifierFlags.Protected | ts.ModifierFlags.Static) ||
          ts.getJSDocTags(member).some((t) => t.tagName.text === 'internal')
        )
          continue;
        if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
          const found = accessors.get(memberName) ?? {};
          if (ts.isGetAccessorDeclaration(member)) found.get = member;
          else found.set = true;
          if (!accessors.has(memberName)) {
            accessors.set(memberName, found);
            members.push({ kind: 'field', name: memberName });
          }
        } else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
          members.push({
            kind: 'field',
            name: memberName,
            ...(member.type ? { type: { text: member.type.getText() } } : {}),
            ...(flags & ts.ModifierFlags.Readonly ? { readonly: true as const } : {}),
            ...docOf(member),
          });
        } else if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
          const parameters = member.parameters.map((p) => ({
            name: p.name.getText(),
            ...(p.type ? { type: { text: p.type.getText() } } : {}),
            ...(p.questionToken ? { optional: true as const } : {}),
          }));
          members.push({
            kind: 'method',
            name: memberName,
            ...(parameters.length ? { parameters } : {}),
            ...(member.type ? { return: { type: { text: member.type.getText() } } } : {}),
            ...docOf(member),
          });
        }
      }
      // An accessor pair is one field; a getter alone is read-only.
      for (const [field, { get, set }] of accessors) {
        const at = members.findIndex((m) => m.kind === 'field' && m.name === field);
        members[at] = {
          kind: 'field',
          name: field,
          ...(get?.type ? { type: { text: get.type.getText() } } : {}),
          ...(get && !set ? { readonly: true as const } : {}),
          ...(get ? docOf(get) : {}),
        };
      }

      const lists: Record<
        'attributes' | 'events' | 'slots' | 'cssParts' | 'cssProperties' | 'cssStates',
        (Named & { type?: Text })[]
      > = {
        attributes: [],
        events: [],
        slots: [],
        cssParts: [],
        cssProperties: [],
        cssStates: [],
      };
      const LIST: Record<string, keyof typeof lists> = {
        attr: 'attributes',
        attribute: 'attributes',
        fires: 'events',
        event: 'events',
        slot: 'slots',
        csspart: 'cssParts',
        cssprop: 'cssProperties',
        cssproperty: 'cssProperties',
        cssstate: 'cssStates',
      };
      for (const jsdoc of ts.getJSDocTags(declaration)) {
        const list = LIST[jsdoc.tagName.text];
        if (!list) continue;
        const {
          name: tagged,
          type,
          description,
        } = tagText(ts.getTextOfJSDocComment(jsdoc.comment) ?? '');
        const entryName = list === 'slots' && (tagged === '-' || tagged === '') ? '' : tagged;
        if (!entryName && list !== 'slots') continue;
        lists[list].push({
          name: entryName,
          ...(type && (list === 'attributes' || list === 'events') ? { type: { text: type } } : {}),
          ...(description ? { description } : {}),
        });
      }
      const heritage = declaration.heritageClauses?.find(
        (h) => h.token === ts.SyntaxKind.ExtendsKeyword,
      )?.types[0];
      const unknown = [
        'the module that registers it',
        ...(lists.attributes.length ? [] : ['its attributes']),
        'its defaults',
      ];
      diagnostics.push({
        code: 'analyzer.declarations.unknown',
        severity: 'info',
        message: `<${tag}> (${name}): declarations do not state ${unknown.join(', ').replace(/, ([^,]+)$/, ', or $1')}, so the manifest leaves ${unknown.length > 1 ? 'them' : 'it'} out.`,
        source: where(declaration),
        suggestion: 'Publish the manifest your build writes, or document attributes with @attr.',
      });
      const element: DeclaredElement = {
        kind: 'class',
        name,
        tagName: tag,
        customElement: true,
        ...docOf(declaration),
        ...(heritage ? { superclass: { name: heritage.expression.getText() } } : {}),
        ...(members.length ? { members } : {}),
        ...Object.fromEntries(Object.entries(lists).filter(([, list]) => list.length)),
      };
      const path = rel(declaration.getSourceFile().fileName).replace(/\.d\.([mc]?)ts$/, '.$1js');
      const module = modules.get(path) ?? { declarations: [], exports: [] };
      modules.set(path, module);
      if (!module.declarations.some((d) => d.name === name)) module.declarations.push(element);
      if (
        ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Export &&
        !module.exports.includes(name)
      )
        module.exports.push(name);
    }

  return {
    manifest: {
      schemaVersion: '2.1.0',
      modules: [...modules]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([path, module]) => ({
          kind: 'javascript-module' as const,
          path,
          declarations: module.declarations.sort((a, b) => (a.name < b.name ? -1 : 1)),
          ...(module.exports.length
            ? {
                exports: module.exports.sort().map((name) => ({
                  kind: 'js' as const,
                  name,
                  declaration: { name, module: path },
                })),
              }
            : {}),
        })),
    },
    diagnostics: sortDiagnostics(diagnostics),
  };
}
