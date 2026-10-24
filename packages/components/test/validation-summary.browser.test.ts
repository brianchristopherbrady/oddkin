import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCheckboxGroup } from '../src/checkbox-group/checkbox-group.js';
import type { OddkinInput } from '../src/input/input.js';
import type { OddkinValidationSummary } from '../src/validation-summary/validation-summary.js';
import { loadTheme } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/validation-summary/validation-summary.define.js');
  await import('../src/input/input.define.js');
  await import('../src/button/button.define.js');
  await import('../src/checkbox-group/checkbox-group.define.js');
  await import('../src/checkbox/checkbox.define.js');
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

const frame = () => new Promise(requestAnimationFrame);
const settle = async () => {
  flush();
  await frame();
  flush();
  await frame();
};

const FIELDS = `
  <odd-input label="Project name" name="project" required></odd-input>
  <p><label>Owner email <input id="owner" name="owner" type="email" required value="ada@" /></label></p>
  <odd-checkbox-group label="Notifications" required>
    <odd-checkbox name="channel" value="email">Email</odd-checkbox>
    <odd-checkbox name="channel" value="desktop">Desktop</odd-checkbox>
  </odd-checkbox-group>
  <fieldset><legend>Plan</legend>
    <label><input type="radio" name="plan" value="free" required /> Free</label>
    <label><input type="radio" name="plan" value="team" /> Team</label>
  </fieldset>
  <input name="code" aria-label="Invite code" required />
  <span id="city-label">City</span><input name="city" aria-labelledby="city-label" required />`;

async function mount(markup: string) {
  container.innerHTML = markup;
  const summary = container.querySelector('odd-validation-summary') as OddkinValidationSummary;
  const form = container.querySelector('form')!;
  let submitted = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted++;
  });
  await settle();
  const part = (name: string) =>
    summary.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
  const links = () => [
    ...summary.shadowRoot!.querySelectorAll<HTMLAnchorElement>('[part~="link"]'),
  ];
  const field = (selector: string) => container.querySelector<HTMLElement>(selector)!;
  return { summary, form, part, links, field, submitted: () => submitted };
}

const deepActive = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};
const message = (el: Element) => (el as HTMLInputElement).validationMessage.replace(/\s+/g, ' ');

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/validation-summary/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinValidationSummary',
        'VALIDATION_SUMMARY_STRINGS',
        'glyphStyles',
        'hostStyles',
        'validationSummaryStructuralStyles',
        'validationSummaryTemplate',
      ].sort(),
    );
    const index = await import('../src/validation-summary/index.js');
    expect(Object.keys(index)).toContain('validationSummaryDefinition');
  });
});

describe('odd-validation-summary', () => {
  it('stays hidden until a submission is blocked, then lists every problem in form order and takes focus', async () => {
    const { part, links, field, form, submitted } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>${FIELDS}<button type="submit">Save</button></form>`,
    );
    expect(part('base').hidden).toBe(true);
    expect(part('base').getBoundingClientRect().height).toBe(0);

    await userEvent.click(field('button'));
    await settle();

    expect(submitted()).toBe(0);
    expect(part('base').hidden).toBe(false);
    expect(part('label').textContent).toBe('Please fix 6 fields');
    const controls = [
      field('odd-input'),
      field('#owner'),
      field('odd-checkbox-group'),
      field('input[name="plan"]'),
      field('input[name="code"]'),
      field('input[name="city"]'),
    ];
    const names = ['Project name', 'Owner email', 'Notifications', 'Plan', 'Invite code', 'City'];
    expect(links().map((link) => link.textContent!.trim())).toEqual(
      controls.map((control, i) => `${names[i]} — ${message(control)}`),
    );
    expect(controls.every((control) => message(control))).toBe(true);
    // The summary reported the problems: focus is on it, not on the first field.
    expect(deepActive()).toBe(part('base'));
    expect(part('base').getAttribute('tabindex')).toBe('-1');
    expect(part('base').getAttribute('role')).toBe('group');
    expect(part('base').getAttribute('aria-labelledby')).toBe('label');
    // Entered values stay.
    expect((field('#owner') as HTMLInputElement).value).toBe('ada@');
    expect(new FormData(form).get('owner')).toBe('ada@');
  });

  it('cancels the browser’s own report only for a submission it shows', async () => {
    const { part, field, form } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>${FIELDS}<button type="submit">Save</button></form>`,
    );
    const cancelled: boolean[] = [];
    field('input[name="code"]').addEventListener('invalid', (event) =>
      cancelled.push(event.defaultPrevented),
    );
    const before = document.activeElement;

    expect(form.checkValidity()).toBe(false);
    await settle();
    expect(part('base').hidden).toBe(true);
    expect(document.activeElement).toBe(before);

    form.requestSubmit();
    await settle();
    expect(part('base').hidden).toBe(true);

    await userEvent.click(field('button'));
    await settle();
    expect(part('base').hidden).toBe(false);
    expect(cancelled).toEqual([false, false, true]);
  });

  it('reports a submission from odd-button and from Enter in a field', async () => {
    const odd = await mount(
      `<form><odd-validation-summary></odd-validation-summary>${FIELDS}<odd-button type="submit">Save</odd-button></form>`,
    );
    await userEvent.click(odd.field('odd-button'));
    await expect.poll(() => odd.part('base').hidden).toBe(false);
    expect(odd.links()).toHaveLength(6);

    const enter = await mount(
      `<form><odd-validation-summary></odd-validation-summary>${FIELDS}<button type="submit">Save</button></form>`,
    );
    enter.field('input[name="code"]').focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(enter.part('base').hidden).toBe(false);
    expect(deepActive()).toBe(enter.part('base'));

    // With no submit button, Enter submits the form without a click.
    const implicit = await mount(
      `<form><odd-validation-summary></odd-validation-summary><input name="code" aria-label="Invite code" required /></form>`,
    );
    implicit.field('input').focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(implicit.part('base').hidden).toBe(false);
    expect(implicit.links()).toHaveLength(1);
  });

  it('moves focus to the control each link names', async () => {
    const { links, field } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>${FIELDS}<button type="submit">Save</button></form>`,
    );
    await userEvent.click(field('button'));
    await settle();
    const [project, owner, notifications, plan] = links();
    expect(owner!.getAttribute('href')).toBe('#owner');
    expect(project!.getAttribute('href')).toBe('#');

    const hash = location.hash;
    await userEvent.click(owner!);
    expect(document.activeElement).toBe(field('#owner'));
    expect(location.hash).toBe(hash);

    await userEvent.click(project!);
    expect(deepActive()).toBe(field('odd-input').shadowRoot!.querySelector('input'));

    // A group takes no focus itself: its first choice does.
    await userEvent.click(notifications!);
    const first = (field('odd-checkbox-group') as OddkinCheckboxGroup).querySelector(
      'odd-checkbox',
    )!;
    expect(deepActive()).toBe(first.shadowRoot!.querySelector('input'));

    await userEvent.click(plan!);
    expect(document.activeElement).toBe(field('input[name="plan"]'));
  });

  it('drops each problem once it is fixed, and hides when the form is valid', async () => {
    const { part, links, field, form } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>
        <odd-input label="Project name" name="project" required></odd-input>
        <p><label>Owner email <input id="owner" name="owner" type="email" required value="ada@" /></label></p>
        <button type="submit">Save</button></form>`,
    );
    await userEvent.click(field('button'));
    await settle();
    expect(part('label').textContent).toBe('Please fix 2 fields');

    const inner = (field('odd-input') as OddkinInput).shadowRoot!.querySelector('input')!;
    await userEvent.type(inner, 'Atlas');
    await expect.poll(() => links().length).toBe(1);
    expect(part('label').textContent).toBe('Please fix 1 field');
    // Fixing a field never moves focus back to the summary.
    expect(deepActive()).toBe(inner);

    const owner = field('#owner') as HTMLInputElement;
    await userEvent.fill(owner, 'ada@example.com');
    await expect.poll(() => part('base').hidden).toBe(true);
    expect([inner.value, owner.value]).toEqual(['Atlas', 'ada@example.com']);
    expect(form.checkValidity()).toBe(true);
  });

  it('hides on reset and after a submission that goes through', async () => {
    const { part, field, form, submitted } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>
        <input name="code" aria-label="Invite code" required />
        <button type="submit">Save</button></form>`,
    );
    await userEvent.click(field('button'));
    await settle();
    expect(part('base').hidden).toBe(false);
    form.reset();
    await settle();
    expect(part('base').hidden).toBe(true);

    await userEvent.click(field('button'));
    await settle();
    expect(part('base').hidden).toBe(false);
    // A change the summary has not seen: the next submission goes through and hides it.
    (field('input') as HTMLInputElement).value = 'ATLAS';
    await userEvent.click(field('button'));
    await settle();
    expect(submitted()).toBe(1);
    expect(part('base').hidden).toBe(true);
  });

  it('stays out of validation the page runs itself while the user types or clicks', async () => {
    const { summary, part, field, form } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>
        <input name="code" aria-label="Invite code" required />
        <button type="button">Check</button><button type="submit">Save</button></form>`,
    );
    const checks: boolean[] = [];
    form.addEventListener('input', () => checks.push(form.checkValidity()));
    field('button[type="button"]').addEventListener('click', () => form.reportValidity());
    const before = scopeStats();
    // Nothing to refresh while hidden: an edit schedules nothing.
    form.dispatchEvent(new Event('input'));
    expect(scopeStats().timers).toBe(before.timers);
    await userEvent.type(field('input'), 'A');
    await userEvent.fill(field('input'), '');
    await userEvent.click(field('button[type="button"]'));
    await settle();
    expect(checks).toContain(false);
    expect(part('base').hidden).toBe(true);
    expect(summary.shadowRoot!.querySelectorAll('[part~="link"]')).toHaveLength(0);
  });

  it('lists only controls that validate, named by their text, their name, or not at all', async () => {
    const { links, field } = await mount(
      `<form><odd-validation-summary></odd-validation-summary>
        <input name="locked" aria-label="Locked" disabled />
        <odd-checkbox name="terms" required>I accept the terms</odd-checkbox>
        <input name="reference" required />
        <input required />
        <button type="submit">Save</button></form>`,
    );
    (field('input[name="locked"]') as HTMLInputElement).setCustomValidity('Not used.');
    await userEvent.click(field('button'));
    await settle();
    expect(links().map((link) => link.textContent!.trim())).toEqual([
      `I accept the terms — ${message(field('odd-checkbox'))}`,
      `reference — ${message(field('input[name="reference"]'))}`,
      message(field('input:not([name])')),
    ]);
  });

  it('reports on the form `form` names, and takes `label` and `strings`', async () => {
    const { summary, part, links, field } = await mount(
      `<odd-validation-summary form="settings"></odd-validation-summary>
        <form id="settings"><input name="code" aria-label="Invite code" required /><button type="submit">Save</button></form>`,
    );
    summary.strings = { titleOne: '{count} problem', entry: '{label}: {message}' };
    await userEvent.click(field('button'));
    await settle();
    expect(part('label').textContent).toBe('1 problem');
    expect(links()[0]!.textContent!.trim()).toBe(
      `Invite code: ${message(field('input[name="code"]'))}`,
    );
    summary.label = 'There is a problem';
    await settle();
    expect(part('label').textContent).toBe('There is a problem');
  });

  it('finds no form without an ancestor or a matching `form`', async () => {
    const { part, field } = await mount(
      `<odd-validation-summary form="elsewhere"></odd-validation-summary>
        <form id="settings"><input name="code" aria-label="Invite code" required /><button type="submit">Save</button></form>`,
    );
    await userEvent.click(field('button'));
    await settle();
    expect(part('base').hidden).toBe(true);
  });

  it('draws the danger glyph at the inline start of the heading, right to left too', async () => {
    const { part, field } = await mount(
      `<form dir="rtl"><odd-validation-summary></odd-validation-summary><input name="code" aria-label="Invite code" required /><button type="submit">Save</button></form>`,
    );
    await userEvent.click(field('button'));
    await settle();
    const marker = part('marker').getBoundingClientRect();
    const label = part('label').getBoundingClientRect();
    expect(marker.left).toBeGreaterThan(label.left);
    expect(part('marker').getAttribute('aria-hidden')).toBe('true');
    expect(part('marker').querySelector('svg')).not.toBeNull();
  });

  it.runIf(server.browser === 'chromium')(
    'keeps its border, heading, and links in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { part, links, field } = await mount(
          `<form><odd-validation-summary></odd-validation-summary><input name="code" aria-label="Invite code" required /><button type="submit">Save</button></form>`,
        );
        await userEvent.click(field('button'));
        await settle();
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        const base = getComputedStyle(part('base'));
        expect([base.borderTopStyle, base.borderTopColor]).toEqual(['solid', system('CanvasText')]);
        expect(getComputedStyle(part('label')).color).toBe(system('CanvasText'));
        expect(getComputedStyle(links()[0]!).color).toBe(system('LinkText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const { field, form } = await mount(
      `<form><input name="code" aria-label="Invite code" required /><button type="submit">Save</button></form>`,
    );
    const before = scopeStats();
    const summary = document.createElement('odd-validation-summary');
    form.prepend(summary);
    await settle();
    await userEvent.click(field('button'));
    await settle();
    expect(summary.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.hidden).toBe(false);
    summary.remove();
    flush();
    await new Promise((resolve) => setTimeout(resolve));
    expect(scopeStats()).toEqual(before);

    // The browser reports a later submission itself.
    const cancelled: boolean[] = [];
    field('input').addEventListener('invalid', (event) => cancelled.push(event.defaultPrevented));
    await userEvent.click(field('button'));
    expect(cancelled).toEqual([false]);
  });
});
