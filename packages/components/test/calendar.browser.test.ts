import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import type { OddkinCalendar } from '../src/calendar/calendar.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-calendar (component-contracts.md §3.3; Figma calendar, calendar/Day; WAI-ARIA date grid).
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
  const el = container.querySelector('odd-calendar') as OddkinCalendar;
  await settle(el);
  const root = el.shadowRoot!;
  const part = (name: string) => root.querySelector<HTMLElement>(`[part~="${name}"]`)!;
  const day = (iso: string) => root.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
  const days = () => [...root.querySelectorAll<HTMLElement>('[part~="day"]')];
  const active = () => (root.activeElement as HTMLElement | null)?.dataset['date'];
  return { el, root, part, day, days, active, form: container.querySelector('form') };
}

const local = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const box = (el: Element) => el.getBoundingClientRect();
// Engines ship different locale data: expected names come from the same Intl calls.
const full = (lang: string, iso: string) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(iso));
const weekday = (lang: string, iso: string) =>
  new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(iso));
// A native date input exists (Playwright's WebKit on Windows has none: type="date" is text there).
const nativeDate = Object.assign(document.createElement('input'), { type: 'date' }).type === 'date';

describe('imports', () => {
  it('the foundation and the component entry register nothing new', async () => {
    const foundation = await import('../src/calendar/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual(
      [
        'CALENDAR_STRINGS',
        'OddkinCalendar',
        'calendarStructuralStyles',
        'calendarTemplate',
        'fieldStructuralStyles',
        'glyphStyles',
        'hostStyles',
      ].sort(),
    );
    const index = await import('../src/calendar/index.js');
    expect(Object.keys(index)).toContain('calendarDefinition');
  });
});

describe('odd-calendar', () => {
  it('draws the month as a grid named by the month, in a group named by the label', async () => {
    const { el, part, day, days } = await mount(
      `<odd-calendar label="Publish date" description="Any weekday." value="2026-10-26" first-day="1"></odd-calendar>`,
    );
    expect(part('calendar').getAttribute('role')).toBe('group');
    expect(part('calendar').getAttribute('aria-labelledby')).toBe('label');
    expect(part('calendar').getAttribute('aria-describedby')).toBe('description');
    expect(part('label').textContent!.trim()).toBe('Publish date');
    expect(part('grid').getAttribute('role')).toBe('grid');
    expect(part('grid').getAttribute('aria-labelledby')).toBe('heading');
    expect(part('heading').textContent!.trim()).toBe('October 2026');
    expect(part('heading').getAttribute('aria-live')).toBe('polite');
    const weekdays = [...el.shadowRoot!.querySelectorAll('[part~="weekday"]')];
    expect(weekdays.map((w) => w.textContent!.trim())).toEqual(
      // 2026-10-26 is a Monday.
      [26, 27, 28, 29, 30, 31, 1].map((d) =>
        weekday('en-GB', `2026-${d === 1 ? '11' : '10'}-${String(d).padStart(2, '0')}`),
      ),
    );
    expect(weekdays[0]!.textContent!.trim()).toBe('Mon');
    expect(weekdays.map((w) => w.getAttribute('abbr'))[0]).toBe('Monday');
    expect(weekdays.every((w) => w.getAttribute('scope') === 'col')).toBe(true);
    // Six weeks from the Monday before the 1st: 28 September to 8 November.
    expect(days()).toHaveLength(42);
    expect(days()[0]!.dataset['date']).toBe('2026-09-28');
    expect(days()[41]!.dataset['date']).toBe('2026-11-08');
    expect(el.shadowRoot!.querySelectorAll('tbody tr')).toHaveLength(6);
    const chosen = day('2026-10-26');
    expect(chosen.getAttribute('role')).toBe('gridcell');
    expect(chosen.getAttribute('aria-label')).toBe(full('en-GB', '2026-10-26'));
    expect(chosen.textContent!.trim()).toBe('26');
    expect(chosen.getAttribute('aria-selected')).toBe('true');
    expect(chosen.part.contains('day-selected')).toBe(true);
    expect(day('2026-10-27').getAttribute('aria-selected')).toBe('false');
    expect(day('2026-09-30').part.contains('day-outside')).toBe(true);
    expect(day('2026-10-01').part.contains('day-outside')).toBe(false);
    // One Tab stop: the chosen date.
    expect(days().filter((d) => d.tabIndex === 0)).toEqual([chosen]);
    expect(days().every((d) => d.getAttribute('tabindex') !== null)).toBe(true);
    expect(part('description').hidden).toBe(false);
    expect(part('error').hidden).toBe(true);
    // Without a label the group takes the month's name.
    el.label = '';
    el.description = '';
    await settle(el);
    expect(part('label').hidden).toBe(true);
    expect(part('description').hidden).toBe(true);
    expect(part('calendar').getAttribute('aria-labelledby')).toBe('heading');
  });

  it('starts weeks on the first day the language or first-day gives, with names in the language', async () => {
    const { el, days, part } = await mount(
      `<odd-calendar value="2026-10-26" first-day="7"></odd-calendar>`,
    );
    expect(days()[0]!.dataset['date']).toBe('2026-09-27');
    el.firstDay = 3;
    await settle(el);
    expect(days()[0]!.dataset['date']).toBe('2026-09-30');
    // 0 (and anything outside 1 to 7) follows the language: Monday in British English.
    el.firstDay = 0;
    await settle(el);
    expect(days()[0]!.dataset['date']).toBe('2026-09-28');
    el.firstDay = 9;
    await settle(el);
    expect(days()[0]!.dataset['date']).toBe('2026-09-28');
    // American English starts on Sunday, where the browser knows week information.
    const locale = new Intl.Locale('en-US') as Intl.Locale & {
      getWeekInfo?: unknown;
      weekInfo?: unknown;
    };
    const known = !!(locale.getWeekInfo ?? locale.weekInfo);
    el.firstDay = 0;
    el.lang = 'en-US';
    el.value = '2026-10-26';
    await settle(el);
    expect(days()[0]!.dataset['date']).toBe(known ? '2026-09-27' : '2026-09-28');
    el.lang = 'de';
    el.firstDay = 1;
    el.value = '2026-03-02';
    await settle(el);
    expect(part('heading').textContent!.trim()).toBe('März 2026');
    expect(el.shadowRoot!.querySelector('[part~="weekday"]')!.textContent!.trim()).toBe(
      weekday('de', '2026-03-02'),
    );
    expect(
      el.shadowRoot!.querySelector('[data-date="2026-03-02"]')!.getAttribute('aria-label'),
    ).toBe(full('de', '2026-03-02'));
  });

  it('marks today, and the dates outside min and max or disabled by the hook', async () => {
    const today = new Date();
    const { el, day } = await mount(`<odd-calendar></odd-calendar>`);
    const now = day(local(today));
    expect(now.getAttribute('aria-current')).toBe('date');
    expect(now.part.contains('day-today')).toBe(true);
    // No value: today holds the Tab stop.
    expect(now.tabIndex).toBe(0);
    el.value = '2026-10-26';
    el.firstDay = 1;
    el.min = '2026-10-05';
    el.max = '2026-10-29';
    el.isDateDisabled = (date) => [0, 6].includes(new Date(date).getUTCDay());
    await settle(el);
    const states = (iso: string) => [
      day(iso).getAttribute('aria-disabled'),
      day(iso).part.contains('day-disabled'),
    ];
    expect(states('2026-10-04')).toEqual(['true', true]);
    expect(states('2026-10-05')).toEqual([null, false]);
    expect(states('2026-10-10')).toEqual(['true', true]);
    expect(states('2026-10-29')).toEqual([null, false]);
    expect(states('2026-10-30')).toEqual(['true', true]);
    // Removing the hook enables weekends again.
    el.isDateDisabled = undefined;
    await settle(el);
    expect(states('2026-10-10')).toEqual([null, false]);
  });

  it('keeps a YYYY-MM-DD value, as a native date input sanitizes and submits it', async () => {
    const { el, form } = await mount(
      `<form><odd-calendar name="publish" value="2026-10-26"></odd-calendar><input type="date" name="native" value="2026-10-26"></form>`,
    );
    const native = form!.querySelector<HTMLInputElement>('input')!;
    expect(new FormData(form!).get('publish')).toBe('2026-10-26');
    for (const wrong of ['2026-02-30', '26/10/2026', '2026-1-5', '0000-01-01', 'today']) {
      el.value = wrong;
      native.value = wrong;
      await settle(el);
      expect(el.value, wrong).toBe(nativeDate ? native.value : '');
    }
    // Empty submits an empty entry under the name.
    expect(new FormData(form!).get('publish')).toBe('');
    // Years before 1000 keep four digits, in the cells too.
    el.value = '0999-05-01';
    await settle(el);
    expect(el.shadowRoot!.querySelector('[aria-selected="true"]')!.getAttribute('data-date')).toBe(
      '0999-05-01',
    );
    el.value = '2028-02-29';
    await settle(el);
    expect(new FormData(form!).get('publish')).toBe('2028-02-29');
    // Reset returns to the attribute; the attribute is the default once the value is dirty.
    el.setAttribute('value', '2026-11-03');
    await settle(el);
    expect(el.value).toBe('2028-02-29');
    form!.reset();
    await settle(el);
    expect(el.value).toBe('2026-11-03');
    expect(el.defaultValue).toBe('2026-11-03');
  });

  it('is required, and reports dates outside min and max, as a native date input', async () => {
    const { el, form, part } = await mount(
      `<form><odd-calendar name="start" required value="2026-10-26" first-day="1"></odd-calendar></form>`,
    );
    expect(el.validity.valid).toBe(true);
    el.value = '';
    await settle(el);
    expect(el.validity.valueMissing).toBe(true);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    // A blocked submission shows the error state and points at the date with the Tab stop.
    expect(form!.checkValidity()).toBe(false);
    form!.requestSubmit();
    await settle(el);
    expect(el.matches(':state(user-invalid)')).toBe(true);
    expect(part('calendar').getAttribute('aria-invalid')).toBe('true');
    el.value = '2026-10-26';
    await settle(el);
    expect(el.validity.valid).toBe(true);
    if (nativeDate) {
      el.min = '2026-10-27';
      await settle(el);
      expect(el.validity.rangeUnderflow).toBe(true);
      el.min = '';
      el.max = '2026-10-25';
      await settle(el);
      expect(el.validity.rangeOverflow).toBe(true);
      el.max = '';
      await settle(el);
    }
    expect(el.validity.valid).toBe(true);
  });

  it('marks the field touched only when focus leaves the calendar', async () => {
    const { el, part } = await mount(
      `<odd-calendar required first-day="1"></odd-calendar><button>After</button>`,
    );
    // Focus moving from date to date, and to the month buttons, stays in the calendar.
    el.focus();
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect(el.matches(':state(user-invalid)')).toBe(false);
    // Shift+Tab, not a click: WebKit does not focus a clicked button.
    await userEvent.tab({ shift: true });
    await settle(el);
    expect(el.shadowRoot!.activeElement).toBe(part('next'));
    expect(el.matches(':state(user-invalid)')).toBe(false);
    const after = container.querySelector<HTMLButtonElement>('button')!;
    after.focus();
    await settle(el);
    expect(el.matches(':state(user-invalid)')).toBe(true);
    // Setting the value shows its month without taking focus.
    el.value = '2027-01-15';
    await settle(el);
    expect(document.activeElement).toBe(after);
  });

  it('moves by the APG date grid keys and chooses with Enter and Space', async () => {
    const { el, active, part } = await mount(
      `<odd-calendar value="2026-10-26" first-day="1"></odd-calendar>`,
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input ${el.value}`));
    el.addEventListener('change', () => events.push(`change ${el.value}`));
    // The keys it handles do not also scroll the page.
    const free: string[] = [];
    el.addEventListener('keydown', (event) => {
      if (!event.defaultPrevented && !['Shift', 'Control'].includes(event.key))
        free.push(event.key);
    });
    el.focus();
    expect(active()).toBe('2026-10-26');
    const press = async (key: string, expected: string) => {
      await userEvent.keyboard(key);
      await settle(el);
      expect(active(), key).toBe(expected);
    };
    await press('{ArrowRight}', '2026-10-27');
    await press('{ArrowLeft}', '2026-10-26');
    await press('{ArrowDown}', '2026-11-02');
    expect(part('heading').textContent!.trim()).toBe('November 2026');
    await press('{ArrowUp}', '2026-10-26');
    await press('{End}', '2026-11-01');
    await press('{Home}', '2026-10-26');
    await press('{ArrowLeft}', '2026-10-25');
    await press('{Home}', '2026-10-19');
    await press('{End}', '2026-10-25');
    await press('{PageDown}', '2026-11-25');
    await press('{PageUp}', '2026-10-25');
    // The 31st becomes the month's last day.
    el.value = '2026-01-31';
    await settle(el);
    el.focus();
    await press('{PageDown}', '2026-02-28');
    await press('{Shift>}{PageDown}{/Shift}', '2027-02-28');
    await press('{Shift>}{PageUp}{/Shift}', '2026-02-28');
    expect(events).toEqual([]);
    await press('{Enter}', '2026-02-28');
    expect(el.value).toBe('2026-02-28');
    await press('{ArrowRight}', '2026-03-01');
    await press(' ', '2026-03-01');
    expect(el.value).toBe('2026-03-01');
    expect(events).toEqual([
      'input 2026-02-28',
      'change 2026-02-28',
      'input 2026-03-01',
      'change 2026-03-01',
    ]);
    // Choosing the chosen date again changes nothing.
    await press('{Enter}', '2026-03-01');
    expect(events).toHaveLength(4);
    // Modified keys are the browser's.
    await press('{Control>}{ArrowRight}{/Control}', '2026-03-01');
    expect(free).toEqual(['ArrowRight']);
  });

  it('swaps Left and Right in right-to-left text', async () => {
    const { el, active } = await mount(
      `<odd-calendar dir="rtl" value="2026-10-26" first-day="1"></odd-calendar>`,
    );
    el.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await settle(el);
    expect(active()).toBe('2026-10-27');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await settle(el);
    expect(active()).toBe('2026-10-25');
  });

  it('stops at min and max, and moves onto dates it cannot choose without choosing them', async () => {
    const { el, active, part } = await mount(
      `<odd-calendar value="2026-10-06" min="2026-10-05" max="2026-10-29" first-day="1"></odd-calendar>`,
    );
    el.isDateDisabled = (date) => date === '2026-10-07';
    await settle(el);
    el.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await settle(el);
    expect(active()).toBe('2026-10-05');
    await userEvent.keyboard('{PageUp}');
    await settle(el);
    expect(active()).toBe('2026-10-05');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await settle(el);
    expect(active()).toBe('2026-10-07');
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.value).toBe('2026-10-06');
    await userEvent.keyboard('{PageDown}');
    await settle(el);
    expect(active()).toBe('2026-10-29');
    // The months outside min and max cannot be shown.
    expect((part('previous') as HTMLButtonElement).disabled).toBe(true);
    expect((part('next') as HTMLButtonElement).disabled).toBe(true);
    // Lifting max keeps the date the keys stopped at.
    el.max = '';
    await settle(el);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[tabindex="0"]')!.dataset['date']).toBe(
      '2026-10-29',
    );
    el.max = '2026-10-29';
    // A value outside min and max shows the nearest date.
    el.value = '2026-12-24';
    await settle(el);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[tabindex="0"]')!.dataset['date']).toBe(
      '2026-10-29',
    );
  });

  it('chooses a clicked date, and follows a date of another month there', async () => {
    const { el, day, part, active } = await mount(
      `<odd-calendar value="2026-10-26" first-day="1" min="2026-09-29"></odd-calendar>`,
    );
    const events: string[] = [];
    el.addEventListener('input', () => events.push(`input ${el.value}`));
    el.addEventListener('change', () => events.push(`change ${el.value}`));
    await userEvent.click(day('2026-10-14'));
    await settle(el);
    expect(el.value).toBe('2026-10-14');
    expect(active()).toBe('2026-10-14');
    await userEvent.click(day('2026-11-02'));
    await settle(el);
    expect(el.value).toBe('2026-11-02');
    expect(part('heading').textContent!.trim()).toBe('November 2026');
    expect(active()).toBe('2026-11-02');
    // A date before min does nothing.
    await userEvent.click(part('previous'));
    await userEvent.click(part('previous'));
    await settle(el);
    // Playwright waits for an aria-disabled cell to enable: click it as the DOM does.
    day('2026-09-28').click();
    await settle(el);
    expect(el.value).toBe('2026-11-02');
    expect(events).toEqual([
      'input 2026-10-14',
      'change 2026-10-14',
      'input 2026-11-02',
      'change 2026-11-02',
    ]);
  });

  it('shows other months from its buttons, keeping focus there and the date in the month', async () => {
    const { el, part, root } = await mount(
      `<odd-calendar value="2026-01-31" first-day="1"></odd-calendar>`,
    );
    part('next').focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(part('heading').textContent!.trim()).toBe('February 2026');
    expect(root.activeElement).toBe(part('next'));
    expect(root.querySelector<HTMLElement>('[tabindex="0"]')!.dataset['date']).toBe('2026-02-28');
    await userEvent.click(part('previous'));
    await settle(el);
    expect(part('heading').textContent!.trim()).toBe('January 2026');
    expect(el.value).toBe('2026-01-31');
    // Setting the value shows its month.
    el.value = '2027-06-15';
    await settle(el);
    expect(part('heading').textContent!.trim()).toBe('June 2027');
  });

  it('is read-only: the dates can be moved through, not chosen; submitted, not validated', async () => {
    const { el, form, part, active, day } = await mount(
      `<form><odd-calendar name="start" value="2026-10-26" first-day="1" readonly required></odd-calendar></form>`,
    );
    expect(part('grid').getAttribute('aria-readonly')).toBe('true');
    el.focus();
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    expect(active()).toBe('2026-10-27');
    await userEvent.keyboard('{Enter}');
    day('2026-10-28').click();
    await settle(el);
    expect(el.value).toBe('2026-10-26');
    for (const name of ['today', 'clear'])
      expect((part(name) as HTMLButtonElement).disabled, name).toBe(true);
    expect(new FormData(form!).get('start')).toBe('2026-10-26');
    el.value = '';
    await settle(el);
    expect(el.willValidate).toBe(false);
    expect(el.checkValidity()).toBe(true);
    expect(el.validity.valid).toBe(true);
  });

  it('chooses today and clears from its actions', async () => {
    const today = local(new Date());
    const { el, part } = await mount(`<odd-calendar value="2020-02-02"></odd-calendar>`);
    const events: string[] = [];
    el.addEventListener('change', () => events.push(el.value));
    expect(part('today').textContent!.trim()).toBe('Today');
    expect(part('clear').textContent!.trim()).toBe('Clear');
    await userEvent.click(part('today'));
    await settle(el);
    expect(el.value).toBe(today);
    await userEvent.click(part('clear'));
    await settle(el);
    expect(el.value).toBe('');
    expect((part('clear') as HTMLButtonElement).disabled).toBe(true);
    expect(events).toEqual([today, '']);
    // Today cannot be chosen outside min and max.
    el.max = '2020-01-01';
    await settle(el);
    expect((part('today') as HTMLButtonElement).disabled).toBe(true);
    el.strings = { today: 'Heute', clear: 'Leeren', previousMonth: 'Zurück', nextMonth: 'Weiter' };
    await settle(el);
    expect(
      [part('today'), part('clear')]
        .map((b) => b.textContent!.trim())
        .concat([part('previous'), part('next')].map((b) => b.getAttribute('aria-label')!)),
    ).toEqual(['Heute', 'Leeren', 'Zurück', 'Weiter']);
  });

  it('checks today again when Today is pressed: midnight may have passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 9, 26, 23, 59));
      const { el, part } = await mount(`<odd-calendar max="2026-10-26"></odd-calendar>`);
      expect((part('today') as HTMLButtonElement).disabled).toBe(false);
      vi.setSystemTime(new Date(2026, 9, 27, 0, 1));
      part('today').click();
      await settle(el);
      expect(el.value).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps its buttons whole when narrower than the month', async () => {
    const { part } = await mount(`<odd-calendar value="2026-10-26"></odd-calendar>`);
    const names = ['previous', 'next', 'today', 'clear'];
    const wide = names.map((name) => box(part(name)).width);
    container.style.inlineSize = '100px';
    names.forEach((name, i) => expect(box(part(name)).width, name).toBeCloseTo(wide[i]!, 1));
  });

  it('is one Tab stop between its month buttons and actions', async () => {
    const { root } = await mount(
      `<button>Before</button><odd-calendar value="2026-10-26"></odd-calendar><button>After</button>`,
    );
    container.querySelector('button')!.focus();
    const order: (string | undefined)[] = [];
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      const focused = root.activeElement as HTMLElement | null;
      order.push(focused?.dataset['date'] ?? focused?.getAttribute('part') ?? undefined);
    }
    expect(order).toEqual(['previous', 'next', '2026-10-26', 'today', 'clear']);
    await userEvent.tab();
    expect(document.activeElement!.textContent).toBe('After');
  });

  it('is inactive when disabled, also by a fieldset', async () => {
    const { el, part, days, day } = await mount(
      `<fieldset><odd-calendar value="2026-10-26"></odd-calendar></fieldset>`,
    );
    const fieldset = container.querySelector('fieldset')!;
    for (const disable of [() => (el.disabled = true), () => (fieldset.disabled = true)]) {
      // A date focused as the calendar becomes disabled takes no more keys.
      el.focus();
      disable();
      await settle(el);
      await userEvent.keyboard('{ArrowRight}{Enter}');
      await settle(el);
      expect(days().every((d) => d.getAttribute('tabindex') === null)).toBe(true);
      expect(days().every((d) => d.getAttribute('aria-disabled') === 'true')).toBe(true);
      expect(part('grid').getAttribute('aria-disabled')).toBe('true');
      // The field's texts belong to the disabled control (axe skips their contrast, WCAG 1.4.3).
      expect(part('field').getAttribute('aria-disabled')).toBe('true');
      for (const name of ['previous', 'next', 'today', 'clear'])
        expect((part(name) as HTMLButtonElement).disabled, name).toBe(true);
      day('2026-10-27').click();
      await settle(el);
      expect(el.value).toBe('2026-10-26');
      expect(getComputedStyle(part('label')).color).toBe(
        themeValue('color', '--odd-color-text-disabled'),
      );
      el.disabled = false;
      fieldset.disabled = false;
      await settle(el);
      expect(el.shadowRoot!.querySelector<HTMLElement>('[tabindex="0"]')!.dataset['date']).toBe(
        '2026-10-26',
      );
    }
    // Disabled, it is not validated, as odd-input; an author's error still shows.
    el.required = true;
    el.value = '';
    el.disabled = true;
    await settle(el);
    expect(el.validity.valid).toBe(true);
    el.error = 'Choose a date.';
    await settle(el);
    expect(el.validity.customError).toBe(true);
    expect(part('error').hidden).toBe(false);
    expect(part('error').textContent!.trim()).toBe('Choose a date.');
  });

  it('matches Figma calendar: surface, rows, cells, and their states', async () => {
    const { el, part, day } = await mount(
      `<odd-calendar value="2026-10-26" first-day="1" min="2026-10-05"></odd-calendar>`,
    );
    const surface = getComputedStyle(part('calendar'));
    const md = themeValue('padding-top', '--odd-space-md');
    expect([surface.paddingTop, surface.paddingInlineStart]).toEqual([md, md]);
    expect(surface.backgroundColor).toBe(themeValue('color', '--odd-color-surface-raised'));
    expect(surface.rowGap).toBe(themeValue('row-gap', '--odd-space-sm'));
    const cell = day('2026-10-14');
    const size = parseFloat(themeValue('block-size', '--odd-control-height-md'));
    expect([box(cell).width, box(cell).height]).toEqual([size, size]);
    const gap = parseFloat(themeValue('inline-size', '--odd-space-2xs'));
    expect(box(day('2026-10-15')).left - box(cell).right).toBeCloseTo(gap, 1);
    expect(box(day('2026-10-21')).top - box(cell).bottom).toBeCloseTo(gap, 1);
    // The grid sits inside the padding: its first cell starts where the padding ends.
    expect(box(day('2026-09-28')).left - box(part('calendar')).left).toBeCloseTo(parseFloat(md), 1);
    expect(getComputedStyle(cell).borderTopLeftRadius).toBe(
      themeValue('border-top-left-radius', '--odd-radius-sm'),
    );
    expect(getComputedStyle(cell).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(getComputedStyle(day('2026-11-01')).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    expect(getComputedStyle(day('2026-10-04')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
    const chosen = getComputedStyle(day('2026-10-26'));
    expect(chosen.backgroundColor).toBe(themeValue('color', '--odd-color-action-default'));
    expect(chosen.color).toBe(themeValue('color', '--odd-color-text-on-action'));
    const weekdayCell = el.shadowRoot!.querySelector('[part~="weekday"]')!;
    const weekday = getComputedStyle(weekdayCell);
    expect(weekday.color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(weekday.fontSize).toBe(themeValue('font-size', '--odd-type-small-size'));
    expect(box(weekdayCell).height).toBeCloseTo(
      parseFloat(themeValue('block-size', '--odd-space-lg')),
      1,
    );
    expect(getComputedStyle(part('heading')).fontSize).toBe(
      themeValue('font-size', '--odd-type-ui-size'),
    );
    // The month centred between its buttons, with their glyphs at the medium icon size.
    expect(getComputedStyle(part('heading')).textAlign).toBe('center');
    expect(box(part('previous').querySelector('.glyph')!).width).toBe(
      parseFloat(themeValue('inline-size', '--odd-icon-size-md')),
    );
    // Today and Clear at the ends of their row.
    expect(box(part('today')).left).toBeCloseTo(box(part('actions')).left, 1);
    expect(box(part('clear')).right).toBeCloseTo(box(part('actions')).right, 1);
    // Hover tints a date that can be chosen, not one that cannot.
    await userEvent.hover(cell);
    await Promise.all(cell.getAnimations().map((animation) => animation.finished));
    expect(getComputedStyle(cell).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-hover'),
    );
    await userEvent.hover(day('2026-10-04'));
    expect(getComputedStyle(day('2026-10-04')).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    // Today is outlined in the action colour.
    el.value = '';
    el.min = '';
    await settle(el);
    const today = el.shadowRoot!.querySelector('[aria-current="date"]')!;
    expect(getComputedStyle(today).borderTopColor).toBe(
      themeValue('color', '--odd-color-action-default'),
    );
    // The divider over the actions, and the month buttons at the small control height.
    const divider = el.shadowRoot!.querySelector('.divider')!;
    expect(getComputedStyle(divider).backgroundColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
    expect(box(divider).height).toBeCloseTo(
      parseFloat(themeValue('block-size', '--odd-border-width-default')),
      1,
    );
    const sm = parseFloat(themeValue('block-size', '--odd-control-height-sm'));
    expect([box(part('previous')).width, box(part('previous')).height]).toEqual([sm, sm]);
    expect(box(part('today')).height).toBe(sm);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the chosen date, today, and disabled dates apart in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el, day } = await mount(
          `<odd-calendar value="2026-10-26" first-day="1" min="2026-10-05"></odd-calendar>`,
        );
        await settle(el);
        const probe = document.createElement('span');
        container.append(probe);
        const system = (color: string) => {
          probe.style.color = color;
          return getComputedStyle(probe).color;
        };
        const chosen = getComputedStyle(day('2026-10-26'));
        expect(chosen.backgroundColor).toBe(system('SelectedItem'));
        expect(chosen.color).toBe(system('SelectedItemText'));
        expect(getComputedStyle(day('2026-10-04')).color).toBe(system('GrayText'));
        // Today is outlined; other dates are not.
        el.value = '';
        el.min = '';
        await settle(el);
        const now = el.shadowRoot!.querySelector('[aria-current="date"]')!;
        const other = el.shadowRoot!.querySelector('[part="day"]:not([aria-current])')!;
        expect(getComputedStyle(now).borderTopColor).toBe(system('CanvasText'));
        expect(getComputedStyle(other).borderTopColor).not.toBe(system('CanvasText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed', async () => {
    const before = scopeStats();
    const { el } = await mount(`<odd-calendar value="2026-10-26"></odd-calendar>`);
    el.focus();
    await userEvent.keyboard('{ArrowRight}');
    await settle(el);
    el.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
