import { afterEach, describe, expect, it } from 'vitest';
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

const cem = (await (await fetch(new URL('../custom-elements.json', import.meta.url))).json()) as {
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

describe.each(implementations)('<$tag> matches the published CEM', ({ tag, declaration }) => {
  it('property defaults', async () => {
    const el = await create(tag);
    // Fields without a literal default (accessors such as odd-input's `value`) make no claim.
    for (const field of fields(declaration)) {
      const expected = literal(field.default);
      if (expected) expect(el[field.name], `${tag}.${field.name}`).toEqual(expected.value);
    }
  });

  it('attributes convert to their properties, including every allowed value', async () => {
    const ctor = customElements.get(tag) as unknown as { observedAttributes: string[] };
    for (const attribute of declaration.attributes ?? []) {
      expect(ctor.observedAttributes, `${tag}[${attribute.name}] observed`).toContain(
        attribute.name,
      );
      const field = fields(declaration).find((f) => f.name === attribute.fieldName)!;
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
    }
  });

  it('reflects exactly the properties marked as reflecting', async () => {
    for (const field of fields(declaration).filter((f) => f.attribute)) {
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
    }
  });

  it('declares exactly the events the element defines', () => {
    const ctor = customElements.get(tag) as unknown as {
      events?: Record<string, { type: string }>;
    };
    const defined = Object.values(ctor.events ?? {}).map((e) => e.type);
    expect(defined.sort()).toEqual((declaration.events ?? []).map((e) => e.name).sort());
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
      expect(slots.has(slot.name), `${tag} slot "${slot.name}"`).toBe(true);
    for (const part of declaration.cssParts ?? [])
      expect(parts.has(part.name), `${tag} part "${part.name}"`).toBe(true);
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
