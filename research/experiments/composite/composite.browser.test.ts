// Product-aware composite candidates (multi-product.md §8): the same keyed rows rendered with
// Oddkin's and a product's children, through element-reference parts, a child directive, and
// family-specific template factories.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { html, render } from '@oddkin/core/template';
import { Children } from './child.js';
import { oddkinFamily, studioFamily, type Family } from './family.js';
import { variants, type Member, type MemberRows } from './rows.js';
import { composite, tag } from './tag.js';

const MEMBERS: readonly Member[] = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'grace', name: 'Grace Hopper' },
  { id: 'katherine', name: 'Katherine Johnson' },
];
const families: Record<'oddkin' | 'studio', Family> = {
  oddkin: oddkinFamily,
  studio: studioFamily,
};
for (const mechanism of Object.values(variants))
  for (const definition of Object.values(mechanism)) define(definition);

let container: HTMLElement;
let reported: string[];
beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context.code ?? 'unknown'));
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
  setErrorHandler(undefined);
});

async function settle(host: MemberRows) {
  for (let i = 0; i < 2; i++) {
    flush();
    await host.updateComplete;
    await Promise.all(
      [...host.shadowRoot!.querySelectorAll('*')].map(
        (el) => (el as Element & { updateComplete?: Promise<unknown> }).updateComplete,
      ),
    );
  }
}

async function mount(name: string, members: readonly Member[] = MEMBERS) {
  const host = document.createElement(name) as MemberRows;
  host.members = [...members];
  container.append(host);
  await settle(host);
  return host;
}

const rows = (host: MemberRows) =>
  [...host.shadowRoot!.querySelectorAll('li')].map((li) => li.dataset['key']);
const row = (host: MemberRows, id: string) =>
  host.shadowRoot!.querySelector<HTMLLIElement>(`li[data-key="${id}"]`)!;
const children = (host: MemberRows, id: string) =>
  [...row(host, id).children] as (HTMLElement & Record<string, unknown>)[];

describe.each(['tag', 'child', 'literal'] as const)('%s mechanism', (mechanism) => {
  it.each(['oddkin', 'studio'] as const)(
    'renders the %s family’s children, upgraded and wired',
    async (key) => {
      const family = families[key];
      const host = await mount(variants[mechanism][key].name);
      expect(rows(host)).toEqual(['ada', 'grace', 'katherine']);
      const [input, button] = children(host, 'grace');
      expect([input!.localName, button!.localName]).toEqual([
        family.input.name,
        family.button.name,
      ]);
      expect(input).toBeInstanceOf(family.input.element);
      expect(button).toBeInstanceOf(family.button.element);
      expect([input!['label'], input!['name'], input!['value']]).toEqual([
        'Name',
        'member-name',
        'Grace Hopper',
      ]);
      expect(children(host, 'ada')[1]!['disabled']).toBe(true);
      expect(button!['disabled']).toBe(false);
      // The other family's tags never appear.
      const other = key === 'oddkin' ? studioFamily : oddkinFamily;
      expect(
        host.shadowRoot!.querySelector(`${other.input.name}, ${other.button.name}`),
      ).toBeNull();
      // Activating a child reaches the composite.
      button!.click();
      await settle(host);
      expect(rows(host)).toEqual(['grace', 'ada', 'katherine']);
      expect(children(host, 'grace')[1]!['disabled']).toBe(true);
      expect(reported).toEqual([]);
    },
  );

  it('renders two families side by side, each with its own children', async () => {
    const odd = await mount(variants[mechanism].oddkin.name);
    const studio = await mount(variants[mechanism].studio.name);
    expect(odd.shadowRoot!.querySelectorAll('odd-input')).toHaveLength(3);
    expect(odd.shadowRoot!.querySelectorAll('studio-input')).toHaveLength(0);
    expect(studio.shadowRoot!.querySelectorAll('studio-input')).toHaveLength(3);
    expect(studio.shadowRoot!.querySelectorAll('odd-input')).toHaveLength(0);
  });

  it('keeps each child, its typed text, and focus through reorders and re-renders', async () => {
    const host = await mount(variants[mechanism].studio.name);
    const [field] = children(host, 'grace');
    const control = (field!.shadowRoot as ShadowRoot).querySelector('input')!;
    await userEvent.click(control);
    await userEvent.keyboard('{End} B.');
    const check = (label: string) => {
      expect(children(host, 'grace')[0], label).toBe(field);
      expect(field!.shadowRoot!.activeElement, label).toBe(control);
      expect(host.shadowRoot!.activeElement, label).toBe(field);
      expect(control.value, label).toBe('Grace Hopper B.');
    };
    host.move('katherine', -1);
    await settle(host);
    expect(rows(host)).toEqual(['ada', 'katherine', 'grace']);
    check('after another row moved past it');
    // Fresh member objects with the same keys and values: a re-render, not a rebuild.
    host.members = host.members.map((m) => ({ ...m }));
    await settle(host);
    check('after a re-render with new objects');
    host.members = [{ id: 'new', name: '' }, ...host.members];
    await settle(host);
    check('after an insert above');
    expect(reported).toEqual([]);
  });

  it('releases rows and returns to its ownership baseline', async () => {
    const before = scopeStats();
    const host = await mount(variants[mechanism].oddkin.name);
    host.members = host.members.slice(1);
    await settle(host);
    expect(rows(host)).toEqual(['grace', 'katherine']);
    host.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});

describe('element-reference parts', () => {
  it('reuse one prepared template per call site and family', () => {
    const odd = { input: tag(oddkinFamily.input) };
    const studio = { input: tag(studioFamily.input) };
    const row = (t: typeof odd, v: string) =>
      composite`<p><${t.input} .value=${v}></${t.input}></p>`;
    const a = row(odd, 'a');
    expect(row(odd, 'b').strings).toBe(a.strings);
    expect(row(studio, 'a').strings).not.toBe(a.strings);
    expect([...a.strings]).toEqual(['<p><odd-input .value=', '></odd-input></p>']);
    expect(a.values).toEqual(['a']);
  });

  it('accept only validated names, and only in tag position', () => {
    const t = tag(oddkinFamily.input);
    expect(() => tag({ ...oddkinFamily.input, name: 'odd-input onclick=x' })).toThrow(
      /not a custom element name/,
    );
    expect(() => tag({ ...oddkinFamily.input, name: 'x"><img src=x>' })).toThrow();
    expect(() => composite`<p title=${t}></p>`).toThrow(/only accepted in tag position/);
    expect(() => composite`<${'odd-input'}></odd-input>`).toThrow(/not a tag\(\) reference/);
    // Core's own rule still applies to plain templates (checked when first rendered).
    expect(() => render(html`<${'odd-input'}></odd-input>`, document.createElement('div'))).toThrow(
      /tag-name position/,
    );
  });
});

describe('child directive', () => {
  it('creates once per key and role, writes only changed values, and forgets removed keys', () => {
    const c = new Children();
    const first = c.child('a', 'name', oddkinFamily.input, { props: { value: 'x' } });
    first.value = 'typed';
    const again = c.child('a', 'name', oddkinFamily.input, { props: { value: 'x' } });
    expect(again).toBe(first);
    expect(again.value).toBe('typed');
    c.child('a', 'name', oddkinFamily.input, { props: { value: 'y' } });
    expect(first.value).toBe('y');
    c.retain([]);
    expect(c.size).toBe(0);
    expect(c.child('a', 'name', oddkinFamily.input)).not.toBe(first);
    // @ts-expect-error props are typed against the element
    c.child('a', 'name', oddkinFamily.input, { props: { value: 3 } });
  });
});
