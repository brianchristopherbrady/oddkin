import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCalendar } from '../src/calendar/calendar.js';
import type { OddkinDatePicker } from '../src/date-picker/date-picker.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-date-picker (component-contracts.md §3.3; Figma datePicker; WAI-ARIA date picker dialog).
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  container.lang = 'en-GB';
  document.body.append(container);
});
afterEach(async () => {
  await userEvent.unhover(document.body);
  container.remove();
  flush();
});

async function mount(markup: string) {
  container.innerHTML = markup;
  const el = container.querySelector('odd-date-picker') as OddkinDatePicker;
  await settle(el);
  const root = el.shadowRoot!;
  const part = (name: string) => root.querySelector<HTMLElement>(`[part~="${name}"]`)!;
  const control = part('control') as HTMLInputElement;
  const button = part('button') as HTMLButtonElement;
  const calendar = root.querySelector('odd-calendar') as OddkinCalendar;
  const open = () => part('popup').matches(':popover-open');
  const active = () => (calendar.shadowRoot!.activeElement as HTMLElement | null)?.dataset['date'];
  return {
    el,
    root,
    part,
    control,
    button,
    calendar,
    open,
    active,
    form: container.querySelector('form'),
  };
}

/** Types `text` into the field and leaves it with Tab, as a user does. */
async function type(el: OddkinDatePicker, control: HTMLInputElement, text: string) {
  await userEvent.clear(control);
  if (text) await userEvent.type(control, text);
  await userEvent.tab();
  await settle(el);
}

const box = (el: Element) => el.getBoundingClientRect();
const full = (lang: string, iso: string) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(iso));
// A native date input exists (Playwright's WebKit on Windows has none: type="date" is text there).
const nativeDate = Object.assign(document.createElement('input'), { type: 'date' }).type === 'date';

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/date-picker/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'DATE_PICKER_STRINGS',
        'OddkinDatePicker',
        'datePickerStructuralStyles',
        'datePickerTemplate',
        'fieldStructuralStyles',
        'glyphStyles',
        'hostStyles',
        'overlaySurfaceStructuralStyles',
      ].sort(),
    );
    const index = await import('../src/date-picker/index.js');
    expect(Object.keys(index)).toContain('datePickerDefinition');
  });
});

describe('odd-date-picker', () => {
  it('is a text field named by its label, with a button that names the chosen date', async () => {
    const { el, part, control, button } = await mount(
      `<odd-date-picker label="Publish date" description="Type it or choose it." value="2026-10-26" placeholder="Choose a date"></odd-date-picker>`,
    );
    expect(control.labels![0]).toBe(part('label'));
    expect(control.type).toBe('text');
    expect(control.inputMode).toBe('numeric');
    expect(control.autocomplete).toBe('off');
    expect(control.value).toBe('26/10/2026');
    expect(control.placeholder).toBe('Choose a date');
    expect(control.getAttribute('aria-describedby')).toBe('description');
    expect(part('description').hidden).toBe(false);
    expect(part('error').hidden).toBe(true);
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(`Change date, ${full('en-GB', '2026-10-26')}`);
    expect(part('popup').getAttribute('role')).toBe('dialog');
    expect(part('popup').getAttribute('aria-label')).toBe('Choose date');
    // Focus goes to the input.
    el.focus();
    expect(el.shadowRoot!.activeElement).toBe(control);
    el.value = '';
    el.label = '';
    el.description = '';
    await settle(el);
    expect(control.value).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Choose date');
    expect(part('label').hidden).toBe(true);
    expect(part('description').hidden).toBe(true);
    // The language's own order and separator.
    el.lang = 'en-US';
    el.value = '2026-10-26';
    await settle(el);
    expect(control.value).toBe('10/26/2026');
    el.lang = 'de';
    el.value = '2026-03-02';
    await settle(el);
    expect(control.value).toBe('02.03.2026');
    // Always Latin digits, which the field reads back, also where the language writes others.
    el.lang = 'ar-EG';
    el.value = '2026-03-03';
    await settle(el);
    expect(control.value).toContain('2026');
    el.lang = 'de';
    el.value = '2026-03-02';
    await settle(el);
    el.strings = { change: 'Datum ändern, {date}', today: 'Heute' };
    await settle(el);
    expect(button.getAttribute('aria-label')).toBe(`Datum ändern, ${full('de', '2026-03-02')}`);
    // The calendar takes the strings too.
    const calendar = el.shadowRoot!.querySelector('odd-calendar')!;
    await settle(calendar);
    expect(calendar.shadowRoot!.querySelector('[part~="today"]')!.textContent!.trim()).toBe(
      'Heute',
    );
  });

  it('takes a typed date in the language’s order when the user leaves the field or presses Enter', async () => {
    const { el, control, form } = await mount(
      `<form><odd-date-picker name="publish"></odd-date-picker></form>`,
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input ${el.value}`));
    el.addEventListener('change', () => events.push(`change ${el.value}`));
    await type(el, control, '26/10/2026');
    expect(el.value).toBe('2026-10-26');
    expect(new FormData(form!).get('publish')).toBe('2026-10-26');
    // Other separators and single digits are read too; the field then shows the language's form.
    await type(el, control, '3.2.2027');
    expect(el.value).toBe('2027-02-03');
    expect(control.value).toBe('03/02/2027');
    // Typing alone is not a change of value: input and change come once, with the date.
    expect(events).toEqual([
      'input 2026-10-26',
      'change 2026-10-26',
      'input 2027-02-03',
      'change 2027-02-03',
    ]);
    // Enter commits too.
    await userEvent.clear(control);
    await userEvent.type(control, '1/11/2026{Enter}');
    await settle(el);
    expect(el.value).toBe('2026-11-01');
    expect(events).toHaveLength(6);
    // The same date again, written another way, is no change.
    await type(el, control, '1.11.2026');
    expect(events).toHaveLength(6);
    // Leaving the field without a change commits nothing.
    await userEvent.click(control);
    await userEvent.tab();
    await settle(el);
    expect(events).toHaveLength(6);
    // Clearing the field clears the value; spaces alone are an empty field too.
    await type(el, control, '');
    expect(el.value).toBe('');
    expect(events.at(-1)).toBe('change ');
    await type(el, control, '   ');
    expect([control.value, el.validity.valid]).toEqual(['', true]);
  });

  it('keeps text that is not a date for the user to correct, and reports it', async () => {
    const { el, control, part } = await mount(
      `<odd-date-picker name="publish" value="2026-10-26"></odd-date-picker>`,
    );
    for (const wrong of [
      '31/02/2026',
      '26/10/26',
      '1/1/20260',
      '26/10',
      '1/2/2026/5',
      '2026-10-26x/1',
      'tomorrow',
    ]) {
      await type(el, control, wrong);
      expect(el.value, wrong).toBe('');
      expect(control.value, wrong).toBe(wrong);
      expect(el.validity.badInput, wrong).toBe(true);
    }
    expect(el.validationMessage).toBe('Enter a valid date in DD/MM/YYYY.');
    expect(el.matches(':state(user-invalid)')).toBe(true);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    // The message follows the language and the strings.
    el.lang = 'en-US';
    el.strings = { invalid: 'Use {format}.', day: 'dd', month: 'mm', year: 'yyyy' };
    await settle(el);
    expect(el.validationMessage).toBe('Use mm/dd/yyyy.');
    el.lang = 'de';
    el.strings = {};
    await type(el, control, '31.02.2026');
    expect(el.validationMessage).toBe('Enter a valid date in DD.MM.YYYY.');
    el.lang = 'en-US';
    // A date replaces the text; an empty field is valid.
    await type(el, control, '10/27/2026');
    expect(el.value).toBe('2026-10-27');
    expect(el.validity.valid).toBe(true);
    await type(el, control, 'x');
    await type(el, control, '');
    expect(el.validity.valid).toBe(true);
    expect(part('error').hidden).toBe(true);
    // Setting the value replaces the text too.
    await type(el, control, 'x');
    el.value = '2026-12-24';
    await settle(el);
    expect(control.value).toBe('12/24/2026');
    expect(el.validity.valid).toBe(true);
  });

  it('opens the calendar from its button, on the chosen date, and chooses a date there', async () => {
    const { el, root, button, calendar, open, active } = await mount(
      `<odd-date-picker label="Publish date" value="2026-10-26" first-day="1" min="2026-10-05" max="2026-11-20"></odd-date-picker>`,
    );
    el.isDateDisabled = (date) => date === '2026-10-30';
    await settle(el);
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input ${el.value}`));
    el.addEventListener('change', () => events.push(`change ${el.value}`));
    await userEvent.click(button);
    await settle(el);
    expect(open()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(el.matches(':state(open)')).toBe(true);
    // The calendar shares the picker's value, bounds, first day, and hook.
    expect([calendar.value, calendar.min, calendar.max, calendar.firstDay]).toEqual([
      '2026-10-26',
      '2026-10-05',
      '2026-11-20',
      1,
    ]);
    expect(calendar.isDateDisabled).toBe(el.isDateDisabled);
    expect(active()).toBe('2026-10-26');
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await settle(el);
    expect(el.value).toBe('2026-10-27');
    expect(open()).toBe(false);
    expect(root.activeElement).toBe(button);
    expect(events).toEqual(['input 2026-10-27', 'change 2026-10-27']);
    // Escape closes without a change; so does the button.
    await userEvent.click(button);
    await settle(el);
    await userEvent.keyboard('{ArrowRight}{Escape}');
    await settle(el);
    expect(open()).toBe(false);
    expect(el.value).toBe('2026-10-27');
    expect(root.activeElement).toBe(button);
    await userEvent.click(button);
    await userEvent.click(button);
    await settle(el);
    expect(open()).toBe(false);
    // A click on a date chooses it and closes; Clear empties the value and closes.
    await userEvent.click(button);
    await settle(el);
    await userEvent.click(
      calendar.shadowRoot!.querySelector<HTMLElement>('[data-date="2026-11-02"]')!,
    );
    await settle(el);
    expect([el.value, open()]).toEqual(['2026-11-02', false]);
    await userEvent.click(button);
    await settle(el);
    await userEvent.click(calendar.shadowRoot!.querySelector<HTMLElement>('[part~="clear"]')!);
    await settle(el);
    expect([el.value, open()]).toEqual(['', false]);
    expect(events).toHaveLength(6);
  });

  it('opens the calendar on a typed date, and replaces text that is not a date', async () => {
    const { el, control, button, active } = await mount(
      `<odd-date-picker value="2026-10-26"></odd-date-picker>`,
    );
    await userEvent.clear(control);
    await userEvent.type(control, '14/12/2026');
    await userEvent.click(button);
    await settle(el);
    expect(el.value).toBe('2026-12-14');
    expect(active()).toBe('2026-12-14');
    await userEvent.keyboard('{Escape}');
    await type(el, control, 'soon');
    await userEvent.click(button);
    await settle(el);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(control.value).not.toBe('soon');
    expect(el.validity.valid).toBe(true);
  });

  it('is required and bounded as a native date input is', async () => {
    const { el, control } = await mount(
      `<odd-date-picker name="start" required min="2026-10-05" max="2026-11-20"></odd-date-picker><input type="date" required min="2026-10-05" max="2026-11-20">`,
    );
    const native = container.querySelector<HTMLInputElement>('input')!;
    expect(control.required).toBe(true);
    expect(el.validity.valueMissing).toBe(true);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    await type(el, control, '04/10/2026');
    expect(el.value).toBe('2026-10-04');
    native.value = '2026-10-04';
    expect(el.validity.rangeUnderflow).toBe(nativeDate && native.validity.rangeUnderflow);
    expect(el.matches(':state(user-invalid)')).toBe(nativeDate);
    await type(el, control, '21/11/2026');
    native.value = '2026-11-21';
    expect(el.validity.rangeOverflow).toBe(nativeDate && native.validity.rangeOverflow);
    if (nativeDate) expect(el.validationMessage).toBe(native.validationMessage);
    await type(el, control, '05/10/2026');
    expect(el.validity.valid).toBe(true);
  });

  it('is read-only: the calendar opens, nothing changes; submitted, not validated', async () => {
    const { el, form, control, button, open } = await mount(
      `<form><odd-date-picker name="start" value="2026-10-26" readonly required></odd-date-picker></form>`,
    );
    expect(control.readOnly).toBe(true);
    await userEvent.click(button);
    await settle(el);
    expect(open()).toBe(true);
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await settle(el);
    expect(el.value).toBe('2026-10-26');
    await userEvent.keyboard('{Escape}');
    expect(new FormData(form!).get('start')).toBe('2026-10-26');
    el.value = '';
    await settle(el);
    expect(el.willValidate).toBe(false);
    expect(el.validity.valid).toBe(true);
    // Text that is not a date, typed before the field became read-only, is not reported either.
    el.readonly = false;
    await settle(el);
    await type(el, control, 'soon');
    expect(el.validity.badInput).toBe(true);
    el.readonly = true;
    await settle(el);
    expect(el.validity.valid).toBe(true);
  });

  it('is inactive when disabled, also by a fieldset', async () => {
    const { el, part, control, button } = await mount(
      `<fieldset><odd-date-picker label="Publish date" required></odd-date-picker></fieldset>`,
    );
    const fieldset = container.querySelector('fieldset')!;
    // Text that is not a date is not reported either while disabled.
    await type(el, control, 'soon');
    expect(el.validity.badInput).toBe(true);
    for (const disable of [() => (el.disabled = true), () => (fieldset.disabled = true)]) {
      disable();
      await settle(el);
      expect([control.disabled, button.disabled]).toEqual([true, true]);
      expect(getComputedStyle(button).cursor).toBe('not-allowed');
      // Not validated, as a disabled native input.
      expect(el.validity.valid).toBe(true);
      expect(getComputedStyle(part('label')).color).toBe(
        themeValue('color', '--odd-color-text-disabled'),
      );
      el.disabled = false;
      fieldset.disabled = false;
      await settle(el);
      expect(el.validity.badInput).toBe(true);
    }
    await type(el, control, '');
    expect(el.validity.valueMissing).toBe(true);
    // An author's error still shows while disabled.
    el.disabled = true;
    el.error = 'Choose a date.';
    await settle(el);
    expect(el.validity.customError).toBe(true);
    expect(part('error').hidden).toBe(false);
  });

  it('resets to its value attribute and restores a state', async () => {
    const { el, form, control } = await mount(
      `<form><odd-date-picker name="publish" value="2026-10-26"></odd-date-picker></form>`,
    );
    await type(el, control, '01/01/2027');
    expect(el.value).toBe('2027-01-01');
    form!.reset();
    await settle(el);
    expect([el.value, control.value]).toEqual(['2026-10-26', '26/10/2026']);
    await type(el, control, 'nope');
    form!.reset();
    await settle(el);
    expect([el.value, control.value]).toEqual(['2026-10-26', '26/10/2026']);
    // Values that are not dates are empty, as a native date input sanitizes them.
    el.value = '2026-02-30';
    await settle(el);
    expect([el.value, control.value]).toEqual(['', '']);
  });

  it('draws the calendar button as a target on its glyph, and the popup under the field', async () => {
    // Away from the viewport's edges, which placement keeps the popup inside.
    container.style.padding = '48px';
    const { el, root, part, button, calendar } = await mount(
      `<odd-date-picker label="Publish date" value="2026-10-26"></odd-date-picker>`,
    );
    const target = parseFloat(themeValue('inline-size', '--odd-target-min'));
    expect([box(button).width, box(button).height]).toEqual([target, target]);
    const style = getComputedStyle(button);
    expect(style.borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-control-radius'),
    );
    expect(style.borderTopWidth).toBe('0px');
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(style.cursor).toBe('pointer');
    // The 1em glyph keeps its place at the end of the field box; the target is centred on it.
    const glyph = box(button.querySelector('.glyph')!);
    const field = box(root.querySelector('.control-box')!);
    const control = getComputedStyle(part('control'));
    expect(glyph.width).toBeCloseTo(parseFloat(control.fontSize), 1);
    expect(field.right - glyph.right).toBeCloseTo(
      parseFloat(themeValue('padding-top', '--odd-control-padding-inline-md')),
      0,
    );
    expect((box(button).left + box(button).right) / 2).toBeCloseTo(
      (glyph.left + glyph.right) / 2,
      0,
    );
    expect((box(button).top + box(button).bottom) / 2).toBeCloseTo(
      (glyph.top + glyph.bottom) / 2,
      0,
    );
    expect((glyph.top + glyph.bottom) / 2).toBeCloseTo((field.top + field.bottom) / 2, 0);
    await userEvent.hover(button);
    expect(getComputedStyle(button).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-hover'),
    );
    expect(getComputedStyle(button).color).toBe(themeValue('color', '--odd-color-text-primary'));
    // The popup opens under the field box, at its start; the calendar draws no surface of its own.
    await userEvent.click(button);
    await settle(el);
    const popup = box(part('popup'));
    expect(popup.top).toBeGreaterThanOrEqual(field.bottom);
    expect(popup.left).toBeCloseTo(field.left, 0);
    const surface = calendar.shadowRoot!.querySelector('[part~="calendar"]')!;
    expect(getComputedStyle(surface).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(part('popup')).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-raised'),
    );
    await userEvent.keyboard('{Escape}');
    // Disabled, hover does not tint the button.
    el.disabled = true;
    await settle(el);
    await userEvent.hover(button, { force: true });
    expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    const { el, button } = await mount(`<odd-date-picker value="2026-10-26"></odd-date-picker>`);
    await userEvent.click(button);
    await settle(el);
    el.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
