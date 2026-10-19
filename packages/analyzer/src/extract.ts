/**
 * Static extraction over a TypeScript program. Never imports or executes analyzed modules.
 * Contract: docs/architecture/metadata-and-analyzer.md §2.
 */
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { createPublishedReader, type PublishedPackage } from './published.js';

export interface SourceLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

export interface AnalyzerDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly source?: SourceLocation;
  readonly suggestion?: string;
}

export type Known<T> = { readonly known: true; readonly value: T } | { readonly known: false };

export interface PropertyInfo {
  readonly name: string;
  readonly kind: string;
  readonly type: string;
  readonly attribute: string | null;
  readonly reflects: boolean;
  /** JavaScript expression text of the default, when statically known. */
  readonly default: Known<string>;
  readonly values?: readonly string[];
  readonly description?: string;
  readonly inheritedFrom?: ClassRef;
}

export interface EventInfo {
  readonly name: string;
  readonly detailType: string;
  readonly bubbles: boolean;
  readonly composed: boolean;
  readonly cancelable: boolean;
  readonly syncs?: string;
  /** Declared `intent`; absent when the definition does not state it (unknown). */
  readonly intent?: { readonly value: 'user' | 'notification'; readonly source?: SourceLocation };
  readonly description?: string;
  readonly inheritedFrom?: ClassRef;
}

export interface MemberInfo {
  readonly kind: 'field' | 'method';
  readonly name: string;
  readonly type: string;
  readonly readonly: boolean;
  readonly description?: string;
}

export interface NamedDoc {
  readonly name: string;
  readonly description?: string;
}

export interface ClassRef {
  readonly name: string;
  /** Library-relative source path, or the module path in `package` when that is set. */
  readonly file: string;
  /** Package that publishes the class, when it is not the analyzed library. */
  readonly package?: string;
}

export interface ComponentInfo {
  readonly name: string;
  readonly file: string;
  /** Package that publishes this class, for a base read from another package's metadata. */
  readonly package?: string;
  readonly location: SourceLocation;
  readonly description?: string;
  readonly superclass: { readonly name: string; readonly package?: string; readonly file?: string };
  readonly properties: readonly PropertyInfo[];
  readonly events: readonly EventInfo[];
  readonly members: readonly MemberInfo[];
  readonly slots: readonly NamedDoc[];
  readonly parts: readonly NamedDoc[];
  readonly cssProperties: readonly NamedDoc[];
  readonly cssStates: readonly NamedDoc[];
  readonly tokenReads: readonly { readonly token: string; readonly readThrough: 'stylesheet' }[];
  readonly tags: Readonly<Record<string, readonly { value: string; location: SourceLocation }[]>>;
  readonly exported: boolean;
  /** Facts supplied by explicit metadata (`@oddkin-metadata file.json`), as stable member ids. */
  readonly authored?: { readonly file: string; readonly ids: readonly string[] };
  /**
   * Names found only by scanning `render()` and `static styles` (here or in a base class), so a
   * definition's template and styles can replace them. JSDoc-declared names are not included.
   */
  readonly derived?: {
    readonly slots: readonly string[];
    readonly parts: readonly string[];
    readonly cssProperties: readonly string[];
    readonly tokens: readonly string[];
  };
}

/** A named export in a source file (definition, template, or styles). */
export interface SourceRef {
  readonly name: string;
  /** Library-relative source path, the package specifier when `external`, or the module path in `package`. */
  readonly file: string;
  /** Imported from another package's published declarations (e.g. shared styles). */
  readonly external?: true;
  /** Inherited from a definition another package publishes; `file` is that package's module path. */
  readonly package?: string;
}

/** What a style source reads: CSS custom properties and tokens (`var(--odd-…)` or `token('…')`). */
export interface StyleReads {
  readonly cssProperties: readonly string[];
  readonly tokens: readonly string[];
}

/** An exported template's anatomy, published so recomposing packages know what it provides. */
export interface TemplateSource {
  readonly ref: SourceRef;
  readonly slots: readonly string[];
  readonly parts: readonly string[];
}

/** An exported style source and what it reads. */
export interface StyleSource extends StyleReads {
  readonly ref: SourceRef;
}

/** A `compose()` definition resolved statically. */
export interface DefinitionInfo {
  readonly tag: string;
  readonly className: string;
  readonly classFile: string;
  /** The variable holding the definition, when it is one. */
  readonly ref?: SourceRef;
  readonly template?: SourceRef;
  readonly styles: readonly SourceRef[];
  /** Named roles → tag names of dependency definitions. */
  readonly dependencies: Readonly<Record<string, string>>;
  /** Tag of the definition this one was recomposed from (`...base`). */
  readonly extends?: string;
  readonly location: SourceLocation;
}

export interface Registration {
  readonly tag: string;
  readonly className: string;
  readonly classFile: string;
  readonly file: string;
  readonly location: SourceLocation;
  /** Present when registered with `define(definition)`. */
  readonly definition?: DefinitionInfo;
}

export interface RecipeInfo {
  readonly name: string;
  readonly regions: Readonly<Record<string, string>>;
  readonly variants: Readonly<Record<string, readonly string[]>>;
  readonly conditions: readonly string[];
  readonly parts: readonly string[];
  readonly container?: { readonly selector?: string; readonly name?: string };
  readonly location: SourceLocation;
}

export interface ModelInfo {
  readonly name: string;
  readonly version: number;
  readonly kinds: readonly string[];
  readonly location: SourceLocation;
}

export interface Extraction {
  readonly components: readonly ComponentInfo[];
  readonly registrations: readonly Registration[];
  readonly recipes: readonly RecipeInfo[];
  readonly models: readonly ModelInfo[];
  readonly definitions: readonly DefinitionInfo[];
  readonly exports: ReadonlyMap<string, readonly string[]>;
  /** Exported templates and style sources of the analyzed library. */
  readonly sources: {
    readonly templates: readonly TemplateSource[];
    readonly styles: readonly StyleSource[];
  };
  readonly diagnostics: readonly AnalyzerDiagnostic[];
}

const ODDKIN_CORE = /(?:[\\/]|^)(?:@oddkin[\\/]core|packages[\\/]core)[\\/]/;
const ODDKIN_LAYOUT =
  /(?:[\\/]|^)(?:@oddkin[\\/]components|packages[\\/]components)[\\/](?:src|dist)[\\/]layout[\\/]/;
const TAG_NAME = /^[a-z][a-z0-9._-]*-[a-z0-9._-]*$/;
const DOC_TAGS = [
  'a11y',
  'keyboard',
  'category',
  'useFor',
  'notFor',
  'limitation',
  'related',
  'deprecated',
  'since',
  'previewRole',
];

export function extract(program: ts.Program, root: string): Extraction {
  const checker = program.getTypeChecker();
  const diagnostics: AnalyzerDiagnostic[] = [];
  const components = new Map<ts.ClassDeclaration, ComponentInfo | null>();
  const registrations: Registration[] = [];
  const recipes: RecipeInfo[] = [];
  const models: ModelInfo[] = [];
  const definitions = new Map<ts.CallExpression, Resolved | null>();
  const exportsBySource = new Map<string, string[]>();
  const published = createPublishedReader();
  const publishedComponents = new Map<ts.ClassDeclaration, ComponentInfo | null>();
  const templateSources = new Map<string, TemplateSource>();
  const styleSources = new Map<string, StyleSource>();

  const rel = (file: string) => relative(root, file).split(sep).join('/');
  const where = (node: ts.Node): SourceLocation => {
    const source = node.getSourceFile();
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    return { file: rel(source.fileName), line: line + 1, column: character + 1 };
  };
  const report = (
    code: string,
    node: ts.Node,
    message: string,
    suggestion?: string,
    severity: AnalyzerDiagnostic['severity'] = 'warning',
  ) =>
    diagnostics.push({
      code,
      severity,
      message,
      source: where(node),
      ...(suggestion ? { suggestion } : {}),
    });

  const resolveSymbol = (node: ts.Node): ts.Symbol | undefined => {
    const symbol = checker.getSymbolAtLocation(node);
    return symbol && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  };
  const fromOddkinCore = (node: ts.Node, name: string): boolean => {
    const symbol = resolveSymbol(node);
    return (
      !!symbol &&
      symbol.name === name &&
      !!symbol.declarations?.some((d) => ODDKIN_CORE.test(d.getSourceFile().fileName))
    );
  };
  // `defineLayoutRecipe` from core or from the Oddkin-bound `@oddkin/components/layout`.
  const isRecipeDefinition = (node: ts.Node): boolean => {
    if (fromOddkinCore(node, 'defineLayoutRecipe')) return true;
    const symbol = resolveSymbol(node);
    return (
      symbol?.name === 'defineLayoutRecipe' &&
      !!symbol.declarations?.some((d) => ODDKIN_LAYOUT.test(d.getSourceFile().fileName))
    );
  };
  // Recipes are defined at module scope; a call inside a function is a wrapper or factory.
  const insideFunction = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent)
      if (ts.isFunctionLike(parent)) return true;
    return false;
  };
  const isLibrarySource = (file: ts.SourceFile) =>
    !file.isDeclarationFile &&
    !program.isSourceFileFromExternalLibrary(file) &&
    !file.fileName.includes('/node_modules/');

  const literal = (node: ts.Expression | undefined): Known<string> => {
    if (!node) return { known: false };
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
      return { known: true, value: node.getText() };
    if (
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.NullKeyword
    ) {
      return { known: true, value: node.getText() };
    }
    if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
      return { known: true, value: node.getText() };
    return { known: false };
  };
  const stringOf = (node: ts.Expression | undefined): string | undefined =>
    node && ts.isStringLiteralLike(node) ? node.text : undefined;
  const booleanOf = (node: ts.Expression | undefined): boolean | undefined =>
    node?.kind === ts.SyntaxKind.TrueKeyword
      ? true
      : node?.kind === ts.SyntaxKind.FalseKeyword
        ? false
        : undefined;
  const objectEntries = (
    node: ts.ObjectLiteralExpression,
    owner: string,
  ): Map<string, ts.Expression> => {
    const out = new Map<string, ts.Expression>();
    for (const property of node.properties) {
      if (
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      ) {
        out.set(property.name.text, property.initializer);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        out.set(property.name.text, property.name);
      } else {
        report(
          'analyzer.dynamic.property',
          property,
          `${owner}: a spread or computed entry cannot be analyzed statically.`,
          'Write each entry as a literal key: value.',
        );
      }
    }
    return out;
  };
  const docOf = (node: ts.Node): string | undefined => {
    const symbol = (node as { name?: ts.Node }).name
      ? checker.getSymbolAtLocation((node as unknown as { name: ts.Node }).name)
      : undefined;
    const text = symbol
      ? ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
      : '';
    return text || undefined;
  };

  // ---- prop.* definitions ----
  function properties(definitions: ts.ObjectLiteralExpression, className: string): PropertyInfo[] {
    const out: PropertyInfo[] = [];
    for (const [name, initializer] of objectEntries(definitions, `${className}.with()`)) {
      const call = initializer;
      const callee =
        ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)
          ? call.expression
          : undefined;
      if (!callee || !ts.isCallExpression(call) || !fromOddkinCore(callee.expression, 'prop')) {
        report(
          'analyzer.dynamic.definition',
          initializer,
          `${className}.${name} is not a prop.*() call; its contract cannot be extracted.`,
          'Define it inline, e.g. name: prop.string({ default: "…" }).',
        );
        continue;
      }
      const kind = callee.name.text;
      const values =
        kind === 'enum' && call.arguments[0] && ts.isArrayLiteralExpression(call.arguments[0])
          ? call.arguments[0].elements.map((e) => stringOf(e as ts.Expression) ?? e.getText())
          : undefined;
      const optionsNode = kind === 'enum' ? call.arguments[1] : call.arguments[0];
      const options =
        optionsNode && ts.isObjectLiteralExpression(optionsNode)
          ? objectEntries(optionsNode, `${className}.${name}`)
          : new Map<string, ts.Expression>();
      if (optionsNode && !ts.isObjectLiteralExpression(optionsNode))
        report(
          'analyzer.dynamic.options',
          optionsNode,
          `${className}.${name}: options must be an object literal.`,
        );
      const attributeNode = options.get('attribute');
      const propertyOnly =
        kind === 'object' ||
        kind === 'array' ||
        (kind === 'custom' && !options.has('fromAttribute'));
      let attribute: string | null = propertyOnly
        ? null
        : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      if (attributeNode) {
        if (attributeNode.kind === ts.SyntaxKind.FalseKeyword) attribute = null;
        else if (stringOf(attributeNode) !== undefined)
          attribute = stringOf(attributeNode) as string;
        else
          report(
            'analyzer.dynamic.attribute',
            attributeNode,
            `${className}.${name}: attribute must be a string literal or false.`,
          );
      }
      const reflects = booleanOf(options.get('reflect')) ?? false;
      const defaultNode = options.get('default');
      const fallback: Known<string> =
        kind === 'boolean'
          ? { known: true, value: 'false' }
          : kind === 'array' && !defaultNode
            ? { known: true, value: '[]' }
            : defaultNode
              ? literal(defaultNode)
              : { known: true, value: 'undefined' };
      if (
        defaultNode &&
        !fallback.known &&
        !ts.isArrowFunction(defaultNode) &&
        !ts.isFunctionExpression(defaultNode)
      ) {
        report(
          'analyzer.dynamic.value',
          defaultNode,
          `${className}.${name}: the default is computed; it is recorded as unknown.`,
        );
      }
      const description = stringOf(options.get('description'));
      out.push({
        name,
        kind,
        type: '',
        attribute,
        reflects,
        default: fallback,
        ...(values ? { values } : {}),
        ...(description ? { description } : {}),
      });
    }
    return out;
  }

  // ---- events ----
  function eventFrom(expression: ts.Expression, owner: string): EventInfo | undefined {
    let call: ts.Expression = expression;
    let variable: ts.VariableDeclaration | undefined;
    if (ts.isIdentifier(call)) {
      // Shorthand entries ({ countChange }) name the variable through the shorthand symbol.
      const shorthand = ts.isShorthandPropertyAssignment(call.parent)
        ? checker.getShorthandAssignmentValueSymbol(call.parent)
        : undefined;
      const symbol = shorthand ?? resolveSymbol(call);
      const declaration = (
        symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
      )?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
        variable = declaration;
        call = declaration.initializer;
      }
    }
    if (!ts.isCallExpression(call) || !fromOddkinCore(call.expression, 'event')) {
      report(
        'analyzer.dynamic.event',
        expression,
        `${owner}: events must be defined with event<Detail>('name', { … }).`,
      );
      return undefined;
    }
    const name = stringOf(call.arguments[0]);
    const init = call.arguments[1];
    if (!name || !init || !ts.isObjectLiteralExpression(init)) {
      report(
        'analyzer.dynamic.event',
        call,
        `${owner}: the event name and options must be literals.`,
      );
      return undefined;
    }
    const options = objectEntries(init, `${owner} event`);
    const typeArgument = call.typeArguments?.[0];
    const detailType = typeArgument
      ? checker.typeToString(checker.getTypeFromTypeNode(typeArgument))
      : 'void';
    const syncs = stringOf(options.get('syncs'));
    const intentNode = options.get('intent');
    const intentValue = stringOf(intentNode);
    const intent =
      intentNode && (intentValue === 'user' || intentValue === 'notification')
        ? { value: intentValue as 'user' | 'notification', source: where(intentNode) }
        : undefined;
    if (intentNode && !intent)
      report(
        'analyzer.dynamic.value',
        intentNode,
        `${owner} event "${name}": intent must be the literal 'user' or 'notification'; it is recorded as unknown.`,
      );
    const description =
      stringOf(options.get('description')) ?? (variable ? docOf(variable) : undefined);
    return {
      name,
      detailType,
      bubbles: booleanOf(options.get('bubbles')) ?? false,
      composed: booleanOf(options.get('composed')) ?? false,
      cancelable: booleanOf(options.get('cancelable')) ?? false,
      ...(syncs ? { syncs } : {}),
      ...(intent ? { intent } : {}),
      ...(description ? { description } : {}),
    };
  }

  // ---- templates and styles ----
  const templateText = (node: ts.TemplateLiteral) =>
    ts.isNoSubstitutionTemplateLiteral(node)
      ? node.text
      : [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join('\u0000');
  function scanTemplates(
    body: ts.Node,
    tag: 'html' | 'css',
    visit: (text: string, node: ts.Node) => void,
  ) {
    const walk = (node: ts.Node) => {
      if (
        ts.isTaggedTemplateExpression(node) &&
        ts.isIdentifier(node.tag) &&
        (node.tag.text === tag || (tag === 'html' && node.tag.text === 'svg'))
      ) {
        visit(templateText(node.template), node);
      }
      ts.forEachChild(node, walk);
    };
    walk(body);
  }
  const attributeValue = (attributes: string, name: string) =>
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`).exec(attributes);

  /** CSS custom properties read with `var()` and tokens read with `var(--odd-…)` or `token()`. */
  function styleReads(node: ts.Node): { cssProperties: string[]; tokens: string[] } {
    const cssProperties: string[] = [];
    const tokens: string[] = [];
    scanTemplates(node, 'css', (text, template) => {
      for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
        const variable = match[1] as string;
        (variable.startsWith('--odd-') ? tokens : cssProperties).push(variable);
      }
      const walk = (child: ts.Node) => {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text === 'token'
        ) {
          const name = stringOf(child.arguments[0]);
          if (name) tokens.push(name);
        }
        ts.forEachChild(child, walk);
      };
      walk(template);
    });
    return { cssProperties, tokens };
  }

  /** Slots and parts a template renders. */
  function templateAnatomy(node: ts.Node): { slots: Set<string>; parts: Set<string> } {
    const found = { slots: new Set<string>(), parts: new Set<string>() };
    scanTemplates(node, 'html', (text) => {
      for (const match of text.matchAll(/<slot\b([^>]*)>/g)) {
        const name = attributeValue(match[1] ?? '', 'name');
        found.slots.add(name ? (name[1] ?? name[2] ?? name[3] ?? '') : '');
      }
      for (const match of text.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)) {
        const part = attributeValue(match[1] ?? '', 'part');
        for (const name of (part ? (part[1] ?? part[2] ?? part[3] ?? '') : '').split(/\s+/))
          if (name) found.parts.add(name);
      }
    });
    return found;
  }

  const sourceKey = (ref: SourceRef) => `${ref.file}#${ref.name}`;
  /** Record an exported style source of the analyzed library. */
  function recordStyles(ref: SourceRef, node: ts.Node) {
    if (!styleSources.has(sourceKey(ref)))
      styleSources.set(sourceKey(ref), { ref, ...styleReads(node) });
  }

  /** A section of another package's `oddkin.metadata.json` entry, by module path and name. */
  function publishedSource<T>(
    pkg: PublishedPackage,
    section: 'templates' | 'styles',
    module: string,
    name: string,
  ): T | undefined {
    const entries = pkg.metadata?.[section] as Record<string, T> | undefined;
    return entries?.[`${module}#${name}`];
  }
  const publishedReads = (pkg: PublishedPackage, module: string, name: string) => {
    const entry = publishedSource<Partial<StyleReads>>(pkg, 'styles', module, name);
    return entry
      ? { cssProperties: entry.cssProperties ?? [], tokens: entry.tokens ?? [] }
      : undefined;
  };

  // ---- classes ----
  function heritage(node: ts.ClassDeclaration) {
    return node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]
      ?.expression;
  }

  function classify(node: ts.ClassDeclaration): ComponentInfo | null {
    if (components.has(node)) return components.get(node) as ComponentInfo | null;
    components.set(node, null);
    // Diagnostics raised for this class (after its base is resolved) can be covered by explicit metadata.
    let diagnosticsBefore = diagnostics.length;
    const expression = heritage(node);
    if (!expression || !node.name) return null;
    const className = node.name.text;
    let base: ComponentInfo | null = null;
    let superclass: ComponentInfo['superclass'] | undefined;
    let own: PropertyInfo[] = [];

    const baseOf = (target: ts.Expression): boolean => {
      if (fromOddkinCore(target, 'OddkinElement')) {
        superclass = { name: 'OddkinElement', package: '@oddkin/core' };
        return true;
      }
      const declaration = resolveSymbol(target)?.declarations?.find(ts.isClassDeclaration);
      if (declaration && isLibrarySource(declaration.getSourceFile())) {
        base = classify(declaration);
        if (base) superclass = { name: base.name, file: base.file };
        return !!base;
      }
      // An element class another package publishes: its contract comes from that package's CEM.
      if (declaration?.getSourceFile().isDeclarationFile) {
        base = publishedComponent(declaration, target);
        if (base) superclass = { name: base.name, package: base.package as string };
        return !!base;
      }
      return false;
    };

    if (
      ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === 'with'
    ) {
      if (!baseOf(expression.expression.expression)) return null;
      diagnosticsBefore = diagnostics.length;
      const definitions = expression.arguments[0];
      if (definitions && ts.isObjectLiteralExpression(definitions))
        own = properties(definitions, className);
      else
        report(
          'analyzer.dynamic.definitions',
          expression,
          `${className}: with() needs an object literal of prop.*() definitions.`,
        );
    } else if (!baseOf(expression)) return null;
    else diagnosticsBefore = diagnostics.length;

    const instanceType = checker.getDeclaredTypeOfSymbol(
      checker.getSymbolAtLocation(node.name) as ts.Symbol,
    );
    const typeOf = (name: string) => {
      const symbol = instanceType.getProperty(name);
      return symbol
        ? checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, node))
        : 'unknown';
    };
    own = own.map((p) => ({ ...p, type: typeOf(p.name) }));
    const ref: ClassRef = { name: className, file: rel(node.getSourceFile().fileName) };
    const inherit = <T extends { inheritedFrom?: ClassRef }>(
      items: readonly T[] | undefined,
      from: ComponentInfo | null,
    ): T[] =>
      (items ?? []).map((item) =>
        item.inheritedFrom
          ? item
          : {
              ...item,
              inheritedFrom: {
                name: (from as ComponentInfo).name,
                file: (from as ComponentInfo).file,
                ...((from as ComponentInfo).package
                  ? { package: (from as ComponentInfo).package as string }
                  : {}),
              },
            },
      );
    const parent = base as ComponentInfo | null;

    const events: EventInfo[] = [];
    const members: MemberInfo[] = [];
    const cssStates = new Map<string, NamedDoc>();
    const slots = new Map<string, NamedDoc>();
    const parts = new Map<string, NamedDoc>();
    const cssProperties = new Map<string, NamedDoc>();
    const tokenReads = new Map<string, { token: string; readThrough: 'stylesheet' }>();
    const styleNames = new Set<string>();
    const styleTokens = new Set<string>();
    const renderSlots = new Set<string>();
    const renderParts = new Set<string>();

    for (const member of node.members) {
      const modifiers = ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : [];
      const isStatic = modifiers.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
      const hidden =
        modifiers.some(
          (m) =>
            m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
        ) ||
        (member.name && ts.isPrivateIdentifier(member.name)) ||
        ts.getJSDocTags(member).some((t) => t.tagName.text === 'internal');
      const memberName =
        member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
          ? member.name.text
          : undefined;
      if (
        isStatic &&
        memberName === 'events' &&
        ts.isPropertyDeclaration(member) &&
        member.initializer
      ) {
        if (ts.isObjectLiteralExpression(member.initializer)) {
          for (const [, value] of objectEntries(member.initializer, `${className}.events`)) {
            const info = eventFrom(value, className);
            if (info) events.push(info);
          }
        } else
          report(
            'analyzer.dynamic.event',
            member.initializer,
            `${className}.events must be an object literal.`,
          );
      }
      if (
        isStatic &&
        memberName === 'styles' &&
        ts.isPropertyDeclaration(member) &&
        member.initializer
      ) {
        const read = styleReads(member.initializer);
        for (const name of read.cssProperties) {
          cssProperties.set(name, { name });
          styleNames.add(name);
        }
        for (const token of read.tokens) {
          tokenReads.set(token, { token, readThrough: 'stylesheet' });
          styleTokens.add(token);
        }
      }
      if (!isStatic && !hidden && memberName && !memberName.startsWith('_')) {
        if (
          (ts.isGetAccessorDeclaration(member) || ts.isPropertyDeclaration(member)) &&
          memberName !== 'render'
        ) {
          const setter = node.members.some(
            (m) => ts.isSetAccessorDeclaration(m) && m.name.getText() === memberName,
          );
          const readonly = ts.isGetAccessorDeclaration(member)
            ? !setter
            : modifiers.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword);
          const description = docOf(member);
          members.push({
            kind: 'field',
            name: memberName,
            type: typeOf(memberName),
            readonly,
            ...(description ? { description } : {}),
          });
        } else if (ts.isMethodDeclaration(member)) {
          const signature = checker.getSignatureFromDeclaration(member);
          const description = docOf(member);
          members.push({
            kind: 'method',
            name: memberName,
            type: signature ? checker.signatureToString(signature) : '',
            readonly: false,
            ...(description ? { description } : {}),
          });
        }
      }
      if (memberName === 'render' && ts.isMethodDeclaration(member) && member.body) {
        scanTemplates(member.body, 'html', (text) => {
          for (const match of text.matchAll(/<slot\b([^>]*)>/g)) {
            const name = attributeValue(match[1] ?? '', 'name');
            const slot = name ? (name[1] ?? name[2] ?? name[3] ?? '') : '';
            slots.set(slot, { name: slot });
            renderSlots.add(slot);
          }
          for (const match of text.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)) {
            const part = attributeValue(match[1] ?? '', 'part');
            for (const name of (part ? (part[1] ?? part[2] ?? part[3] ?? '') : '')
              .split(/\s+/)
              .filter(Boolean)) {
              parts.set(name, { name });
              renderParts.add(name);
            }
          }
        });
      }
    }
    // Custom states set with this.setState('name', …) and token() references anywhere in the class.
    const walk = (child: ts.Node) => {
      if (ts.isCallExpression(child)) {
        const callee = child.expression;
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.expression.kind === ts.SyntaxKind.ThisKeyword &&
          callee.name.text === 'setState'
        ) {
          const state = stringOf(child.arguments[0]);
          if (state) cssStates.set(state, { name: state });
          else
            report(
              'analyzer.dynamic.state',
              child,
              `${className}: setState() with a computed name cannot be documented.`,
            );
        }
        if (ts.isIdentifier(callee) && callee.text === 'token') {
          const name = stringOf(child.arguments[0]);
          if (name) tokenReads.set(name, { token: name, readThrough: 'stylesheet' });
        }
      }
      ts.forEachChild(child, walk);
    };
    walk(node);

    // JSDoc tags: CEM conventions (@slot, @csspart, @cssprop, @cssstate) and Oddkin tags.
    const tags: Record<string, { value: string; location: SourceLocation }[]> = {};
    for (const tag of ts.getJSDocTags(node)) {
      const tagName = tag.tagName.text;
      const comment = (
        typeof tag.comment === 'string'
          ? tag.comment
          : (ts.getTextOfJSDocComment(tag.comment) ?? '')
      ).trim();
      const [first = '', ...restWords] = comment.split(/\s+/);
      const rest = restWords.join(' ').replace(/^-\s*/, '');
      const named = { name: first, ...(rest ? { description: rest } : {}) };
      if (tagName === 'slot') {
        slots.set(first === '-' ? '' : first, { ...named, name: first === '-' ? '' : first });
        renderSlots.delete(first === '-' ? '' : first);
      } else if (tagName === 'csspart') {
        parts.set(first, named);
        renderParts.delete(first);
      } else if (tagName === 'cssprop' || tagName === 'cssproperty') {
        cssProperties.set(first, named);
        styleNames.delete(first);
      } else if (tagName === 'cssstate') cssStates.set(first, named);
      else if (DOC_TAGS.includes(tagName))
        (tags[tagName] ??= []).push({ value: comment, location: where(tag) });
    }

    const description = docOf(node);
    const exported = !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const explicit = explicitMetadata(node, className, diagnosticsBefore);
    const info: ComponentInfo = {
      name: className,
      file: ref.file,
      location: where(node),
      ...(description ? { description } : {}),
      superclass: superclass as ComponentInfo['superclass'],
      properties: [...inherit(parent?.properties, parent), ...own],
      events: [...inherit(parent?.events, parent), ...events],
      members: [
        ...(parent?.members ?? []).filter((m) => !own.some((p) => p.name === m.name)),
        ...members.filter((m) => !own.some((p) => p.name === m.name)),
      ],
      slots: [...(parent?.slots ?? []), ...slots.values()].filter(
        (s, i, all) => all.findIndex((x) => x.name === s.name) === i,
      ),
      parts: [...(parent?.parts ?? []), ...parts.values()].filter(
        (s, i, all) => all.findIndex((x) => x.name === s.name) === i,
      ),
      cssProperties: [...(parent?.cssProperties ?? []), ...cssProperties.values()].filter(
        (s, i, all) => all.findIndex((x) => x.name === s.name) === i,
      ),
      cssStates: [...(parent?.cssStates ?? []), ...cssStates.values()].filter(
        (s, i, all) => all.findIndex((x) => x.name === s.name) === i,
      ),
      // A documented component variable (`@cssprop --odd-button-radius`) is not a token read.
      tokenReads: [...(parent?.tokenReads ?? []), ...tokenReads.values()].filter(
        (s, i, all) =>
          all.findIndex((x) => x.token === s.token) === i &&
          !cssProperties.has(s.token) &&
          !(parent?.cssProperties ?? []).some((c) => c.name === s.token),
      ),
      tags,
      exported,
      derived: {
        slots: [...(parent?.derived?.slots ?? []), ...renderSlots],
        parts: [...(parent?.derived?.parts ?? []), ...renderParts],
        cssProperties: [...(parent?.derived?.cssProperties ?? []), ...styleNames],
        tokens: [...(parent?.derived?.tokens ?? []), ...styleTokens],
      },
    };

    /** True when the class's instance type derives from `HTMLElement`. */
    function isElementClass(declaration: ts.ClassDeclaration): boolean {
      const symbol = declaration.name && checker.getSymbolAtLocation(declaration.name);
      const pending: ts.Type[] = symbol ? [checker.getDeclaredTypeOfSymbol(symbol)] : [];
      for (let depth = 0; pending.length && depth < 32; depth++) {
        const type = pending.shift() as ts.Type;
        if (type.getSymbol()?.name === 'HTMLElement') return true;
        if (type.isClassOrInterface()) pending.push(...(checker.getBaseTypes(type) ?? []));
        else if (type.isIntersection()) pending.push(...type.types);
      }
      return false;
    }

    /**
     * A component class published by another package, read from its `custom-elements.json`
     * (members, attributes, events, slots, parts, CSS properties and states) and
     * `oddkin.metadata.json` (token reads, sync pairs, and the template and style sources of its
     * definition). The package's modules are never executed.
     */
    function publishedComponent(
      declaration: ts.ClassDeclaration,
      at: ts.Node,
    ): ComponentInfo | null {
      if (publishedComponents.has(declaration)) return publishedComponents.get(declaration) ?? null;
      publishedComponents.set(declaration, null);
      const file = declaration.getSourceFile().fileName;
      const pkg = published(file);
      if (!pkg || !declaration.name) return null;
      const name = declaration.name.text;
      const module = pkg.moduleOf(file);
      const cem = pkg.declaration(name, module);
      if (!cem?.customElement) {
        if (isElementClass(declaration))
          report(
            'analyzer.published.missing',
            at,
            `${pkg.name} publishes no custom-elements.json declaration for ${name}; classes extending it are not documented.`,
            `Publish ${pkg.name} with its custom-elements.json (package.json "customElements").`,
          );
        return null;
      }
      const metadata = cem.tagName
        ? ((pkg.metadata?.['components'] as Record<string, Record<string, unknown>> | undefined)?.[
            `component:${cem.tagName}`
          ] ?? undefined)
        : undefined;
      const from: ClassRef = { name, file: module, package: pkg.name };
      const inherited = (value: unknown): ClassRef => {
        const ref = value as { name?: string; module?: string; package?: string } | undefined;
        return ref?.name
          ? { name: ref.name, file: ref.module ?? module, package: ref.package ?? pkg.name }
          : from;
      };
      const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
      const described = <T extends object>(item: T, description: unknown): T =>
        text(description) ? { ...item, description: text(description) as string } : item;
      const named = (list: readonly { name: string; description?: string }[] | undefined) =>
        (list ?? []).map((item) => described({ name: item.name }, item.description));
      const syncPairs = (metadata?.['syncPairs'] ?? []) as { property: string; event: string }[];
      const publishedIntents = (metadata?.['events'] ?? []) as {
        event: string;
        intent?: { value?: string };
      }[];
      const tag = cem.tagName;
      const typeText = (member: Record<string, unknown>) =>
        (member['type'] as { text?: string } | undefined)?.text;

      const properties: PropertyInfo[] = [];
      const members: MemberInfo[] = [];
      for (const member of cem.members ?? []) {
        if (
          member['static'] ||
          member['privacy'] === 'private' ||
          member['privacy'] === 'protected'
        )
          continue;
        const memberName = member['name'] as string;
        if (member['kind'] === 'method') {
          members.push(
            described(
              { kind: 'method', name: memberName, type: '', readonly: false },
              member['description'],
            ),
          );
          continue;
        }
        if (member['kind'] !== 'field') continue;
        // prop.*() fields carry an attribute or a known default; accessors and plain fields do not.
        if (member['attribute'] !== undefined || member['default'] !== undefined) {
          properties.push(
            described(
              {
                name: memberName,
                kind: 'published',
                type: typeText(member) ?? 'unknown',
                attribute: text(member['attribute']) ?? null,
                reflects: member['reflects'] === true,
                default:
                  typeof member['default'] === 'string'
                    ? { known: true, value: member['default'] }
                    : { known: false },
                inheritedFrom: inherited(member['inheritedFrom']),
              },
              member['description'],
            ),
          );
        } else
          members.push(
            described(
              {
                kind: 'field',
                name: memberName,
                type: typeText(member) ?? 'unknown',
                readonly: member['readonly'] === true,
              },
              member['description'],
            ),
          );
      }
      const events: EventInfo[] = (cem.events ?? []).map((event) => {
        const type = typeText(event) ?? 'CustomEvent';
        const detail = /^CustomEvent<(.*)>$/s.exec(type)?.[1];
        const syncs = syncPairs.find((p) => p.event === event['name'])?.property;
        // The publisher's declared intent; its source location belongs to that package.
        const intent = publishedIntents.find(
          (e) => e.event === `event:${tag}#${event['name'] as string}`,
        )?.intent?.value;
        return described(
          {
            name: event['name'] as string,
            detailType: detail ?? 'void',
            bubbles: false,
            composed: false,
            cancelable: false,
            ...(syncs ? { syncs } : {}),
            ...(intent === 'user' || intent === 'notification'
              ? { intent: { value: intent } }
              : {}),
            inheritedFrom: inherited(event['inheritedFrom']),
          },
          event['description'],
        );
      });

      // What its definition's template and styles provide, so a recomposition can replace them.
      const definition = metadata?.['definition'] as
        | {
            template?: { module: string; name: string };
            styles?: { module: string; name: string }[];
          }
        | undefined;
      const anatomy = definition?.template
        ? publishedSource<{ slots?: string[]; parts?: string[] }>(
            pkg,
            'templates',
            definition.template.module,
            definition.template.name,
          )
        : undefined;
      const reads = (definition?.styles ?? []).map((s) => publishedReads(pkg, s.module, s.name));
      if ((definition?.template && !anatomy) || reads.some((r) => !r))
        report(
          'analyzer.published.sources',
          at,
          `${pkg.name} publishes no template or style facts for the definition of <${cem.tagName}>; facts its template and styles provide are kept when a definition replaces them.`,
          `Rebuild ${pkg.name} with a current @oddkin/analyzer.`,
          'info',
        );
      const superclass = cem.superclass;
      const info: ComponentInfo = {
        name,
        file: module,
        package: pkg.name,
        location: { file: `${pkg.name}/${module}`, line: 1, column: 1 },
        superclass: {
          name: superclass?.name ?? 'OddkinElement',
          package: superclass?.package ?? pkg.name,
        },
        properties,
        events,
        members,
        slots: named(cem.slots),
        parts: named(cem.cssParts),
        cssProperties: named(cem.cssProperties),
        cssStates: named(cem.cssStates),
        tokenReads: ((metadata?.['tokenReads'] ?? []) as { token: string }[]).map((t) => ({
          token: t.token,
          readThrough: 'stylesheet' as const,
        })),
        tags: {},
        exported: true,
        derived: {
          slots: anatomy?.slots ?? [],
          parts: anatomy?.parts ?? [],
          cssProperties: reads.flatMap((r) => r?.cssProperties ?? []),
          tokens: reads.flatMap((r) => r?.tokens ?? []),
        },
      };
      publishedComponents.set(declaration, info);
      return info;
    }
    const merged = explicit ? mergeExplicit(info, explicit) : info;
    components.set(node, merged);
    return merged;
  }

  // ---- explicit metadata (@oddkin-metadata ./file.json) ----
  interface Explicit {
    readonly file: string;
    readonly data: Record<string, unknown>;
  }
  const LISTS = ['properties', 'events', 'slots', 'parts', 'cssProperties', 'cssStates'] as const;

  function explicitMetadata(
    node: ts.ClassDeclaration,
    className: string,
    diagnosticsBefore: number,
  ): Explicit | undefined {
    const tag = ts.getJSDocTags(node).find((t) => t.tagName.text === 'oddkin-metadata');
    if (!tag) return undefined;
    const comment = (
      typeof tag.comment === 'string' ? tag.comment : (ts.getTextOfJSDocComment(tag.comment) ?? '')
    ).trim();
    const absolutePath = resolve(dirname(node.getSourceFile().fileName), comment);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(absolutePath, 'utf8'));
    } catch (error) {
      report(
        'analyzer.metadata.missing',
        tag,
        `${className}: cannot read explicit metadata "${comment}": ${error instanceof Error ? error.message : String(error)}.`,
        undefined,
        'error',
      );
      return undefined;
    }
    const problems =
      typeof data !== 'object' || data === null || Array.isArray(data)
        ? ['the file must contain an object']
        : Object.entries(data).flatMap(([key, value]) =>
            key === 'description'
              ? typeof value === 'string'
                ? []
                : ['description must be a string']
              : (LISTS as readonly string[]).includes(key)
                ? Array.isArray(value) &&
                  value.every(
                    (v) =>
                      typeof v === 'object' &&
                      v !== null &&
                      typeof (v as { name?: unknown }).name === 'string',
                  )
                  ? []
                  : [`${key} must be an array of objects with a name`]
                : [`unknown key "${key}" (allowed: description, ${LISTS.join(', ')})`],
          );
    if (problems.length) {
      report(
        'analyzer.metadata.invalid',
        tag,
        `${className}: explicit metadata ${comment}: ${problems.join('; ')}.`,
        undefined,
        'error',
      );
      return undefined;
    }
    // Explicit metadata answers what static analysis could not: its dynamic warnings become info.
    for (let i = diagnosticsBefore; i < diagnostics.length; i++) {
      const d = diagnostics[i] as AnalyzerDiagnostic;
      if (d.code.startsWith('analyzer.dynamic.'))
        diagnostics[i] = {
          ...d,
          severity: 'info',
          message: `${d.message} Explicit metadata (${comment}) is merged for this class.`,
        };
    }
    return { file: rel(absolutePath), data: data as Record<string, unknown> };
  }

  function mergeExplicit(info: ComponentInfo, explicit: Explicit): ComponentInfo {
    const ids: string[] = [];
    const merge = <T extends { name: string }>(
      list: readonly T[],
      key: (typeof LISTS)[number],
      idKind: string,
      normalize: (raw: Record<string, unknown>) => T,
    ): T[] => {
      const authored = (explicit.data[key] as Record<string, unknown>[] | undefined) ?? [];
      const out = [...list];
      for (const raw of authored) {
        const entry = normalize(raw);
        const index = out.findIndex((x) => x.name === entry.name);
        if (index >= 0) out[index] = entry;
        else out.push(entry);
        ids.push(`${idKind}#${entry.name}`);
      }
      return out;
    };
    const text = (raw: Record<string, unknown>, field: string) =>
      typeof raw[field] === 'string' ? (raw[field] as string) : undefined;
    const named = (raw: Record<string, unknown>): NamedDoc => ({
      name: raw['name'] as string,
      ...(text(raw, 'description') ? { description: text(raw, 'description') as string } : {}),
    });
    const description = text(explicit.data, 'description');
    return {
      ...info,
      ...(description ? { description } : {}),
      properties: merge(info.properties, 'properties', 'property', (raw) => ({
        name: raw['name'] as string,
        kind: 'authored',
        type: text(raw, 'type') ?? 'unknown',
        attribute: raw['attribute'] === null ? null : (text(raw, 'attribute') ?? null),
        reflects: raw['reflects'] === true,
        default:
          text(raw, 'default') !== undefined
            ? { known: true, value: text(raw, 'default') as string }
            : { known: false },
        ...(text(raw, 'description') ? { description: text(raw, 'description') as string } : {}),
      })),
      events: merge(info.events, 'events', 'event', (raw) => ({
        name: raw['name'] as string,
        detailType: text(raw, 'detailType') ?? 'void',
        bubbles: raw['bubbles'] === true,
        composed: raw['composed'] === true,
        cancelable: raw['cancelable'] === true,
        ...(text(raw, 'syncs') ? { syncs: text(raw, 'syncs') as string } : {}),
        ...(text(raw, 'description') ? { description: text(raw, 'description') as string } : {}),
      })),
      slots: merge(info.slots, 'slots', 'slot', named),
      parts: merge(info.parts, 'parts', 'part', named),
      cssProperties: merge(info.cssProperties, 'cssProperties', 'cssprop', named),
      cssStates: merge(info.cssStates, 'cssStates', 'state', named),
      authored: { file: explicit.file, ids },
    };
  }
  // ---- compose() definitions ----
  interface Resolved {
    readonly info: DefinitionInfo;
    readonly classNode: ts.ClassDeclaration;
    readonly templateNode?: ts.Node;
    readonly styleNodes?: readonly ts.Node[];
    /** Reads of style sources other packages publish (with `styleNodes`, the complete styles). */
    readonly styleReads?: readonly StyleReads[];
    /** Published by another package; its class cannot be registered again. */
    readonly external?: true;
  }

  /** Follow an identifier (through imports) to the expression it is initialized with. */
  function initializerOf(
    expression: ts.Expression,
  ): { node: ts.Node; ref?: SourceRef } | undefined {
    if (!ts.isIdentifier(expression)) return { node: expression };
    const declaration = resolveSymbol(expression)?.declarations?.[0];
    if (!declaration) return undefined;
    const ref = { name: expression.text, file: rel(declaration.getSourceFile().fileName) };
    if (ts.isVariableDeclaration(declaration) && declaration.initializer)
      return {
        node: declaration.initializer,
        ref: { ...ref, name: (declaration.name as ts.Identifier).text },
      };
    if (ts.isFunctionDeclaration(declaration) && declaration.name)
      return { node: declaration, ref: { ...ref, name: declaration.name.text } };
    return undefined;
  }

  function stylesFrom(
    expression: ts.Expression,
    refs: SourceRef[],
    nodes: ts.Node[],
    reads: StyleReads[],
    owner: string,
  ): void {
    const found = initializerOf(expression);
    if (!found) {
      const published = publishedStyles(expression);
      if (!published) {
        report('analyzer.dynamic.definition', expression, `${owner}: styles cannot be resolved.`);
        return;
      }
      refs.push(published.ref);
      if (published.reads) reads.push(published.reads);
      else
        report(
          'analyzer.published.sources',
          expression,
          `${owner}: ${published.ref.package ?? published.ref.file} publishes no facts for ${published.ref.name}; what it reads is unknown.`,
          `Rebuild ${published.ref.package ?? published.ref.file} with a current @oddkin/analyzer.`,
          'info',
        );
      return;
    }
    const node = found.node;
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) {
        if (ts.isSpreadElement(element))
          report(
            'analyzer.dynamic.definition',
            element,
            `${owner}: spread styles are not analyzed.`,
          );
        else stylesFrom(element, refs, nodes, reads, owner);
      }
      return;
    }
    if (found.ref) {
      refs.push(found.ref);
      recordStyles(found.ref, node);
    }
    nodes.push(node);
  }

  /**
   * Styles imported from another package (`import { hostStyles } from '@oddkin/components/styles'`)
   * resolve to its declarations, which carry no CSS: they are recorded by specifier and name, and
   * what they read comes from that package's published `styles` facts.
   */
  function publishedStyles(
    expression: ts.Expression,
  ): { ref: SourceRef; reads?: StyleReads } | undefined {
    if (!ts.isIdentifier(expression)) return undefined;
    const declaration = resolveSymbol(expression)?.declarations?.[0];
    if (!declaration?.getSourceFile().isDeclarationFile || !ts.isVariableDeclaration(declaration))
      return undefined;
    const specifier = checker
      .getSymbolAtLocation(expression)
      ?.declarations?.find(ts.isImportSpecifier);
    const from = specifier?.parent.parent.parent.moduleSpecifier;
    if (!specifier || !from || !ts.isStringLiteral(from) || from.text.startsWith('.'))
      return undefined;
    const file = declaration.getSourceFile().fileName;
    const pkg = published(file);
    // Recorded as the publisher's module path, the key of its published `styles` facts.
    if (pkg && ts.isIdentifier(declaration.name)) {
      const module = pkg.moduleOf(file);
      const reads = publishedReads(pkg, module, declaration.name.text);
      return {
        ref: { name: declaration.name.text, file: module, package: pkg.name },
        ...(reads ? { reads } : {}),
      };
    }
    return {
      ref: {
        name: (specifier.propertyName ?? specifier.name).text,
        file: from.text,
        external: true,
      },
    };
  }

  const definitionRef = (call: ts.CallExpression, ref?: SourceRef): SourceRef | undefined =>
    ref ??
    (ts.isVariableDeclaration(call.parent) && ts.isIdentifier(call.parent.name)
      ? { name: call.parent.name.text, file: rel(call.getSourceFile().fileName) }
      : undefined);

  /**
   * A definition published by another package (`ElementDefinition<Class>` in its declarations):
   * its tag is the `HTMLElementTagNameMap` entry for that class in the class's declaration file.
   * Declarations only; nothing is executed.
   */
  function publishedDefinitionTag(expression: ts.Expression): string | undefined {
    return publishedDefinitionOf(expression)?.tag;
  }
  function publishedDefinitionOf(
    expression: ts.Expression,
  ): { tag: string; classNode: ts.ClassDeclaration } | undefined {
    const declaration = resolveSymbol(expression)?.declarations?.[0];
    if (!declaration || !declaration.getSourceFile().isDeclarationFile) return undefined;
    if (!ts.isVariableDeclaration(declaration) || !declaration.type) return undefined;
    const type = declaration.type;
    // Emitted declarations write `import("@oddkin/core/element").ElementDefinition<Class>`.
    const typeName = ts.isTypeReferenceNode(type)
      ? type.typeName
      : ts.isImportTypeNode(type)
        ? type.qualifier
        : undefined;
    const typeArguments =
      ts.isTypeReferenceNode(type) || ts.isImportTypeNode(type) ? type.typeArguments : undefined;
    if (!typeName || typeArguments?.length !== 1) return undefined;
    if (!fromOddkinCore(typeName, 'ElementDefinition')) return undefined;
    const argument = typeArguments[0];
    if (!argument || !ts.isTypeReferenceNode(argument)) return undefined;
    const classSymbol = resolveSymbol(argument.typeName);
    const classFile = classSymbol?.declarations?.[0]?.getSourceFile();
    if (!classSymbol || !classFile) return undefined;
    let tag: string | undefined;
    const visit = (node: ts.Node): void => {
      if (tag) return;
      if (ts.isInterfaceDeclaration(node) && node.name.text === 'HTMLElementTagNameMap') {
        for (const member of node.members) {
          if (
            !ts.isPropertySignature(member) ||
            !member.type ||
            !ts.isTypeReferenceNode(member.type)
          )
            continue;
          const name = ts.isStringLiteral(member.name) ? member.name.text : undefined;
          if (name && TAG_NAME.test(name) && resolveSymbol(member.type.typeName) === classSymbol)
            tag = name;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(classFile);
    const classNode = classSymbol.declarations?.find(ts.isClassDeclaration);
    return tag && classNode ? { tag, classNode } : undefined;
  }

  /**
   * Spreading a definition another package publishes: its tag and class come from declarations,
   * and its template, styles, and dependencies from that package's `oddkin.metadata.json`.
   */
  function publishedDefinition(expression: ts.Expression): Resolved | undefined {
    const found = publishedDefinitionOf(expression);
    if (!found?.classNode.name) return undefined;
    const file = found.classNode.getSourceFile().fileName;
    const pkg = published(file);
    if (!pkg) return undefined;
    const entry = (
      pkg.metadata?.['components'] as Record<string, { definition?: unknown }> | undefined
    )?.[`component:${found.tag}`]?.definition as
      | {
          template?: { module: string; name: string };
          styles?: { module: string; name: string }[];
          dependencies?: Record<string, string>;
        }
      | undefined;
    if (!entry)
      report(
        'analyzer.published.sources',
        expression,
        `${pkg.name} publishes no definition facts for <${found.tag}>; its template and styles are unknown.`,
        `Rebuild ${pkg.name} with a current @oddkin/analyzer.`,
        'info',
      );
    const refOf = (ref: { module: string; name: string }): SourceRef => ({
      name: ref.name,
      file: ref.module,
      package: pkg.name,
    });
    const reads = (entry?.styles ?? []).map((s) => publishedReads(pkg, s.module, s.name));
    return {
      external: true,
      classNode: found.classNode,
      info: {
        tag: found.tag,
        className: found.classNode.name.text,
        classFile: pkg.moduleOf(file),
        ...(entry?.template ? { template: refOf(entry.template) } : {}),
        styles: (entry?.styles ?? []).map(refOf),
        dependencies: Object.fromEntries(
          Object.entries(entry?.dependencies ?? {}).map(([role, id]) => [
            role,
            id.replace(/^component:/, ''),
          ]),
        ),
        location: where(expression),
      },
      ...(entry?.styles
        ? { styleNodes: [], styleReads: reads.filter((r): r is StyleReads => !!r) }
        : {}),
    };
  }

  /** Resolve an expression to a `compose()` definition, following imports and spreads. */
  function definitionFrom(expression: ts.Expression): Resolved | undefined {
    const found = initializerOf(expression);
    const call = found?.node;
    if (
      !call ||
      !ts.isCallExpression(call) ||
      !ts.isIdentifier(call.expression) ||
      !fromOddkinCore(call.expression, 'compose')
    )
      return undefined;
    if (definitions.has(call)) return definitions.get(call) ?? undefined;
    definitions.set(call, null);
    const init = call.arguments[0];
    if (!init || !ts.isObjectLiteralExpression(init)) {
      report('analyzer.dynamic.definition', call, 'compose() needs an object literal.');
      return undefined;
    }
    let base: Resolved | undefined;
    let tag: string | undefined;
    let classNode: ts.ClassDeclaration | undefined;
    let template: { ref?: SourceRef; node?: ts.Node } | undefined;
    let styles: { refs: SourceRef[]; nodes: ts.Node[]; reads: StyleReads[] } | undefined;
    let dependencies: Record<string, string> | undefined;
    for (const property of init.properties) {
      if (ts.isSpreadAssignment(property)) {
        base = definitionFrom(property.expression) ?? publishedDefinition(property.expression);
        if (!base) {
          report(
            'analyzer.dynamic.definition',
            property,
            'compose(): only a spread of another compose() definition can be analyzed.',
          );
          continue;
        }
        tag = base.info.tag;
        classNode = base.classNode;
        // A published base has no template node: its template's facts arrive with its class.
        template =
          base.templateNode || base.info.template
            ? {
                ...(base.templateNode ? { node: base.templateNode } : {}),
                ...(base.info.template ? { ref: base.info.template } : {}),
              }
            : undefined;
        styles = base.styleNodes
          ? {
              refs: [...base.info.styles],
              nodes: [...base.styleNodes],
              reads: [...(base.styleReads ?? [])],
            }
          : undefined;
        dependencies = { ...base.info.dependencies };
        continue;
      }
      const key =
        (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
          ? property.name.text
          : undefined;
      const value = ts.isPropertyAssignment(property)
        ? property.initializer
        : ts.isShorthandPropertyAssignment(property)
          ? property.name
          : undefined;
      if (!key || !value) {
        report(
          'analyzer.dynamic.definition',
          property,
          'compose(): computed entries are not analyzed.',
        );
        continue;
      }
      if (key === 'name') {
        tag = stringOf(value);
        if (!tag || !TAG_NAME.test(tag))
          report(
            'analyzer.dynamic.tagName',
            value,
            'compose(): the name is computed or invalid; the definition cannot be documented.',
            "Use a string literal, e.g. name: 'my-element'.",
          );
      } else if (key === 'element') {
        classNode = resolveSymbol(value)?.declarations?.find(ts.isClassDeclaration);
        if (!classNode)
          report(
            'analyzer.dynamic.registration',
            value,
            'compose(): the element class cannot be resolved.',
          );
      } else if (key === 'template') {
        const resolved = initializerOf(value);
        if (resolved) {
          template = { node: resolved.node, ...(resolved.ref ? { ref: resolved.ref } : {}) };
          if (resolved.ref && !templateSources.has(sourceKey(resolved.ref))) {
            const anatomy = templateAnatomy(resolved.node);
            templateSources.set(sourceKey(resolved.ref), {
              ref: resolved.ref,
              slots: [...anatomy.slots],
              parts: [...anatomy.parts],
            });
          }
        } else
          report(
            'analyzer.dynamic.definition',
            value,
            'compose(): the template cannot be resolved.',
          );
      } else if (key === 'styles') {
        styles = { refs: [], nodes: [], reads: [] };
        stylesFrom(value, styles.refs, styles.nodes, styles.reads, `compose(${tag ?? ''})`);
      } else if (key === 'dependencies') {
        dependencies = {};
        if (ts.isObjectLiteralExpression(value)) {
          for (const entry of value.properties) {
            const role =
              ts.isPropertyAssignment(entry) || ts.isShorthandPropertyAssignment(entry)
                ? entry.name.getText().replace(/^['"]|['"]$/g, '')
                : undefined;
            const target = ts.isPropertyAssignment(entry)
              ? entry.initializer
              : ts.isShorthandPropertyAssignment(entry)
                ? entry.name
                : undefined;
            const dependency = target ? definitionFrom(target) : undefined;
            const external = !dependency && target ? publishedDefinitionTag(target) : undefined;
            if (role && dependency) dependencies[role] = dependency.info.tag;
            else if (role && external) dependencies[role] = external;
            else
              report(
                'analyzer.dynamic.definition',
                entry,
                'compose(): each dependency must be a compose() definition.',
              );
          }
        } else
          report(
            'analyzer.dynamic.definition',
            value,
            'compose(): dependencies must be an object literal.',
          );
      }
    }
    if (!tag || !TAG_NAME.test(tag) || !classNode?.name) return undefined;
    if (base?.external && classNode === base.classNode) {
      report(
        'analyzer.dynamic.definition',
        call,
        `compose(${tag}): a definition recomposed from a published one needs its own element class.`,
        'Pass element: class extends Base {} (one constructor per registered name).',
      );
      return undefined;
    }
    const variable = definitionRef(call, found?.ref);
    const resolved: Resolved = {
      classNode,
      ...(template?.node ? { templateNode: template.node } : {}),
      ...(styles ? { styleNodes: styles.nodes, styleReads: styles.reads } : {}),
      info: {
        tag,
        className: classNode.name.text,
        classFile: rel(classNode.getSourceFile().fileName),
        ...(variable ? { ref: variable } : {}),
        ...(template?.ref ? { template: template.ref } : {}),
        styles: styles?.refs ?? [],
        dependencies: dependencies ?? {},
        ...(base ? { extends: base.info.tag } : {}),
        location: where(call),
      },
    };
    definitions.set(call, resolved);
    return resolved;
  }

  /** Apply a definition's template and styles to its class's facts (they replace render()/static styles). */
  function overlay(info: ComponentInfo, resolved: Resolved): ComponentInfo {
    const derived = info.derived ?? { slots: [], parts: [], cssProperties: [], tokens: [] };
    let { slots, parts, cssProperties, tokenReads } = info;
    // Names the new template or styles provide again keep their documentation.
    const doc = <T extends { name: string }>(list: readonly T[], name: string) =>
      list.find((item) => item.name === name) ?? { name };
    if (resolved.templateNode) {
      const found = templateAnatomy(resolved.templateNode);
      slots = slots.filter((s) => !derived.slots.includes(s.name));
      parts = parts.filter((s) => !derived.parts.includes(s.name));
      for (const name of found.slots)
        if (!slots.some((s) => s.name === name)) slots = [...slots, doc(info.slots, name)];
      for (const name of found.parts)
        if (!parts.some((s) => s.name === name)) parts = [...parts, doc(info.parts, name)];
    }
    if (resolved.styleNodes) {
      cssProperties = cssProperties.filter((c) => !derived.cssProperties.includes(c.name));
      tokenReads = tokenReads.filter((t) => !derived.tokens.includes(t.token));
      for (const read of [...resolved.styleNodes.map(styleReads), ...(resolved.styleReads ?? [])]) {
        for (const name of read.cssProperties)
          if (!cssProperties.some((c) => c.name === name))
            cssProperties = [...cssProperties, doc(info.cssProperties, name)];
        for (const token of read.tokens)
          if (!tokenReads.some((t) => t.token === token))
            tokenReads = [...tokenReads, { token, readThrough: 'stylesheet' }];
      }
    }
    tokenReads = tokenReads.filter((t) => !cssProperties.some((c) => c.name === t.token));
    return { ...info, slots, parts, cssProperties, tokenReads };
  }

  // ---- module walk ----
  for (const file of program.getSourceFiles()) {
    if (!isLibrarySource(file)) continue;
    const exportedNames: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) classify(node);
      // Exported style sources are published with what they read, used by a definition or not.
      if (
        ts.isVariableStatement(node) &&
        ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const declaration of node.declarationList.declarations) {
          const initializer = declaration.initializer;
          if (
            ts.isIdentifier(declaration.name) &&
            initializer &&
            ts.isTaggedTemplateExpression(initializer) &&
            fromOddkinCore(initializer.tag, 'css')
          )
            recordStyles({ name: declaration.name.text, file: rel(file.fileName) }, initializer);
        }
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const isDefine =
          (ts.isIdentifier(callee) && fromOddkinCore(callee, 'define')) ||
          (ts.isPropertyAccessExpression(callee) &&
            callee.name.text === 'define' &&
            callee.expression.getText() === 'customElements');
        if (ts.isIdentifier(callee) && fromOddkinCore(callee, 'compose')) definitionFrom(node);
        const definitionArgument =
          isDefine && node.arguments[0] && !ts.isStringLiteralLike(node.arguments[0])
            ? node.arguments[0]
            : undefined;
        const registered = definitionArgument ? definitionFrom(definitionArgument) : undefined;
        if (isDefine && definitionArgument && node.arguments.length === 1) {
          if (!registered)
            report(
              'analyzer.dynamic.registration',
              node,
              'define(definition) needs a compose() definition the analyzer can resolve.',
              'Export the definition as a const initialized with compose({ ... }).',
            );
          else
            registrations.push({
              tag: registered.info.tag,
              className: registered.info.className,
              classFile: registered.info.classFile,
              file: rel(file.fileName),
              location: where(node),
              definition: registered.info,
            });
        } else if (isDefine) {
          const tag = stringOf(node.arguments[0]);
          const target = node.arguments[1];
          const declaration =
            target && resolveSymbol(target)?.declarations?.find(ts.isClassDeclaration);
          if (!tag || !TAG_NAME.test(tag))
            report(
              'analyzer.dynamic.tagName',
              node,
              'The tag name is computed or invalid; the registration cannot be documented.',
              "Call define('my-element', MyElement) with a string literal.",
            );
          else if (!declaration?.name)
            report(
              'analyzer.dynamic.registration',
              node,
              `<${tag}> is registered with a class the analyzer cannot resolve.`,
            );
          else
            registrations.push({
              tag,
              className: declaration.name.text,
              classFile: rel(declaration.getSourceFile().fileName),
              file: rel(file.fileName),
              location: where(node),
            });
        }
        if (ts.isIdentifier(callee) && isRecipeDefinition(callee) && !insideFunction(node)) {
          const definition = node.arguments[0];
          if (definition && ts.isObjectLiteralExpression(definition)) {
            const entries = objectEntries(definition, 'defineLayoutRecipe');
            const name = stringOf(entries.get('name'));
            const regionsNode = entries.get('regions');
            const regions: Record<string, string> = {};
            if (regionsNode && ts.isObjectLiteralExpression(regionsNode)) {
              for (const [region, helper] of objectEntries(regionsNode, 'regions')) {
                const call = ts.isArrayLiteralExpression(helper) ? helper.elements[0] : helper;
                regions[region] =
                  call && ts.isCallExpression(call)
                    ? (call.expression.getText().split('.').pop() ?? 'custom')
                    : 'custom';
              }
            }
            const variantsNode = entries.get('variants');
            const variants: Record<string, string[]> = {};
            if (variantsNode && ts.isObjectLiteralExpression(variantsNode)) {
              for (const [attribute, values] of objectEntries(variantsNode, 'variants')) {
                variants[attribute] = ts.isObjectLiteralExpression(values)
                  ? [...objectEntries(values, attribute).keys()]
                  : [];
              }
            }
            const whenNode = entries.get('when');
            const conditions =
              whenNode && ts.isObjectLiteralExpression(whenNode)
                ? [...objectEntries(whenNode, 'when').keys()]
                : [];
            const partsNode = entries.get('parts');
            const parts =
              partsNode && ts.isArrayLiteralExpression(partsNode)
                ? partsNode.elements.map((e) => stringOf(e as ts.Expression) ?? '').filter(Boolean)
                : [];
            const containerNode = entries.get('container');
            const container =
              containerNode && ts.isObjectLiteralExpression(containerNode)
                ? objectEntries(containerNode, 'container')
                : undefined;
            const containerName = stringOf(container?.get('name'));
            const containerSelector = stringOf(container?.get('selector'));
            if (!name)
              report(
                'analyzer.dynamic.recipe',
                node,
                'Recipes need a literal name to be documented.',
                "Add name: 'my-recipe'.",
              );
            else {
              recipes.push({
                name,
                regions,
                variants,
                conditions,
                parts,
                ...(container
                  ? {
                      container: {
                        ...(containerSelector ? { selector: containerSelector } : {}),
                        ...(containerName ? { name: containerName } : {}),
                      },
                    }
                  : {}),
                location: where(node),
              });
            }
          } else
            report('analyzer.dynamic.recipe', node, 'defineLayoutRecipe needs an object literal.');
        }
        if (ts.isIdentifier(callee) && fromOddkinCore(callee, 'defineModel')) {
          const name = stringOf(node.arguments[0]);
          const definition = node.arguments[1];
          const entries =
            definition && ts.isObjectLiteralExpression(definition)
              ? objectEntries(definition, 'defineModel')
              : undefined;
          const versionNode = entries?.get('version');
          const version =
            versionNode && ts.isNumericLiteral(versionNode) ? Number(versionNode.text) : undefined;
          const kinds: string[] = [];
          const findUnion = (n: ts.Node) => {
            if (
              ts.isCallExpression(n) &&
              ts.isPropertyAccessExpression(n.expression) &&
              n.expression.name.text === 'union' &&
              n.arguments[1] &&
              ts.isObjectLiteralExpression(n.arguments[1])
            ) {
              kinds.push(...objectEntries(n.arguments[1], 'union').keys());
            }
            ts.forEachChild(n, findUnion);
          };
          if (entries?.get('schema')) findUnion(entries.get('schema') as ts.Node);
          if (!name || version === undefined)
            report(
              'analyzer.dynamic.model',
              node,
              'defineModel needs a literal name and version to be documented.',
            );
          else models.push({ name, version, kinds, location: where(node) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    const moduleSymbol = checker.getSymbolAtLocation(file);
    for (const symbol of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : [])
      exportedNames.push(symbol.name);
    exportsBySource.set(rel(file.fileName), exportedNames.sort());
  }

  // Definitions replace the facts their class derives from render() and static styles.
  for (const registration of registrations) {
    if (!registration.definition) continue;
    const resolved = [...definitions.values()].find((d) => d?.info === registration.definition);
    const info = resolved && classify(resolved.classNode);
    if (resolved && info) components.set(resolved.classNode, overlay(info, resolved));
  }

  return {
    components: [...components.values()].filter((c): c is ComponentInfo => !!c),
    registrations,
    recipes,
    models,
    definitions: [...definitions.values()]
      .filter((d): d is Resolved => !!d)
      .map((d) => d.info)
      .sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0)),
    exports: exportsBySource,
    sources: {
      templates: [...templateSources.values()],
      styles: [...styleSources.values()],
    },
    diagnostics,
  };
}

/** Resolve a path relative to `root` into an absolute path (helper for callers). */
export const absolute = (root: string, file: string) => resolve(root, file);
