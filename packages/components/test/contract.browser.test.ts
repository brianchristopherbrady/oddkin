/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import type { CSSResult } from '@oddkin/core/styles';
import '../src/button/button.define.js';
import '../src/card/card.define.js';
import '../src/input/input.define.js';
import '../src/side-nav/side-nav.define.js';
import button from '../src/button/button.examples.js';
import card from '../src/card/card.examples.js';
import input from '../src/input/input.examples.js';
import sideNav from '../src/side-nav/side-nav.examples.js';
import {
  create,
  describeCemContract,
  fields,
  settle,
  track,
  type Host,
} from '../../../tests/contract/cem-contract.js';
import { definitions, derivedSkin, derivedTag } from './derived.js';

// The published custom-elements.json describes what the browser does, for each foundation
// element and for a derived implementation of it (tests/contract/cem-contract.ts). Passing facts
// become `verified` provenance through `npm run verify:metadata`.
const declarations = await describeCemContract({
  manifestUrl: new URL('../custom-elements.json', import.meta.url),
  packageUrl: new URL('../package.json', import.meta.url),
  packageDir: 'packages/components',
  // The files this page runs: the package's sources and the development builds of core and
  // tokens (the `development` export condition); scripts/verification.mjs hashes the same set.
  sources: {
    ...import.meta.glob<string>('../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
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
  },
  implementations: (declaration) => [declaration.tagName, derivedTag(declaration.tagName)],
  examples: { 'odd-button': button, 'odd-card': card, 'odd-input': input, 'odd-side-nav': sideNav },
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
        track(form);
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
