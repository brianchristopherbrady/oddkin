/// <reference types="vite/client" />
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { commands, server } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import type { CSSResult } from '@oddkin/core/styles';
import { mountExample } from '@oddkin/workbench/testing';
import '../src/button/button.define.js';
import '../src/card/card.define.js';
import '../src/input/input.define.js';
import '../src/side-nav/side-nav.define.js';
import button from '../src/button/button.examples.js';
import card from '../src/card/card.examples.js';
import input from '../src/input/input.examples.js';
import sideNav from '../src/side-nav/side-nav.examples.js';
import { definitions, derivedSkin, derivedTag } from './derived.js';

// The published custom-elements.json describes what the browser does: every default,
// attribute, allowed value, reflection, event, slot, and part is checked against live elements,
// for each foundation element and for a derived implementation of it.

interface Field {
  kind: string;
  name: string;
  type?: { text: string };
  default?: string;
  reflects?: boolean;
  attribute?: string;
  readonly?: boolean;
  static?: boolean;
}
interface Declaration {
  tagName?: string;
  members?: Field[];
  attributes?: { name: string; fieldName?: string }[];
  events?: { name: string }[];
  slots?: { name: string }[];
  cssParts?: { name: string }[];
}

const manifestUrl = new URL('../custom-elements.json', import.meta.url);
const manifestText = await (await fetch(manifestUrl)).text();
const cem = JSON.parse(manifestText) as {
  modules: { declarations?: Declaration[] }[];
};
const declarations = cem.modules
  .flatMap((module) => module.declarations ?? [])
  .filter((d): d is Declaration & { tagName: string } => !!d.tagName);
const examples = {
  'odd-button': button,
  'odd-card': card,
  'odd-input': input,
  'odd-side-nav': sideNav,
};
const implementations = declarations.flatMap((declaration) => [
  { tag: declaration.tagName, declaration },
  { tag: derivedTag(declaration.tagName), declaration },
]);

type Host = HTMLElement & Record<string, unknown> & { updateComplete: Promise<void> };
const created: Element[] = [];
afterEach(() => {
  for (const el of created.splice(0)) el.remove();
  flush();
});

async function create(tag: string): Promise<Host> {
  const el = document.createElement(tag) as Host;
  document.body.append(el);
  created.push(el);
  await settle(el);
  return el;
}
const settle = async (el: Host) => {
  flush();
  await el.updateComplete;
  flush();
};

/** Literal default from CEM text (`'md'`, `false`, `''`, `0`); undefined when not a literal. */
function literal(text: string | undefined): { value: unknown } | undefined {
  if (text === undefined) return undefined;
  const quoted = /^'(.*)'$/.exec(text) ?? /^"(.*)"$/.exec(text);
  if (quoted) return { value: quoted[1] };
  if (text === 'true' || text === 'false') return { value: text === 'true' };
  if (/^-?\d+(\.\d+)?$/.test(text)) return { value: Number(text) };
  return undefined;
}
const unionOf = (type: string | undefined) =>
  type && /^"[^"]*"( \| "[^"]*")*$/.test(type)
    ? [...type.matchAll(/"([^"]*)"/g)].map((m) => m[1]!)
    : undefined;

const fields = (d: Declaration) =>
  (d.members ?? []).filter((m) => m.kind === 'field' && !m.static && !m.readonly);

// ---- evidence (metadata-and-analyzer.md §3: `verified` provenance) ----
// Each foundation element gets one conformance-result.v1 record per engine, tied to the exact
// manifest text and implementation sources tested; `npm run verify:metadata` attaches passing
// facts to oddkin.metadata.json only while both still match. Derived tags record nothing.
const SUITE = { id: 'oddkin.cem-contract', version: '1.0.0' };
const sha256 = async (text: string) =>
  `sha256-${[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
// The implementation under test: the files this page ran (component sources, and the development
// builds of core and tokens the `development` export condition selects), hashed the way
// `npm run verify:metadata` hashes them from disk: repository-relative paths, sorted. If the two
// file sets ever differ, the hashes differ and nothing is verified.
const sources = {
  ...import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>(['../../core/dist/**/*.js', '!../../core/dist/prod/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../tokens/dist/**/*.js', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};
const sourcesHash = await sha256(
  Object.entries(sources)
    .map(
      ([path, text]) =>
        [
          path.replace(/^\.\.\/\.\.\//, 'packages/').replace(/^\.\.\//, 'packages/components/'),
          text,
        ] as const,
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, text]) => `${path}\n${text}\n`)
    .join(''),
);
const manifestHash = await sha256(manifestText);
const pkg = (await (await fetch(new URL('../package.json', import.meta.url))).json()) as {
  name: string;
  version: string;
};

type Outcome = { state: 'passed' } | { state: 'failed'; message: string };
const evidence = new Map(declarations.map((d) => [d.tagName, new Map<string, Outcome>()]));
const eventSet = (tag: string) => `component:${tag}/events`;
/** Every case the checks below record for a foundation element, in a stable order. */
function cases(d: Declaration & { tagName: string }): string[] {
  const tag = d.tagName;
  return [
    ...fields(d).flatMap((f) => [
      ...(literal(f.default) ? [`property:${tag}#${f.name}/default`] : []),
      ...(f.attribute
        ? [`property:${tag}#${f.name}/attribute`, `property:${tag}#${f.name}/reflects`]
        : []),
    ]),
    ...(d.events ?? []).map((e) => `event:${tag}#${e.name}/defined`),
    eventSet(tag),
    ...(d.slots ?? []).map((s) => `slot:${tag}#${s.name || 'default'}/rendered`),
    ...(d.cssParts ?? []).map((p) => `part:${tag}#${p.name}/rendered`),
  ];
}
/** Run a check; for a foundation tag, record its outcome under `id` (failures still throw). */
async function verify(tag: string, id: string, check: () => unknown): Promise<void> {
  const recorded = evidence.get(tag);
  try {
    await check();
    recorded?.set(id, { state: 'passed' });
  } catch (error) {
    recorded?.set(id, { state: 'failed', message: String((error as Error).message).slice(0, 500) });
    throw error;
  }
}
const browserVersion = () =>
  (server.browser === 'firefox'
    ? /Firefox\/([\d.]+)/
    : server.browser === 'webkit'
      ? /Version\/([\d.]+)/
      : /Chrome\/([\d.]+)/
  ).exec(navigator.userAgent)?.[1] ?? 'unknown';

afterAll(async () => {
  const date = new Date().toISOString();
  for (const declaration of declarations) {
    const recorded = evidence.get(declaration.tagName)!;
    const record = {
      schema: 'https://oddkin.dev/schemas/conformance-result/v1.json',
      suite: SUITE,
      implementation: { tag: declaration.tagName, package: `${pkg.name}@${pkg.version}` },
      configuration: {
        browser: server.browser,
        browserVersion: browserVersion(),
        manifest: manifestHash,
        sources: sourcesHash,
      },
      environment: { userAgent: navigator.userAgent },
      date,
      results: cases(declaration).map((id) => ({
        case: id,
        ...(recorded.get(id) ?? { state: 'not-executed' }),
      })),
    };
    await commands.writeFile(
      `packages/components/.oddkin/verification/${SUITE.id}/${server.browser}/${declaration.tagName}.json`,
      `${JSON.stringify(record, null, 2)}\n`,
    );
  }
});

describe.each(implementations)('<$tag> matches the published CEM', ({ tag, declaration }) => {
  const id = (kind: string, name: string, aspect: string) =>
    `${kind}:${declaration.tagName}#${name}/${aspect}`;

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
            : (union?.find((v) => v !== literal(field.default)?.value) ?? 'Sample text');
        el[field.name] = value;
        await settle(el);
        const attribute = el.getAttribute(field.attribute!);
        if (field.reflects) {
          expect(attribute, `${tag}.${field.name} reflects`).toBe(value === true ? '' : value);
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
    await verify(tag, eventSet(declaration.tagName), () =>
      expect(defined.sort()).toEqual(declared.sort()),
    );
  });

  it('every slot and part appears in at least one authored example', async () => {
    const authored = examples[declaration.tagName as keyof typeof examples];
    expect(authored, `${tag} has examples`).toBeDefined();
    // The same authored examples, mounted as this implementation.
    const set = { ...authored, component: tag };
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
  });
});

describe.each(Object.entries(definitions))(
  '%s and its derived implementation',
  (tag, definition) => {
    it('public methods and read-only members give the same results in a form', async () => {
      const declaration = declarations.find((d) => d.tagName === tag)!;
      const members = declaration.members ?? [];
      const methods = members
        .filter((m) => m.kind === 'method' && !m.static && !m.name.endsWith('Callback'))
        .map((m) => m.name);
      const getters = members.filter((m) => m.kind === 'field' && m.readonly).map((m) => m.name);
      // Boolean attributes except the two that bar an element from constraint validation.
      const constraints = (declaration.attributes ?? []).filter((attribute) => {
        const field = fields(declaration).find((f) => f.name === attribute.fieldName);
        return (
          field?.type?.text === 'boolean' && !['disabled', 'readonly'].includes(attribute.name)
        );
      });
      const snapshot = async (name: string, constrained: boolean) => {
        const form = document.createElement('form');
        document.body.append(form);
        created.push(form);
        const el = document.createElement(name) as Host;
        if (constrained) for (const attribute of constraints) el.setAttribute(attribute.name, '');
        form.append(el);
        await settle(el);
        const normalize = (value: unknown): unknown =>
          value === form
            ? 'owner form'
            : value instanceof ValidityState
              ? Object.fromEntries(
                  Object.keys(ValidityState.prototype).map((k) => [
                    k,
                    value[k as keyof ValidityState],
                  ]),
                )
              : value;
        return {
          methods: Object.fromEntries(
            methods.map((m) => [m, normalize((el[m] as () => unknown).call(el))]),
          ),
          getters: Object.fromEntries(getters.map((g) => [g, normalize(el[g])])),
        };
      };
      for (const constrained of [false, true]) {
        const expected = await snapshot(tag, constrained);
        expect(await snapshot(derivedTag(tag), constrained), `constrained ${constrained}`).toEqual(
          expected,
        );
        if (getters.includes('form')) expect(expected.getters['form']).toBe('owner form');
        // The comparison covers an invalid state, not only the default valid one.
        if (methods.includes('checkValidity'))
          expect(expected.methods['checkValidity']).toBe(!constrained);
      }
    });

    it('reuse one sheet per shared style source and never modify it', async () => {
      const shared = (definition.styles as readonly CSSResult[]).slice(0, -1);
      const before = shared.map((style) => style.sheetFor(document)!);
      const text = before.map((sheet) => [...sheet.cssRules].map((rule) => rule.cssText).join());
      const elements = [];
      for (let i = 0; i < 3; i++) {
        elements.push(await create(tag), await create(derivedTag(tag)));
      }
      for (const el of elements) {
        for (const sheet of before) expect(el.shadowRoot!.adoptedStyleSheets).toContain(sheet);
      }
      const [original, derived] = elements as [Host, Host];
      expect(derived.shadowRoot!.adoptedStyleSheets).toContain(derivedSkin.sheetFor(document));
      expect(original.shadowRoot!.adoptedStyleSheets).not.toContain(derivedSkin.sheetFor(document));
      expect(shared.map((style) => style.sheetFor(document))).toEqual(before);
      expect(before.map((sheet) => [...sheet.cssRules].map((rule) => rule.cssText).join())).toEqual(
        text,
      );
    });
  },
);
