// ADR 0043 spike: composites render the product's children through their definition's roles
// (`@oddkin/core/template/roles`), ported from research/experiments/composite.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { setErrorHandler } from '../src/diagnostics/index.js';
import {
  OddkinElement,
  compose,
  define,
  prop,
  type ElementDefinition,
} from '../src/element/index.js';
import { flush } from '../src/reactive/index.js';
import { scopeStats } from '../src/scope/index.js';
import { html, render, repeat } from '../src/template/index.js';
import { composite, rolesOf, tag } from '../src/template/roles.js';

class RowField extends OddkinElement.with({
  label: prop.string({ default: '' }),
  value: prop.string({ default: '' }),
}) {}
class RowButton extends OddkinElement.with({ disabled: prop.boolean() }) {}

const fieldTemplate = (host: RowField) =>
  html`<label>${host.label} <input .value=${host.value} /></label>`;
const buttonTemplate = (host: RowButton) =>
  html`<button type="button" ?disabled=${host.disabled}><slot></slot></button>`;

interface Family {
  readonly field: ElementDefinition<RowField>;
  readonly button: ElementDefinition<RowButton>;
}
const family = (prefix: string): Family => ({
  field: compose({
    name: `${prefix}-field`,
    element: class extends RowField {},
    template: fieldTemplate,
  }),
  button: compose({
    name: `${prefix}-button`,
    element: class extends RowButton {},
    template: buttonTemplate,
  }),
});
const oddkin = family('roles-odd');
const studio = family('roles-studio');

interface Member {
  readonly id: string;
  readonly name: string;
}

class MemberRows extends OddkinElement.with({ members: prop.array<Member>() }) {
  move(id: string, by: number): void {
    const list = [...this.members];
    const from = list.findIndex((m) => m.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to]!, list[from]!];
    this.members = list;
  }
}

// One template for every family: the roles come from the definition's dependencies.
const rowsTemplate = (host: MemberRows) => {
  const roles = rolesOf<'field' | 'button'>(host);
  return html`<ol>
    ${repeat(
      host.members,
      (m) => m.id,
      (m, i) =>
        composite`<li data-key=${m.id}>
          <${roles.field} label="Name" .value=${m.name}></${roles.field}>
          <${roles.button} ?disabled=${i === 0} @click=${() => host.move(m.id, -1)}
            >Move up</${roles.button}
          >
        </li>`,
    )}
  </ol>`;
};

const rows = (name: string, children: Family) =>
  compose({
    name,
    element: class extends MemberRows {},
    template: rowsTemplate,
    dependencies: { field: children.field, button: children.button },
  });
const composites = {
  oddkin: rows('roles-rows-odd', oddkin),
  studio: rows('roles-rows-studio', studio),
};
const families = { oddkin, studio };
for (const definition of Object.values(composites)) define(definition);

const MEMBERS: readonly Member[] = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'grace', name: 'Grace Hopper' },
  { id: 'katherine', name: 'Katherine Johnson' },
];

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

const keys = (host: MemberRows) =>
  [...host.shadowRoot!.querySelectorAll('li')].map((li) => li.dataset['key']);
const children = (host: MemberRows, id: string) =>
  [...host.shadowRoot!.querySelector(`li[data-key="${id}"]`)!.children] as [RowField, RowButton];
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('composite roles (ADR 0043)', () => {
  it.each(['oddkin', 'studio'] as const)(
    "renders the %s family's children, upgraded and wired",
    async (key) => {
      const own = families[key];
      const other = families[key === 'oddkin' ? 'studio' : 'oddkin'];
      const host = await mount(composites[key].name);
      expect(keys(host)).toEqual(['ada', 'grace', 'katherine']);
      const [field, button] = children(host, 'grace');
      expect([field.localName, button.localName]).toEqual([own.field.name, own.button.name]);
      expect(field).toBeInstanceOf(own.field.element);
      expect([field.label, field.value]).toEqual(['Name', 'Grace Hopper']);
      expect(children(host, 'ada')[1].disabled).toBe(true);
      expect(button.disabled).toBe(false);
      expect(
        host.shadowRoot!.querySelector(`${other.field.name}, ${other.button.name}`),
      ).toBeNull();
      button.click();
      await settle(host);
      expect(keys(host)).toEqual(['grace', 'ada', 'katherine']);
      expect(children(host, 'grace')[1].disabled).toBe(true);
      expect(reported).toEqual([]);
    },
  );

  it('renders two families side by side, each with its own children', async () => {
    const odd = await mount(composites.oddkin.name);
    const stu = await mount(composites.studio.name);
    expect(odd.shadowRoot!.querySelectorAll(oddkin.field.name)).toHaveLength(3);
    expect(odd.shadowRoot!.querySelectorAll(studio.field.name)).toHaveLength(0);
    expect(stu.shadowRoot!.querySelectorAll(studio.field.name)).toHaveLength(3);
    expect(stu.shadowRoot!.querySelectorAll(oddkin.field.name)).toHaveLength(0);
  });

  it('keeps each child, its typed text, and focus through reorders and re-renders', async () => {
    const host = await mount(composites.studio.name);
    const [field] = children(host, 'grace');
    const control = field.shadowRoot!.querySelector('input')!;
    await userEvent.click(control);
    await userEvent.keyboard('{End} B.');
    const check = (label: string) => {
      expect(children(host, 'grace')[0], label).toBe(field);
      expect(field.shadowRoot!.activeElement, label).toBe(control);
      expect(host.shadowRoot!.activeElement, label).toBe(field);
      expect(control.value, label).toBe('Grace Hopper B.');
    };
    host.move('katherine', -1);
    await settle(host);
    expect(keys(host)).toEqual(['ada', 'katherine', 'grace']);
    check('after another row moved past it');
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
    const host = await mount(composites.oddkin.name);
    host.members = host.members.slice(1);
    await settle(host);
    expect(keys(host)).toEqual(['grace', 'katherine']);
    host.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });

  it('reuses one rewritten template per call site and family', () => {
    const odd = { field: tag(oddkin.field) };
    const stu = { field: tag(studio.field) };
    const row = (t: typeof odd, v: string) =>
      composite`<p><${t.field} .value=${v}></${t.field}></p>`;
    const a = row(odd, 'a');
    expect(row(odd, 'b').strings).toBe(a.strings);
    expect(row(stu, 'a').strings).not.toBe(a.strings);
    expect([...a.strings]).toEqual(['<p><roles-odd-field .value=', '></roles-odd-field></p>']);
    expect(a.values).toEqual(['a']);
    // Without references it is plain `html`, with the caller's own strings.
    const plain = composite`<p>${'x'}</p>`;
    expect([...plain.strings]).toEqual(['<p>', '</p>']);
  });

  it('accepts only validated names, and only in tag position', () => {
    const t = tag(oddkin.field);
    expect(code(() => tag({ ...oddkin.field, name: 'roles-odd-field onclick=x' }))).toBe(
      'template.tagRef.invalid',
    );
    expect(code(() => tag({ ...oddkin.field, name: 'x"><img src=x>' }))).toBe(
      'template.tagRef.invalid',
    );
    expect(code(() => composite`<p title=${t}></p>`)).toBe('template.tagRef.position');
    expect(code(() => composite`<${'roles-odd-field'}></roles-odd-field>`)).toBe(
      'template.tagRef.position',
    );
    // Core's own rule still applies to plain templates (checked when first rendered).
    expect(
      code(() => render(html`<${'odd-input'}></odd-input>`, document.createElement('div'))),
    ).toBe('template.binding.position');
  });

  it('reports a role the definition does not declare, and a host without a definition', () => {
    const host = document.createElement(composites.oddkin.name) as MemberRows;
    const roles = rolesOf<'field' | 'button' | 'icon'>(host);
    expect(rolesOf(host)).toBe(roles);
    expect(code(() => roles.icon)).toBe('definition.role.missing');
    class Unregistered extends MemberRows {}
    customElements.define('roles-unregistered', Unregistered);
    expect(code(() => rolesOf(new Unregistered()))).toBe('definition.role.unbound');
  });
});
