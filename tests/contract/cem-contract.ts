import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { commands, server } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { mountExample } from '@oddkin/workbench/testing';

/**
 * Published-manifest contract checks, shared by every package that publishes
 * `custom-elements.json` (metadata-and-analyzer.md §3). Every default, attribute, allowed value,
 * reflection, event, slot, and part is checked against live elements. Each foundation element
 * gets one conformance-result.v1 record per engine, tied to SHA-256 hashes of the manifest text
 * and the implementation files the page ran; `npm run verify:metadata` attaches passing facts
 * as `verified` provenance only while both hashes still match the files on disk.
 */

export interface Field {
  kind: string;
  name: string;
  type?: { text: string };
  default?: string;
  reflects?: boolean;
  attribute?: string;
  readonly?: boolean;
  static?: boolean;
}
export interface Declaration {
  tagName?: string;
  members?: Field[];
  attributes?: { name: string; fieldName?: string }[];
  events?: { name: string }[];
  slots?: { name: string }[];
  cssParts?: { name: string }[];
}
export type ElementDeclaration = Declaration & { tagName: string };
export type Host = HTMLElement & Record<string, unknown> & { updateComplete: Promise<void> };

export interface ContractOptions {
  /** URL of the package's published `custom-elements.json`. */
  readonly manifestUrl: URL;
  /** URL of the package's `package.json` (name and version are recorded). */
  readonly packageUrl: URL;
  /** Repository-relative package directory, e.g. `packages/components`. */
  readonly packageDir: string;
  /**
   * The implementation files the page runs, from `import.meta.glob(..., { query: '?raw' })` in
   * the calling test (keys relative to it: `../src/…` for the package, `../../<pkg>/dist/…` for
   * dependency builds). They must be the files `scripts/verification.mjs` hashes.
   */
  readonly sources: Readonly<Record<string, string>>;
  /** Tags to check for each published element; the first is the element itself. */
  readonly implementations?: (declaration: ElementDeclaration) => readonly string[];
  /** Authored examples per published tag; without them slots and parts are not executed. */
  readonly examples?: Readonly<Record<string, unknown>>;
}

export const SUITE = { id: 'oddkin.cem-contract', version: '1.0.0' };

/** Literal default from CEM text (`'md'`, `false`, `''`, `0`); undefined when not a literal. */
export function literal(text: string | undefined): { value: unknown } | undefined {
  if (text === undefined) return undefined;
  const quoted = /^'(.*)'$/.exec(text) ?? /^"(.*)"$/.exec(text);
  if (quoted) return { value: quoted[1] };
  if (text === 'true' || text === 'false') return { value: text === 'true' };
  if (/^-?\d+(\.\d+)?$/.test(text)) return { value: Number(text) };
  return undefined;
}
export const unionOf = (type: string | undefined) =>
  type && /^"[^"]*"( \| "[^"]*")*$/.test(type)
    ? [...type.matchAll(/"([^"]*)"/g)].map((m) => m[1]!)
    : undefined;
export const fields = (d: Declaration) =>
  (d.members ?? []).filter((m) => m.kind === 'field' && !m.static && !m.readonly);
/** A value other than the default, valid for the field's published type. */
export function sample(field: Field): unknown {
  const type = field.type?.text;
  if (type === 'boolean') return true;
  if (type === 'number') return 3;
  return unionOf(type)?.find((v) => v !== literal(field.default)?.value) ?? 'Sample text';
}

const created: Element[] = [];
afterEach(() => {
  for (const el of created.splice(0)) el.remove();
  flush();
});
/** Remove `el` after the current test. */
export const track = <T extends Element>(el: T): T => {
  created.push(el);
  return el;
};
export const settle = async (el: Host) => {
  flush();
  await el.updateComplete;
  flush();
};
export async function create(tag: string): Promise<Host> {
  const el = track(document.createElement(tag) as Host);
  document.body.append(el);
  await settle(el);
  return el;
}

const sha256 = async (text: string) =>
  `sha256-${[
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;

/** Hash of the implementation files, as `scripts/verification.mjs` computes it from disk. */
async function implementationHash(
  sources: Readonly<Record<string, string>>,
  packageDir: string,
): Promise<string> {
  const path = (key: string) =>
    key.startsWith('../../')
      ? `packages/${key.slice(6)}`
      : key.startsWith('../')
        ? `${packageDir}/${key.slice(3)}`
        : key;
  return sha256(
    Object.entries(sources)
      .map(([key, text]) => [path(key), text] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, text]) => `${name}\n${text}\n`)
      .join(''),
  );
}

const browserVersion = () =>
  (server.browser === 'firefox'
    ? /Firefox\/([\d.]+)/
    : server.browser === 'webkit'
      ? /Version\/([\d.]+)/
      : /Chrome\/([\d.]+)/
  ).exec(navigator.userAgent)?.[1] ?? 'unknown';

/** Register the contract checks for every published element; returns the parsed declarations. */
export async function describeCemContract(
  options: ContractOptions,
): Promise<readonly ElementDeclaration[]> {
  const manifestText = await (await fetch(options.manifestUrl)).text();
  const pkg = (await (await fetch(options.packageUrl)).json()) as { name: string; version: string };
  const manifest = JSON.parse(manifestText) as { modules: { declarations?: Declaration[] }[] };
  const declarations = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .filter((d): d is ElementDeclaration => !!d.tagName);
  const configuration = {
    browser: server.browser,
    browserVersion: browserVersion(),
    manifest: await sha256(manifestText),
    sources: await implementationHash(options.sources, options.packageDir),
  };

  type Outcome = { state: 'passed' } | { state: 'failed'; message: string };
  const evidence = new Map(declarations.map((d) => [d.tagName, new Map<string, Outcome>()]));
  /** Every case recorded for a published element, in a stable order. */
  const cases = (d: ElementDeclaration): string[] => [
    ...fields(d).flatMap((f) => [
      `property:${d.tagName}#${f.name}/accessor`,
      ...(f.attribute ? [`property:${d.tagName}#${f.name}/pre-upgrade`] : []),
      ...(literal(f.default) ? [`property:${d.tagName}#${f.name}/default`] : []),
      ...(f.attribute
        ? [`property:${d.tagName}#${f.name}/attribute`, `property:${d.tagName}#${f.name}/reflects`]
        : []),
    ]),
    ...(d.events ?? []).map((e) => `event:${d.tagName}#${e.name}/defined`),
    `component:${d.tagName}/events`,
    ...(d.slots ?? []).map((s) => `slot:${d.tagName}#${s.name || 'default'}/rendered`),
    ...(d.cssParts ?? []).map((p) => `part:${d.tagName}#${p.name}/rendered`),
  ];
  /** Run a check; for a published tag, record its outcome under `id` (failures still throw). */
  async function verify(tag: string, id: string, check: () => unknown): Promise<void> {
    const recorded = evidence.get(tag);
    try {
      await check();
      recorded?.set(id, { state: 'passed' });
    } catch (error) {
      recorded?.set(id, {
        state: 'failed',
        message: String((error as Error).message).slice(0, 500),
      });
      throw error;
    }
  }

  afterAll(async () => {
    const date = new Date().toISOString();
    for (const declaration of declarations) {
      const recorded = evidence.get(declaration.tagName)!;
      const record = {
        schema: 'https://oddkin.dev/schemas/conformance-result/v1.json',
        suite: SUITE,
        implementation: { tag: declaration.tagName, package: `${pkg.name}@${pkg.version}` },
        configuration,
        environment: { userAgent: navigator.userAgent },
        date,
        results: cases(declaration).map((id) => ({
          case: id,
          ...(recorded.get(id) ?? { state: 'not-executed' }),
        })),
      };
      await commands.writeFile(
        `${options.packageDir}/.oddkin/verification/${SUITE.id}/${server.browser}/${declaration.tagName}.json`,
        `${JSON.stringify(record, null, 2)}\n`,
      );
    }
  });

  const implementations = declarations.flatMap((declaration) =>
    (options.implementations?.(declaration) ?? [declaration.tagName]).map((tag) => ({
      tag,
      declaration,
    })),
  );
  describe.each(implementations)('<$tag> matches the published CEM', ({ tag, declaration }) => {
    const id = (kind: string, name: string, aspect: string) =>
      `${kind}:${declaration.tagName}#${name}/${aspect}`;

    it('properties are accessors that keep values assigned before the element upgraded', async () => {
      // Frameworks (React 19, Vue, Preact) set a property when `name in element` is true.
      const fresh = document.createElement(tag) as Host;
      for (const field of fields(declaration))
        await verify(tag, id('property', field.name, 'accessor'), () =>
          expect(field.name in fresh, `${tag}.${field.name} in element`).toBe(true),
        );
      // An element parsed in a template is not upgraded until adopted into this document.
      for (const field of fields(declaration).filter((f) => f.attribute)) {
        await verify(tag, id('property', field.name, 'pre-upgrade'), async () => {
          const template = document.createElement('template');
          template.innerHTML = `<${tag}></${tag}>`;
          const early = template.content.firstElementChild as Host;
          const value = sample(field);
          early[field.name] = value;
          const el = track(early);
          document.body.append(el);
          await settle(el);
          expect(customElements.get(tag) && el instanceof customElements.get(tag)!).toBe(true);
          expect(el[field.name], `${tag}.${field.name} after upgrade`).toEqual(value);
          // Replayed through the accessor: no own data property left shadowing it.
          expect(Object.hasOwn(el, field.name), `${tag}.${field.name} shadowed`).toBe(false);
        });
      }
    });

    it('property defaults', async () => {
      const el = await create(tag);
      // Fields without a literal default (accessors such as odd-input's `value`) make no claim.
      for (const field of fields(declaration)) {
        const expected = literal(field.default);
        if (expected)
          await verify(tag, id('property', field.name, 'default'), () =>
            expect(el[field.name], `${tag}.${field.name}`).toEqual(expected.value),
          );
      }
    });

    it('attributes convert to their properties, including every allowed value', async () => {
      const ctor = customElements.get(tag) as unknown as { observedAttributes: string[] };
      for (const attribute of declaration.attributes ?? []) {
        const field = fields(declaration).find((f) => f.name === attribute.fieldName)!;
        await verify(tag, id('property', field.name, 'attribute'), async () => {
          expect(ctor.observedAttributes, `${tag}[${attribute.name}] observed`).toContain(
            attribute.name,
          );
          const el = await create(tag);
          const type = field.type?.text;
          const samples: [string, unknown][] =
            type === 'boolean'
              ? [['', true]]
              : type === 'number'
                ? [['3', 3]]
                : (unionOf(type)?.map((v) => [v, v] as [string, unknown]) ?? [
                    ['Sample text', 'Sample text'],
                  ]);
          for (const [text, value] of samples) {
            el.setAttribute(attribute.name, text);
            await settle(el);
            expect(el[field.name], `${tag}[${attribute.name}="${text}"]`).toEqual(value);
          }
          el.removeAttribute(attribute.name);
          await settle(el);
          expect(el[field.name], `${tag}[${attribute.name}] removed`).toEqual(
            literal(field.default)?.value,
          );
        });
      }
    });

    it('reflects exactly the properties marked as reflecting', async () => {
      for (const field of fields(declaration).filter((f) => f.attribute)) {
        await verify(tag, id('property', field.name, 'reflects'), async () => {
          const el = await create(tag);
          const type = field.type?.text;
          const union = unionOf(type);
          const value =
            type === 'boolean'
              ? true
              : type === 'number'
                ? 3
                : (union?.find((v) => v !== literal(field.default)?.value) ?? 'Sample text');
          el[field.name] = value;
          await settle(el);
          const attribute = el.getAttribute(field.attribute!);
          if (field.reflects) {
            expect(attribute, `${tag}.${field.name} reflects`).toBe(
              value === true ? '' : String(value),
            );
            el[field.name] = type === 'boolean' ? false : literal(field.default)?.value;
            await settle(el);
            if (type === 'boolean') expect(el.hasAttribute(field.attribute!)).toBe(false);
          } else {
            expect(attribute, `${tag}.${field.name} does not reflect`).toBeNull();
          }
        });
      }
    });

    it('declares exactly the events the element defines', async () => {
      const ctor = customElements.get(tag) as unknown as {
        events?: Record<string, { type: string }>;
      };
      const defined = Object.values(ctor.events ?? {}).map((e) => e.type);
      const declared = (declaration.events ?? []).map((e) => e.name);
      for (const name of declared)
        await verify(tag, id('event', name, 'defined'), () => expect(defined).toContain(name));
      await verify(tag, `component:${declaration.tagName}/events`, () =>
        expect(defined.sort()).toEqual(declared.sort()),
      );
    });

    const authored = options.examples?.[declaration.tagName] as
      { examples: Record<string, unknown> } | undefined;
    // Without authored examples there is nothing to render slots and parts from: their cases are
    // recorded as not executed, never as passed.
    it.skipIf(!authored)(
      'every slot and part appears in at least one authored example',
      async () => {
        // The same authored examples, mounted as this implementation.
        const set = { ...authored!, component: tag };
        const slots = new Set<string>();
        const parts = new Set<string>();
        for (const name of Object.keys(set.examples)) {
          const frame = document.createElement('div');
          frame.style.inlineSize = '1000px';
          document.body.append(frame);
          const mounted = await mountExample(set as never, name, frame);
          await settle(mounted.element as unknown as Host);
          const root = mounted.element.shadowRoot!;
          for (const slot of root.querySelectorAll('slot')) slots.add(slot.name);
          for (const el of root.querySelectorAll('[part]'))
            for (const part of el.getAttribute('part')!.split(/\s+/)) parts.add(part);
          mounted.dispose();
          frame.remove();
        }
        for (const slot of declaration.slots ?? [])
          await verify(tag, id('slot', slot.name || 'default', 'rendered'), () =>
            expect(slots.has(slot.name), `${tag} slot "${slot.name}"`).toBe(true),
          );
        for (const part of declaration.cssParts ?? [])
          await verify(tag, id('part', part.name, 'rendered'), () =>
            expect(parts.has(part.name), `${tag} part "${part.name}"`).toBe(true),
          );
      },
    );
  });
  return declarations;
}
