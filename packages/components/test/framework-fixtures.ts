import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import type { OddkinInput } from '../src/input/input.js';
import type { NavigationItem } from '../src/models/navigation.js';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';

// Shared by the framework fixtures: the same navigation, reordered, and the settled element; the
// same form scenario for odd-input.

export const ITEMS: readonly NavigationItem[] = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '#overview' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [{ id: 'theming', kind: 'link', label: 'Theming', href: '#theming' }],
  },
  { id: 'create', kind: 'action', label: 'Create project', action: 'project.create' },
];
export const REORDERED: readonly NavigationItem[] = [ITEMS[2]!, ITEMS[0]!, ITEMS[1]!];

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });

export async function sideNav(container: Element): Promise<OddkinSideNav> {
  await frames();
  flush();
  const el = container.querySelector('odd-side-nav')!;
  await el.updateComplete;
  flush();
  return el;
}

export const toggle = (el: Element) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!;
export const action = (el: Element) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="action"]')!;

export const NAME = 'Ada Lovelace';

export async function nameField(container: Element): Promise<OddkinInput> {
  await frames();
  flush();
  const el = container.querySelector('odd-input')!;
  await el.updateComplete;
  flush();
  await el.updateComplete;
  return el;
}

/** The framework's own state for the field, as the framework sees it. */
export interface FieldModel {
  read(): string;
  /** Set the framework state and let the framework render. */
  write(value: string): Promise<void>;
}

/**
 * One scenario for every framework: a required `odd-input` named `name`, starting at
 * {@link NAME}, inside a native form and bound to framework state. (Text, not email: email inputs
 * have no selection API to place the caret.)
 */
export async function checkNameField(container: HTMLElement, model: FieldModel): Promise<void> {
  let el = await nameField(container);
  const form = container.querySelector('form')!;
  const control = el.shadowRoot!.querySelector('input')!;
  const events: string[] = [];
  for (const type of ['input', 'change']) el.addEventListener(type, () => events.push(type));
  // Set as a property: the value attribute (the default value) stays untouched.
  expect([el.value, control.value, el.getAttribute('value')]).toEqual([NAME, NAME, null]);
  expect([...new FormData(form)]).toEqual([['name', NAME]]);

  // Typing mid-value reaches the framework, and its write-back keeps the caret.
  await userEvent.click(control);
  control.setSelectionRange(3, 3);
  await userEvent.keyboard('m');
  el = await nameField(container);
  expect(model.read()).toBe('Adam Lovelace');
  expect([el.value, control.selectionStart, events]).toEqual(['Adam Lovelace', 4, ['input']]);

  // Framework writes reach the element, its validity, and the form, and never come back as events.
  await model.write('');
  el = await nameField(container);
  expect([control.value, el.validity.valueMissing, form.checkValidity()]).toEqual([
    '',
    true,
    false,
  ]);
  await model.write('Grace Hopper');
  el = await nameField(container);
  expect([control.value, el.checkValidity()]).toEqual(['Grace Hopper', true]);
  expect([...new FormData(form)]).toEqual([['name', 'Grace Hopper']]);
  expect(model.read()).toBe('Grace Hopper');
  expect(events).toEqual(['input']);
}
