/**
 * Static extraction over a TypeScript program. Never imports or executes analyzed modules.
 * Contract: docs/architecture/metadata-and-analyzer.md §2.
 */
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';

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
  readonly file: string;
}

export interface ComponentInfo {
  readonly name: string;
  readonly file: string;
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
}

export interface Registration {
  readonly tag: string;
  readonly className: string;
  readonly classFile: string;
  readonly file: string;
  readonly location: SourceLocation;
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
  readonly exports: ReadonlyMap<string, readonly string[]>;
  readonly diagnostics: readonly AnalyzerDiagnostic[];
}

const MOTE_CORE = /(?:[\\/]|^)(?:@mote[\\/]core|packages[\\/]core)[\\/]/;
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
  const exportsBySource = new Map<string, string[]>();

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
  const fromMoteCore = (node: ts.Node, name: string): boolean => {
    const symbol = resolveSymbol(node);
    return (
      !!symbol &&
      symbol.name === name &&
      !!symbol.declarations?.some((d) => MOTE_CORE.test(d.getSourceFile().fileName))
    );
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
      if (!callee || !ts.isCallExpression(call) || !fromMoteCore(callee.expression, 'prop')) {
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
    if (!ts.isCallExpression(call) || !fromMoteCore(call.expression, 'event')) {
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
    const description =
      stringOf(options.get('description')) ?? (variable ? docOf(variable) : undefined);
    return {
      name,
      detailType,
      bubbles: booleanOf(options.get('bubbles')) ?? false,
      composed: booleanOf(options.get('composed')) ?? false,
      cancelable: booleanOf(options.get('cancelable')) ?? false,
      ...(syncs ? { syncs } : {}),
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

  // ---- classes ----
  function heritage(node: ts.ClassDeclaration) {
    return node.heritageClauses?.find((h) => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]
      ?.expression;
  }

  function classify(node: ts.ClassDeclaration): ComponentInfo | null {
    if (components.has(node)) return components.get(node) as ComponentInfo | null;
    components.set(node, null);
    const expression = heritage(node);
    if (!expression || !node.name) return null;
    const className = node.name.text;
    let base: ComponentInfo | null = null;
    let superclass: ComponentInfo['superclass'] | undefined;
    let own: PropertyInfo[] = [];

    const baseOf = (target: ts.Expression): boolean => {
      if (fromMoteCore(target, 'MoteElement')) {
        superclass = { name: 'MoteElement', package: '@mote/core' };
        return true;
      }
      const declaration = resolveSymbol(target)?.declarations?.find(ts.isClassDeclaration);
      if (declaration && isLibrarySource(declaration.getSourceFile())) {
        base = classify(declaration);
        if (base) superclass = { name: base.name, file: base.file };
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

    for (const member of node.members) {
      const modifiers = ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : [];
      const isStatic = modifiers.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
      const hidden =
        modifiers.some(
          (m) =>
            m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword,
        ) ||
        (member.name && ts.isPrivateIdentifier(member.name));
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
        scanTemplates(member.initializer, 'css', (text) => {
          for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
            const variable = match[1] as string;
            if (variable.startsWith('--mote-'))
              tokenReads.set(variable, { token: variable, readThrough: 'stylesheet' });
            else cssProperties.set(variable, { name: variable });
          }
        });
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
          }
          for (const match of text.matchAll(/<[a-zA-Z][\w-]*\b([^>]*)>/g)) {
            const part = attributeValue(match[1] ?? '', 'part');
            for (const name of (part ? (part[1] ?? part[2] ?? part[3] ?? '') : '')
              .split(/\s+/)
              .filter(Boolean))
              parts.set(name, { name });
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

    // JSDoc tags: CEM conventions (@slot, @csspart, @cssprop, @cssstate) and Mote tags.
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
      if (tagName === 'slot')
        slots.set(first === '-' ? '' : first, { ...named, name: first === '-' ? '' : first });
      else if (tagName === 'csspart') parts.set(first, named);
      else if (tagName === 'cssprop' || tagName === 'cssproperty') cssProperties.set(first, named);
      else if (tagName === 'cssstate') cssStates.set(first, named);
      else if (DOC_TAGS.includes(tagName))
        (tags[tagName] ??= []).push({ value: comment, location: where(tag) });
    }

    const description = docOf(node);
    const exported = !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
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
      tokenReads: [...(parent?.tokenReads ?? []), ...tokenReads.values()].filter(
        (s, i, all) => all.findIndex((x) => x.token === s.token) === i,
      ),
      tags,
      exported,
    };
    components.set(node, info);
    return info;
  }

  // ---- module walk ----
  for (const file of program.getSourceFiles()) {
    if (!isLibrarySource(file)) continue;
    const exportedNames: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node)) classify(node);
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const isDefine =
          (ts.isIdentifier(callee) && fromMoteCore(callee, 'define')) ||
          (ts.isPropertyAccessExpression(callee) &&
            callee.name.text === 'define' &&
            callee.expression.getText() === 'customElements');
        if (isDefine) {
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
        if (ts.isIdentifier(callee) && fromMoteCore(callee, 'defineLayoutRecipe')) {
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
        if (ts.isIdentifier(callee) && fromMoteCore(callee, 'defineModel')) {
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

  return {
    components: [...components.values()].filter((c): c is ComponentInfo => !!c),
    registrations,
    recipes,
    models,
    exports: exportsBySource,
    diagnostics,
  };
}

/** Resolve a path relative to `root` into an absolute path (helper for callers). */
export const absolute = (root: string, file: string) => resolve(root, file);
