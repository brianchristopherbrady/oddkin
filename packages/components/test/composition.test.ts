import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  NATIVE,
  validateComposition,
  type CompositionNode,
} from '../src/composition/index.js';

// ADR 0046 D3 (data-composition.md §8): the composition document, validated against the catalog
// generated from the published metadata; every diagnostic has a failing example here.

const repo = new URL('../../../', import.meta.url);
const doc = (...root: unknown[]) => ({ version: 1, root });
const codes = (document: unknown) =>
  validateComposition(document).diagnostics.map((d) => [d.code, d.path]);

describe('validateComposition', () => {
  it('accepts a document of published elements, natives, text, and action names', () => {
    const result = validateComposition({
      $schema: 'https://oddkin.dev/schemas/composition/composition.v1.json',
      version: 1,
      root: [
        {
          element: 'odd-card',
          id: 'profile',
          attributes: { appearance: 'filled', label: 'Profile' },
          children: [
            { element: 'h2', slot: 'header', children: ['Profile'] },
            { element: 'p', children: ['Signed in as ', { element: 'strong', children: ['Ada'] }] },
            {
              element: 'odd-input',
              attributes: { label: 'Name', name: 'name', required: true, maxlength: 80 },
              properties: { value: 'Ada', strings: { clear: 'Clear name' } },
            },
            {
              element: 'odd-button',
              slot: 'footer',
              attributes: { appearance: 'primary', type: 'button' },
              actions: { click: 'profile.save' },
              children: ['Save'],
            },
          ],
        },
        {
          element: 'odd-side-nav',
          attributes: { label: 'Primary', current: 'home' },
          properties: {
            items: [
              { kind: 'link', id: 'home', label: 'Home', href: '/' },
              { kind: 'action', id: 'new', label: 'New project', action: 'project.create' },
            ],
          },
          actions: { 'odd-action': 'navigation.run' },
        },
        { element: 'ul', children: [{ element: 'li', children: ['One'] }] },
        'Plain <b>text</b> stays text.',
      ],
    });
    expect([result.ok, result.diagnostics]).toEqual([true, []]);
  });

  it('reports the document shape, versions, and node shapes', () => {
    expect(codes('nope')).toEqual([['composition.node.invalid', '/']]);
    expect(codes({ version: 2, root: [], html: '<p>' })).toEqual([
      ['composition.key.unknown', '/html'],
      ['composition.version.unsupported', '/version'],
    ]);
    expect(codes({ version: 1, root: {} })).toEqual([['composition.node.invalid', '/root']]);
    expect(codes(doc(42, { tag: 'p' }, new (class {})()))).toEqual([
      ['composition.node.invalid', '/root/0'],
      ['composition.key.unknown', '/root/1/tag'],
      ['composition.required.missing', '/root/1/element'],
      ['composition.node.invalid', '/root/2'],
    ]);
  });

  it('accepts only published elements and the native text elements, each where it belongs', () => {
    expect(
      codes(
        doc(
          { element: 'odd-nope' },
          { element: 'script', children: ['alert(1)'] },
          { element: 'iframe' },
          JSON.parse('{"element":"__proto__"}'),
          { element: 'li' },
          { element: 'ul', children: ['loose text', { element: 'odd-badge' }, { element: 'p' }] },
        ),
      ),
    ).toEqual([
      ['composition.element.unknown', '/root/0/element'],
      ['composition.element.unknown', '/root/1/element'],
      ['composition.element.unknown', '/root/2/element'],
      ['composition.element.unknown', '/root/3/element'],
      ['composition.element.misplaced', '/root/4/element'],
      ['composition.text.unsupported', '/root/5/children/0'],
      ['composition.element.misplaced', '/root/5/children/1/element'],
      ['composition.element.misplaced', '/root/5/children/2/element'],
    ]);
  });

  it('checks slots against the parent and text against its default slot', () => {
    expect(
      codes(
        doc(
          { element: 'p', slot: 'header' },
          {
            element: 'odd-card',
            children: [
              { element: 'h2', slot: 'title' },
              { element: 'h2', slot: '' },
              { element: 'odd-badge', slot: 'header', children: ['New'] },
            ],
          },
          { element: 'odd-input', children: ['text'] },
        ),
      ),
    ).toEqual([
      ['composition.slot.unknown', '/root/0/slot'],
      ['composition.slot.unknown', '/root/1/children/0/slot'],
      ['composition.slot.unknown', '/root/1/children/1/slot'],
      ['composition.children.unsupported', '/root/2/children'],
    ]);
    // Without a default slot, every child names one.
    expect(
      codes(
        doc({
          element: 'odd-split-panel',
          children: [{ element: 'p' }, { element: 'p', slot: 'end' }],
        }),
      ),
    ).toEqual([['composition.slot.missing', '/root/0/children/0']]);
  });

  it('checks ids for shape and uniqueness', () => {
    expect(
      codes(doc({ element: 'p', id: 'a' }, { element: 'p', id: 'a' }, { element: 'p', id: '1x' })),
    ).toEqual([
      ['composition.id.duplicate', '/root/1/id'],
      ['composition.id.invalid', '/root/2/id'],
    ]);
  });

  it('checks attributes by their published types and refuses executable ones', () => {
    const result = validateComposition(
      doc({
        element: 'odd-button',
        attributes: {
          onclick: 'alert(1)',
          style: 'color: red',
          appearance: 'loud',
          disabled: 'yes',
          formaction: 'javascript:alert(1)',
          href: '/',
          form: 'f',
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['composition.value.executable', '/root/0/attributes/onclick'],
      ['composition.value.executable', '/root/0/attributes/style'],
      ['model.value.invalid', '/root/0/attributes/appearance'],
      ['model.type.mismatch', '/root/0/attributes/disabled'],
      ['model.url.unsafe', '/root/0/attributes/formaction'],
      ['composition.attribute.unknown', '/root/0/attributes/href'],
      // A read-only property is no attribute either.
      ['composition.attribute.unknown', '/root/0/attributes/form'],
    ]);
    expect(result.diagnostics[2]?.suggestion).toBe('Use one of: "primary", "secondary", "ghost".');
    expect(codes(doc({ element: 'odd-input', attributes: { maxlength: 'ten' } }))).toEqual([
      ['model.type.mismatch', '/root/0/attributes/maxlength'],
    ]);
    expect(
      codes(doc({ element: 'a', attributes: { href: ' javascript:x', target: '_new' } })),
    ).toEqual([
      ['model.url.unsafe', '/root/0/attributes/href'],
      ['model.value.invalid', '/root/0/attributes/target'],
    ]);
  });

  it('separates attributes from properties, and refuses properties JSON cannot carry', () => {
    expect(
      codes(
        doc(
          { element: 'odd-checkbox', attributes: { checked: true }, properties: { checked: true } },
          { element: 'odd-combobox', attributes: { values: [] } },
          {
            element: 'odd-button',
            properties: { fullWidth: true, innerHTML: '<img onerror=alert(1)>' },
          },
          { element: 'odd-side-nav', properties: { renderLabel: 'x', kinds: {} } },
          { element: 'odd-popover', properties: { anchorElement: null } },
          { element: 'p', properties: { textContent: 'x' } },
          { element: 'odd-input', properties: { value: 3, strings: { clear: 1, nope: 'x' } } },
        ),
      ),
    ).toEqual([
      ['composition.attribute.propertyOnly', '/root/1/attributes/values'],
      ['composition.property.useAttribute', '/root/2/properties/fullWidth'],
      ['composition.property.unknown', '/root/2/properties/innerHTML'],
      ['composition.property.notPortable', '/root/3/properties/renderLabel'],
      ['composition.property.notPortable', '/root/3/properties/kinds'],
      ['composition.property.notPortable', '/root/4/properties/anchorElement'],
      ['composition.property.unknown', '/root/5/properties'],
      ['model.type.mismatch', '/root/6/properties/value'],
      ['model.type.mismatch', '/root/6/properties/strings/clear'],
      ['model.property.unknown', '/root/6/properties/strings/nope'],
    ]);
  });

  it('validates model values with the model, rules included', () => {
    expect(
      codes(
        doc({
          element: 'odd-side-nav',
          properties: {
            items: [
              { kind: 'link', id: 'a', label: ' ', href: 'javascript:x' },
              { kind: 'action', id: 'a', label: 'B', action: 'alert(1)' },
            ],
          },
        }),
      ),
    ).toEqual([
      ['model.label.empty', '/root/0/properties/items/0/label'],
      ['model.url.unsafe', '/root/0/properties/items/0/href'],
      ['model.ref.invalid', '/root/0/properties/items/1/action'],
    ]);
    // Rules run on data the schema accepts.
    expect(
      codes(
        doc({
          element: 'odd-side-nav',
          properties: {
            items: [
              { kind: 'link', id: 'a', label: 'A', href: '/a' },
              { kind: 'link', id: 'a', label: 'B', href: '/b' },
            ],
          },
        }),
      ),
    ).toEqual([['model.id.duplicate', '/root/0/properties/items/1/id']]);
  });

  it('maps only published events, to action names', () => {
    expect(
      codes(
        doc(
          { element: 'odd-button', actions: { change: 'alert(1)', input: 'form.edit' } },
          { element: 'odd-card', actions: { click: 'card.open' } },
          { element: 'a', actions: { click: 'x' } },
          { element: 'odd-button', actions: [] },
        ),
      ),
    ).toEqual([
      ['composition.action.invalid', '/root/0/actions/change'],
      ['composition.action.unknown', '/root/1/actions/click'],
      ['composition.action.unknown', '/root/2/actions'],
      ['composition.node.invalid', '/root/3/actions'],
    ]);
  });

  it('bounds depth and size', () => {
    let deep: CompositionNode = 'leaf';
    for (let i = 0; i < 17; i++) deep = { element: 'span', children: [deep] };
    expect(codes(doc(deep))).toEqual([
      ['composition.depth.exceeded', `/root/0${'/children/0'.repeat(15)}/children`],
    ]);
    expect(validateComposition(doc(deep), { limits: { depth: 20 } }).ok).toBe(true);
    const many = Array.from({ length: 501 }, () => 'x');
    expect(codes(doc(...many))).toEqual([['composition.size.exceeded', '/root/500']]);
    expect(validateComposition(doc(...many), { limits: { nodes: 501 } }).ok).toBe(true);
  });
});

describe('the generated catalog and schemas', () => {
  const schemaDir = new URL('packages/components/schemas/composition/', repo);
  const schemas = readdirSync(schemaDir).map(
    (file) => JSON.parse(readFileSync(new URL(file, schemaDir), 'utf8')) as { $id: string },
  );
  const ajv = new Ajv2020({ strict: false });
  addFormats.default(ajv);
  ajv.addSchema(
    JSON.parse(
      readFileSync(new URL('packages/components/schemas/oddkin.navigation.v1.json', repo), 'utf8'),
    ),
  );
  for (const schema of schemas) ajv.addSchema(schema);
  const validate = ajv.getSchema('https://oddkin.dev/schemas/composition/composition.v1.json')!;

  it('are current with the published metadata (build-composition-schemas --check)', () => {
    const script = fileURLToPath(new URL('scripts/build-composition-schemas.mjs', repo));
    expect(() =>
      execFileSync(process.execPath, [script, '--check'], {
        cwd: fileURLToPath(repo),
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('describe every published element and native, one schema each plus the document', () => {
    const metadata = JSON.parse(
      readFileSync(new URL('packages/components/oddkin.metadata.json', repo), 'utf8'),
    ) as { components: Record<string, { tag: string }> };
    const tags = Object.values(metadata.components).map((c) => c.tag);
    expect(Object.keys(CATALOG).sort()).toEqual(tags.sort());
    expect(schemas.map((s) => s.$id.split('/').pop()).sort()).toEqual(
      ['composition.v1.json', ...tags.map((tag) => `${tag}.v1.json`)].sort(),
    );
    expect(Object.keys(NATIVE)).not.toContain('script');
  });

  it('agree with validateComposition on valid and invalid documents', () => {
    const valid = doc(
      {
        element: 'odd-card',
        attributes: { appearance: 'filled' },
        children: [{ element: 'h2', slot: 'header', children: ['Title'] }, 'Body'],
      },
      { element: 'odd-button', attributes: { disabled: true }, actions: { change: 'a.b' } },
    );
    expect([validate(valid), validateComposition(valid).ok]).toEqual([true, true]);
    for (const invalid of [
      doc({ element: 'odd-nope' }),
      doc({ element: 'odd-button', attributes: { onclick: 'x' } }),
      doc({ element: 'odd-button', attributes: { appearance: 'loud' } }),
      doc({ element: 'odd-button', attributes: { formaction: 'javascript:x' } }),
      doc({ element: 'odd-input', children: ['x'] }),
      doc({ element: 'odd-select', properties: { renderValue: 1 } }),
      doc({ element: 'odd-button', actions: { change: 'alert(1)' } }),
      { version: 2, root: [] },
    ]) {
      expect([validate(invalid), validateComposition(invalid).ok], JSON.stringify(invalid)).toEqual(
        [false, false],
      );
    }
  });
});
