import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinRadioGroup } from '../src/radio-group/radio-group.js';
import { loadTheme, themeValue } from './probe.js';

let container: HTMLElement;
beforeAll(async () => {
  await loadTheme();
  await import('../src/radio-group/radio-group.define.js');
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
const OPTIONS =
  '<option value="private" title="Only invited members">Private</option><option value="team" title="Anyone in your workspace">Team</option><option value="public">Public</option>';

async function mount(markup: string) {
  container.innerHTML = markup;
  const group = container.querySelector('odd-radio-group') as OddkinRadioGroup;
  await settle(group);
  const part = (name: string) => group.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const radios = () => [
    ...group.shadowRoot!.querySelectorAll<HTMLInputElement>('input:not(.flag)'),
  ];
  const radio = (value: string) => radios().find((r) => r.value === value)!;
  return { group, part, radios, radio, form: container.querySelector('form') };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/radio-group/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'OddkinRadioGroup',
        'changeEvent',
        'controlIndicatorStructuralStyles',
        'fieldStructuralStyles',
        'hostStyles',
        'inputEvent',
        'radioGroupStructuralStyles',
        'radioGroupTemplate',
      ].sort(),
    );
    const index = await import('../src/radio-group/index.js');
    expect(Object.keys(index)).toContain('radioGroupDefinition');
  });
});

describe('odd-radio-group', () => {
  it('is a radiogroup named by its legend, its native radios named and described by their options', async () => {
    const { group, part, radio } = await mount(
      `<odd-radio-group label="Workspace visibility" description="Who can open it.">${OPTIONS}</odd-radio-group>`,
    );
    expect(page.getByRole('radiogroup', { name: 'Workspace visibility' }).element()).toBe(
      part('field'),
    );
    expect(page.getByRole('radio', { name: 'Team' }).element()).toBe(radio('team'));
    expect(part('field').getAttribute('aria-describedby')).toBe('description');
    const described = radio('team').getAttribute('aria-describedby')!;
    expect(group.shadowRoot!.getElementById(described)!.textContent!.trim()).toBe(
      'Anyone in your workspace',
    );
    expect(radio('public').hasAttribute('aria-describedby')).toBe(false);
    group.error = 'Choose a visibility setting.';
    await settle(group);
    expect(part('field').getAttribute('aria-describedby')).toBe('description error');
    expect(
      [...group.shadowRoot!.querySelectorAll('input:not(.flag)')].map((r) =>
        r.getAttribute('aria-invalid'),
      ),
    ).toEqual(['true', 'true', 'true']);
  });

  it('takes the default from the value attribute, else the last selected option; nothing is checked without one', async () => {
    const { group, radio } = await mount(
      `<odd-radio-group label="A"><option value="a" selected>A</option><option value="b" selected>B</option></odd-radio-group>`,
    );
    expect([group.value, radio('b').checked, radio('a').checked]).toEqual(['b', true, false]);
    const { group: second, radios } = await mount(
      `<odd-radio-group label="A" value="a"><option value="a">A</option><option value="b" selected>B</option></odd-radio-group>`,
    );
    expect([second.value, radios()[0]!.checked]).toEqual(['a', true]);
    const { group: none, radios: unchecked } = await mount(
      `<odd-radio-group label="A"><option value="a">A</option><option value="b">B</option></odd-radio-group>`,
    );
    expect([none.value, unchecked().some((r) => r.checked)]).toEqual(['', false]);
  });

  it('follows value set by a script, also after the user checked another option', async () => {
    const { group, radio } = await mount(`<odd-radio-group label="A">${OPTIONS}</odd-radio-group>`);
    await userEvent.click(radio('team'));
    expect(group.value).toBe('team');
    group.value = 'private';
    await settle(group);
    expect([radio('private').checked, radio('team').checked]).toEqual([true, false]);
    group.value = 'team';
    await settle(group);
    group.value = 'private';
    await settle(group);
    expect(radio('private').checked).toBe(true);
  });

  it('stays checked as value says when a listener puts value back during input', async () => {
    const { group, radio } = await mount(
      `<odd-radio-group label="A" value="private">${OPTIONS}</odd-radio-group>`,
    );
    group.addEventListener('input', () => (group.value = 'private'));
    await userEvent.click(radio('team'));
    await settle(group);
    expect([group.value, radio('private').checked, radio('team').checked]).toEqual([
      'private',
      true,
      false,
    ]);
  });

  it("keeps a chosen value when the options change; a value set before connecting is the author's", async () => {
    const { group, radio } = await mount(`<odd-radio-group label="A">${OPTIONS}</odd-radio-group>`);
    await userEvent.click(radio('public'));
    group.insertAdjacentHTML('beforeend', '<option value="extra">Extra</option>');
    await settle(group);
    expect([group.value, radio('public').checked]).toEqual(['public', true]);
    const early = document.createElement('odd-radio-group') as OddkinRadioGroup;
    early.innerHTML = '<option value="a" selected>A</option><option value="b">B</option>';
    early.value = 'b';
    container.append(early);
    await settle(early);
    expect(early.value).toBe('b');
  });

  it('reads options from data; options wins over children', async () => {
    const { group, radios } = await mount(
      `<odd-radio-group label="A">${OPTIONS}</odd-radio-group>`,
    );
    const warn = console.warn;
    console.warn = () => {};
    group.options = [
      { value: 'x', label: 'X', description: 'Ex' },
      { value: 'y', label: 'Y', disabled: true },
    ];
    await settle(group);
    console.warn = warn;
    expect(radios().map((r) => [r.value, r.disabled])).toEqual([
      ['x', false],
      ['y', true],
    ]);
  });

  it('draws optgroups as named groups of options', async () => {
    await mount(
      `<odd-radio-group label="Plan"><optgroup label="Monthly"><option value="m">Team</option></optgroup><optgroup label="Yearly" disabled><option value="y">Team</option></optgroup></odd-radio-group>`,
    );
    const yearly = page.getByRole('group', { name: 'Yearly' });
    expect(yearly.getByRole('radio', { name: 'Team' }).element()).toHaveProperty('disabled', true);
  });

  it('has the Tab stop and arrow keys of a native radio group, with the same events', async () => {
    const { group } = await mount(
      `<button id="before">Before</button><odd-radio-group label="A"><option value="a">A</option><option value="b" selected>B</option><option value="c" disabled>C</option><option value="d">D</option></odd-radio-group><button id="after">After</button><div id="native"><button id="n-before">Before</button><input type="radio" name="n" value="a"><input type="radio" name="n" value="b" checked><input type="radio" name="n" value="c" disabled><input type="radio" name="n" value="d"><button id="n-after">After</button></div>`,
    );
    const walk = async (start: string, host: EventTarget, focused: () => string) => {
      const steps: string[] = [];
      const events: string[] = [];
      host.addEventListener('input', () => events.push('input'));
      host.addEventListener('change', () => events.push('change'));
      container.querySelector<HTMLButtonElement>(start)!.focus();
      const keys = ['Tab', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Tab', 'Shift+Tab'];
      for (const key of keys) {
        await userEvent.keyboard(key === 'Shift+Tab' ? '{Shift>}{Tab}{/Shift}' : `{${key}}`);
        steps.push(`${key}:${focused()}`);
      }
      return { steps, events };
    };
    const native = container.querySelector('#native')!;
    const expected = await walk('#n-before', native, () => {
      const active = document.activeElement as HTMLInputElement;
      const checked = native.querySelector<HTMLInputElement>('input:checked')!.value;
      return `${active.id || active.value}/${checked}`;
    });
    const actual = await walk('#before', group, () => {
      const active = (group.shadowRoot!.activeElement ??
        document.activeElement) as HTMLInputElement;
      return `${active.id ? active.id.replace('n-', '') : active.value}/${group.value}`;
    });
    expect(actual.steps).toEqual(expected.steps.map((step) => step.replace('n-', '')));
    expect(actual.events).toEqual(expected.events);
    expect(actual.events.length).toBeGreaterThan(0);
  });

  it('draws a round box with a dot that shows only when checked, the description under the label', async () => {
    const { part, radio, group } = await mount(
      `<odd-radio-group label="A">${OPTIONS}</odd-radio-group>`,
    );
    group.value = 'private';
    await settle(group);
    const dot = (value: string) => radio(value).parentElement!.querySelector('.indicator-dot')!;
    expect([
      getComputedStyle(dot('private')).visibility,
      getComputedStyle(dot('team')).visibility,
    ]).toEqual(['visible', 'hidden']);
    expect(getComputedStyle(radio('team')).borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-radius-full'),
    );
    const label = radio('team').closest('label')!.querySelector('.label')!;
    const description = part('option-description');
    const inset = parseFloat(getComputedStyle(description).paddingInlineStart);
    expect(Math.round(description.getBoundingClientRect().left + inset)).toBe(
      Math.round(label.getBoundingClientRect().left),
    );
    expect(getComputedStyle(part('control')).rowGap).toBe(themeValue('row-gap', '--odd-space-lg'));
  });

  it('lines its options up when horizontal', async () => {
    const { group, radios } = await mount(
      `<odd-radio-group label="A">${OPTIONS.replace(/ title="[^"]*"/g, '')}</odd-radio-group>`,
    );
    const tops = () => radios().map((r) => Math.round(r.getBoundingClientRect().top));
    expect(new Set(tops()).size).toBe(3);
    group.orientation = 'horizontal';
    await settle(group);
    expect(new Set(tops()).size).toBe(1);
  });
});

describe('forms', () => {
  it('submits the checked value under its name, and nothing while none is checked', async () => {
    const { group, radio, form } = await mount(
      `<form><odd-radio-group label="A" name="visibility">${OPTIONS}</odd-radio-group></form>`,
    );
    expect(group.form).toBe(form);
    expect([...new FormData(form!)]).toEqual([]);
    await userEvent.click(radio('team'));
    expect([...new FormData(form!)]).toEqual([['visibility', 'team']]);
    group.value = 'nothing-like-it';
    await settle(group);
    expect([...new FormData(form!)]).toEqual([]);
  });

  it('required needs a checked option, with the native message; a blocked submission focuses the first enabled radio', async () => {
    const { group, radio, form } = await mount(
      `<form><odd-radio-group label="A" required><option value="x" disabled>X</option>${OPTIONS}</odd-radio-group><input type="radio" name="native" required></form>`,
    );
    const native = form!.querySelector<HTMLInputElement>('input[name="native"]')!;
    native.remove();
    expect([group.validity.valueMissing, group.validationMessage]).toEqual([
      true,
      native.validationMessage,
    ]);
    let submitted = false;
    form!.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted = true;
    });
    form!.requestSubmit();
    await settle(group);
    expect(submitted).toBe(false);
    expect(group.shadowRoot!.activeElement).toBe(radio('private'));
    expect(group.matches(':state(user-invalid)')).toBe(true);
    group.value = 'team';
    await settle(group);
    expect(group.validity.valid).toBe(true);
    // Enabled again, the radios report the missing choice once they are enabled.
    group.value = '';
    group.disabled = true;
    await settle(group);
    group.disabled = false;
    await settle(group);
    expect(group.validity.valueMissing).toBe(true);
  });

  it('a required group with no enabled option still reports the missing choice', async () => {
    const { group, radios } = await mount(`<odd-radio-group label="A" required></odd-radio-group>`);
    expect([radios().length, group.validity.valueMissing]).toEqual([0, true]);
    group.options = [{ value: 'a', label: 'A', disabled: true }];
    await settle(group);
    expect(group.validity.valueMissing).toBe(true);
    group.required = false;
    await settle(group);
    expect(group.validity.valid).toBe(true);
  });

  it('shows user-invalid after focus leaves a required group empty, not while moving inside it', async () => {
    const { group, radio, part } = await mount(
      `<odd-radio-group label="A" required>${OPTIONS}</odd-radio-group><button id="after">After</button>`,
    );
    radio('private').focus();
    radio('team').focus();
    await settle(group);
    expect(group.matches(':state(user-invalid)')).toBe(false);
    container.querySelector<HTMLButtonElement>('#after')!.focus();
    await settle(group);
    expect(group.matches(':state(user-invalid)')).toBe(true);
    expect(radio('team').getAttribute('aria-invalid')).toBe('true');
    expect(part('error').hidden).toBe(true);
  });

  it('reset restores the declared default; a disabled fieldset or disabled bars every radio', async () => {
    const { group, radio, radios, form } = await mount(
      `<form><fieldset><odd-radio-group label="A" name="v"><option value="a">A</option><option value="b" selected>B</option></odd-radio-group></fieldset></form>`,
    );
    await userEvent.click(radio('a'));
    expect(group.value).toBe('a');
    form!.reset();
    await settle(group);
    expect([group.value, radio('b').checked]).toEqual(['b', true]);
    form!.querySelector('fieldset')!.disabled = true;
    await settle(group);
    expect(radios().every((r) => r.disabled)).toBe(true);
    expect([...new FormData(form!)]).toEqual([]);
    form!.querySelector('fieldset')!.disabled = false;
    group.disabled = true;
    await settle(group);
    expect([radios().every((r) => r.disabled), group.matches(':disabled')]).toEqual([true, true]);
    group.label = 'Region';
    await settle(group);
    expect(getComputedStyle(group.shadowRoot!.querySelector('[part="label"]')!).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
  });
});

describe('ownership', () => {
  it('returns to baseline after reconnects', async () => {
    const { group } = await mount(`<odd-radio-group label="A">${OPTIONS}</odd-radio-group>`);
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      group.remove();
      container.append(group);
      await settle(group);
    }
    expect(scopeStats()).toEqual(before);
  });
});
