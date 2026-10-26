import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCheckbox } from '../src/checkbox/checkbox.js';
import type { OddkinCheckboxGroup } from '../src/checkbox-group/checkbox-group.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/checkbox-group/checkbox-group.define.js');
});
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  container.remove();
  flush();
  await userEvent.unhover(document.body);
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
};
const CHOICES =
  '<odd-checkbox name="channel" value="email">Email</odd-checkbox><odd-checkbox name="channel" value="desktop">Desktop</odd-checkbox><odd-checkbox name="channel" value="summary">Weekly summary</odd-checkbox>';

async function mount(markup: string) {
  container.innerHTML = markup;
  const group = container.querySelector('odd-checkbox-group') as OddkinCheckboxGroup;
  const choices = [...container.querySelectorAll('odd-checkbox')] as OddkinCheckbox[];
  await settle(group);
  for (const choice of choices) await settle(choice);
  const part = (name: string) => group.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const box = (choice: OddkinCheckbox) => choice.shadowRoot!.querySelector('input')!;
  return { group, choices, part, box, form: container.querySelector('form') };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/checkbox-group/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinCheckboxGroup',
        'checkboxGroupStructuralStyles',
        'checkboxGroupTemplate',
        'fieldStructuralStyles',
        'hostStyles',
      ].sort(),
    );
    const index = await import('../src/checkbox-group/index.js');
    expect(Object.keys(index)).toContain('checkboxGroupDefinition');
  });
});

describe('odd-checkbox-group', () => {
  it('is a group named by its legend, described by description and error, holding its choices', async () => {
    const { group, part } = await mount(
      `<odd-checkbox-group label="Notifications" description="Choose how to hear from us.">${CHOICES}</odd-checkbox-group>`,
    );
    const role = page.getByRole('group', { name: 'Notifications', exact: true });
    expect(role.element()).toBe(part('field'));
    expect(part('field').querySelector('slot')!.assignedElements()).toHaveLength(3);
    expect(part('field').getAttribute('aria-describedby')).toBe('description');
    group.error = 'Choose at least one.';
    await settle(group);
    expect(part('field').getAttribute('aria-describedby')).toBe('description error');
    expect([part('field').getAttribute('aria-invalid'), part('error').hidden]).toEqual([
      'true',
      false,
    ]);
  });

  it('takes the Tab order of its choices, as checkboxes in a fieldset do', async () => {
    const { choices } = await mount(
      `<button id="before">Before</button><odd-checkbox-group label="Notifications">${CHOICES}</odd-checkbox-group><button id="after">After</button>`,
    );
    container.querySelector<HTMLButtonElement>('#before')!.focus();
    const stops: string[] = [];
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      stops.push(document.activeElement!.id || (document.activeElement as OddkinCheckbox).value);
    }
    expect(stops).toEqual(['email', 'desktop', 'summary', 'after']);
    expect(choices).toHaveLength(3);
  });

  it('lines its choices up when horizontal and puts one target height between stacked ones', async () => {
    const { group, choices, part } = await mount(
      `<odd-checkbox-group label="Notifications">${CHOICES}</odd-checkbox-group>`,
    );
    const style = getComputedStyle(part('control'));
    expect([style.rowGap, style.paddingTop]).toEqual([
      themeValue('row-gap', '--odd-space-lg'),
      themeValue('padding-top', '--odd-space-sm'),
    ]);
    const tops = () => choices.map((c) => Math.round(c.getBoundingClientRect().top));
    expect(new Set(tops()).size).toBe(3);
    group.orientation = 'horizontal';
    await settle(group);
    expect(new Set(tops()).size).toBe(1);
  });
});

describe('layout', () => {
  it('stacks the choices at their own width, or lines them up and wraps them', async () => {
    container.style.inlineSize = '240px';
    const { group, choices } = await mount(
      `<odd-checkbox-group label="Channels">${CHOICES}</odd-checkbox-group>`,
    );
    const box = (el: Element) => el.getBoundingClientRect();
    const options = group.shadowRoot!.querySelector('[part="control"]')!;
    expect(box(choices[0]!).width).toBeLessThan(box(options).width);
    expect(box(choices[1]!).top).toBeGreaterThan(box(choices[0]!).top);
    group.setAttribute('orientation', 'horizontal');
    await settle(group);
    expect(box(choices[1]!).top).toBe(box(choices[0]!).top);
    // The choice that does not fit wraps to the next line.
    expect(box(choices[2]!).top).toBeGreaterThan(box(choices[0]!).top);
  });
});

describe('forms', () => {
  it('submits each choice under its own name and nothing for the group', async () => {
    const { group, choices, form } = await mount(
      `<form><odd-checkbox-group label="Notifications" name="group">${CHOICES}</odd-checkbox-group></form>`,
    );
    expect(group.form).toBe(form);
    await userEvent.click(choices[0]!);
    await userEvent.click(choices[2]!);
    expect([...new FormData(form!)]).toEqual([
      ['channel', 'email'],
      ['channel', 'summary'],
    ]);
  });

  it('a required group needs one checked choice, with the native message for an unchosen set', async () => {
    const { group, choices, box, form } = await mount(
      `<form><odd-checkbox-group label="Notifications" required><p>Pick any.</p>${CHOICES}</odd-checkbox-group><input type="radio" name="native" required></form>`,
    );
    const native = form!.querySelector<HTMLInputElement>('input[name="native"]')!;
    native.remove();
    expect([group.validity.valueMissing, group.validationMessage]).toEqual([
      true,
      native.validationMessage,
    ]);
    expect(form!.checkValidity()).toBe(false);
    choices[1]!.checked = true;
    await settle(group);
    expect(group.validity.valid).toBe(true);
    choices[1]!.checked = false;
    group.required = false;
    await settle(group);
    expect(group.validity.valid).toBe(true);
    group.required = true;
    await settle(group);
    // A blocked submission moves focus to the first enabled choice.
    choices[0]!.disabled = true;
    await settle(choices[0]!);
    let submitted = false;
    form!.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    form!.requestSubmit();
    await settle(group);
    expect(submitted).toBe(false);
    expect(choices[1]!.shadowRoot!.activeElement).toBe(box(choices[1]!));
  });

  it('shows user-invalid after focus leaves a required group empty, not while moving inside it', async () => {
    const { group, choices, part } = await mount(
      `<odd-checkbox-group label="Notifications" required>${CHOICES}</odd-checkbox-group><button id="after">After</button>`,
    );
    choices[0]!.focus();
    await userEvent.tab();
    await settle(group);
    expect(group.matches(':state(user-invalid)')).toBe(false);
    container.querySelector<HTMLButtonElement>('#after')!.focus();
    await settle(group);
    expect([
      group.matches(':state(user-invalid)'),
      part('field').getAttribute('aria-invalid'),
    ]).toEqual([true, 'true']);
    await userEvent.click(choices[0]!);
    await settle(group);
    expect(group.matches(':state(user-invalid)')).toBe(false);
  });

  it('disabled disables its enabled choices and restores only those, including choices that come and go', async () => {
    const { group, choices } = await mount(
      `<form><odd-checkbox-group label="Notifications" required><odd-checkbox name="a" value="1" checked>One</odd-checkbox><odd-checkbox name="b" disabled>Two</odd-checkbox></odd-checkbox-group></form>`,
    );
    const form = container.querySelector('form')!;
    group.disabled = true;
    await settle(group);
    expect(choices.map((c) => c.disabled)).toEqual([true, true]);
    expect([...new FormData(form)]).toEqual([]);
    const late = document.createElement('odd-checkbox') as OddkinCheckbox;
    late.textContent = 'Late';
    group.append(late);
    await settle(group);
    expect(late.disabled).toBe(true);
    group.disabled = false;
    await settle(group);
    expect([...choices, late].map((c) => c.disabled)).toEqual([false, true, false]);
    group.disabled = true;
    await settle(group);
    late.remove();
    await settle(group);
    expect(late.disabled).toBe(false);
    expect([...new FormData(form)]).toEqual([]);
  });

  it('a disabled fieldset disables the group and its choices natively', async () => {
    const { group, choices, box } = await mount(
      `<form><fieldset disabled><odd-checkbox-group label="Notifications" required>${CHOICES}</odd-checkbox-group></fieldset></form>`,
    );
    expect(choices.every((c) => box(c).disabled)).toBe(true);
    expect([group.willValidate, container.querySelector('form')!.checkValidity()]).toEqual([
      false,
      true,
    ]);
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { group } = await mount(
      `<odd-checkbox-group label="Notifications">${CHOICES}</odd-checkbox-group>`,
    );
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      group.remove();
      container.append(group);
      await settle(group);
    }
    expect(scopeStats()).toEqual(before);
  });
});
