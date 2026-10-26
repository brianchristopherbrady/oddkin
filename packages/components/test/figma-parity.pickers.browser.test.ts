import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { OddkinCalendar } from '../src/calendar/calendar.js';
import type { OddkinColorPicker } from '../src/color-picker/color-picker.js';
import type { OddkinDatePicker } from '../src/date-picker/date-picker.js';
import type { OddkinFileInput } from '../src/file-input/file-input.js';
import {
  compare,
  deliberate,
  expectNone,
  interact,
  mount,
  settle,
  shadowPart,
  transitions,
  useParity,
  type Target,
} from './parity.js';

// Figma parity of the pickers: the file input, the calendar, the date picker, and the colour
// picker (component-contracts.md §3.3).
useParity();

describe('Figma parity: odd-file-input (fileUpload)', () => {
  const description = 'PDF, PNG, JPG · Maximum 10 MB';
  for (const state of ['Empty', 'Error', 'Uploaded'] as const)
    it(state, async () => {
      const error = state === 'Error' ? ' error="File is too large"' : '';
      const el = mount(
        `<odd-file-input label="Project attachments" description="${description}"${error}></odd-file-input>`,
      ) as OddkinFileInput;
      await settle(el);
      if (state === 'Uploaded') {
        const input = el.shadowRoot!.querySelector('input')!;
        const data = new DataTransfer();
        data.items.add(new File([new Uint8Array(2_400_000)], 'component-guidelines.pdf'));
        input.files = data.files;
        input.dispatchEvent(new Event('change'));
        await settle(el);
      }
      const frame = `File upload / ${state}`;
      const part = (name: string) => shadowPart(el, name);
      const header = el.shadowRoot!.querySelector<HTMLElement>('.header')!;
      const targets: Target[] = [
        { layer: [frame, 'Project attachments'], el: part('label'), kind: 'text' },
        { layer: [frame, 'Surface'], el: part('surface'), kind: 'frame' },
      ];
      if (state === 'Uploaded') {
        const row = part('file');
        targets.push(
          { layer: [frame, 'Surface', 'Header'], el: row, kind: 'frame', gap: 'column-gap' },
          {
            layer: [frame, 'Surface', 'Header', 'component-guidelines.pdf'],
            el: row.querySelector('.file-name')!,
            kind: 'text',
          },
          {
            layer: [frame, 'Surface', '2.4 MB · Upload complete'],
            el: row.querySelector('.file-size')!,
            kind: 'text',
          },
        );
      } else {
        const title = state === 'Error' ? 'File is too large' : 'Choose a file or drop it here';
        targets.push(
          { layer: [frame, 'Surface', 'Header'], el: header, kind: 'frame', gap: 'column-gap' },
          {
            layer: [frame, 'Surface', 'Header', title],
            el: part(state === 'Error' ? 'error' : 'title'),
            kind: 'text',
          },
          { layer: [frame, 'Surface', description], el: part('description'), kind: 'text' },
        );
      }
      await transitions(targets);
      expectNone(compare('Oddkin/Common/fileUpload', { State: state }, targets));
    });
});

describe('Figma parity: odd-calendar (calendar, calendar/Day)', () => {
  // Figma's today is 24 October 2026; on a real 26 October the chosen date would also be today.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 24, 12));
  });
  afterEach(() => vi.useRealTimers());
  const grid = 'Month grid · Monday first';
  const calendar = async (attributes = '') => {
    const el = mount(
      `<odd-calendar lang="en-GB" value="2026-10-26" first-day="1"${attributes}></odd-calendar>`,
    ) as OddkinCalendar;
    await settle(el);
    return el;
  };
  const day = (el: Element, iso: string) =>
    el.shadowRoot!.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;

  for (const state of ['Default', 'Focus', 'Restricted dates'] as const)
    it(state, async () => {
      const el = await calendar(state === 'Restricted dates' ? ' min="2026-10-05"' : '');
      if (state === 'Focus') {
        el.focus();
        await userEvent.keyboard('{ArrowRight}');
        await settle(el);
      }
      const part = (name: string) => shadowPart(el, name);
      const targets: Target[] = [
        { layer: [], el: part('calendar'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Month navigation'], el: part('header'), kind: 'frame', gap: 'column-gap' },
        { layer: ['Month navigation', 'October 2026'], el: part('heading'), kind: 'text' },
        {
          layer: [grid],
          el: part('grid'),
          kind: 'frame',
          fields: [['itemSpacing', 'border-spacing']],
        },
        { layer: [grid, 'Weekdays', 'Mo', 'Mo'], el: part('weekday'), kind: 'text' },
        { layer: ['Divider'], el: el.shadowRoot!.querySelector('.divider')!, kind: 'frame' },
        { layer: ['Calendar actions'], el: part('actions'), kind: 'frame', gap: 'column-gap' },
      ];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/calendar', { State: state }, targets));
    });

  const days = {
    'Adjacent month': ['2026-11-01', '30'],
    Default: ['2026-10-14', '24'],
    Disabled: ['2026-10-04', '24'],
    Focus: ['2026-10-27', '24'],
    Selected: ['2026-10-26', '26'],
    'Selected focus': ['2026-10-26', '26'],
    Today: ['', '24'],
  } as const;
  for (const [state, [iso, text]] of Object.entries(days))
    it(`Day ${state}`, async () => {
      const el = await calendar(state === 'Disabled' ? ' min="2026-10-05"' : '');
      const focused = state === 'Focus' || state === 'Selected focus';
      // Without a value the current month shows, with today.
      if (state === 'Today') el.value = '';
      if (focused) {
        el.focus();
        await userEvent.keyboard(state === 'Focus' ? '{ArrowRight}' : '{ArrowRight}{ArrowLeft}');
      }
      await settle(el);
      const cell = iso ? day(el, iso) : el.shadowRoot!.querySelector('[aria-current="date"]')!;
      const targets: Target[] = [
        { layer: [], el: cell, kind: 'frame' },
        { layer: [text], el: cell, kind: 'text' },
      ];
      if (focused) {
        expect(cell.matches(':focus-visible')).toBe(true);
        targets.push({ layer: ['Focus ring · 2px / 2px offset'], el: cell, kind: 'ring' });
      }
      await transitions(targets);
      expectNone(compare('Oddkin/Common/calendar/Day', { State: state }, targets));
    });
});

describe('Figma parity: odd-date-picker (datePicker)', () => {
  const field = ['Date field and calendar', 'Field focus boundary'];
  const value = [...field, 'Oddkin/Common/multiselect/Field', 'Value'];
  const description = 'DD / MM / YYYY · Choose a date or type it.';
  const states = {
    Disabled: ' value="2026-10-26" disabled',
    Empty: ' placeholder="Choose a date"',
    Focus: ' value="2026-10-26"',
    Invalid: ' error="Enter a valid date in DD / MM / YYYY."',
    Open: ' value="2026-10-26"',
    Selected: ' value="2026-10-26"',
  } as const;
  for (const [state, attributes] of Object.entries(states))
    it(state, async () => {
      const el = mount(
        `<odd-date-picker lang="en-GB" label="Publish date" description="${description}"${attributes}></odd-date-picker>`,
      ) as OddkinDatePicker;
      await settle(el);
      const part = (name: string) => shadowPart(el, name);
      const control = part('control') as HTMLInputElement;
      if (state === 'Invalid') {
        await userEvent.type(control, '31/02/2026');
        await userEvent.tab();
      }
      if (state === 'Focus') await interact('Focus', control);
      if (state === 'Open') await userEvent.click(part('button'));
      await settle(el);
      const text = { Empty: 'Choose a date', Invalid: '31 / 02 / 2026' }[state as string];
      const targets: Target[] = [
        { layer: [], el: part('field'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Publish date'], el: part('label'), kind: 'text' },
        {
          layer: [...value, text ?? '26 / 10 / 2026'],
          el: control,
          kind: 'text',
          ...(state === 'Empty' ? { pseudo: '::placeholder' } : {}),
        },
      ];
      if (state === 'Invalid')
        targets.push({
          layer: ['Enter a valid date in DD / MM / YYYY.'],
          el: part('error'),
          kind: 'text',
        });
      else targets.push({ layer: [description], el: part('description'), kind: 'text' });
      if (state === 'Focus')
        targets.push({
          layer: [...field, 'Focus ring · 2px / 2px offset'],
          el: control,
          kind: 'ring',
        });
      if (state === 'Open') {
        expect(part('popup').matches(':popover-open')).toBe(true);
        const calendar = el.shadowRoot!.querySelector('odd-calendar')!;
        targets.push({
          layer: ['Date field and calendar', 'Oddkin/Common/popover', 'Content'],
          el: calendar,
          kind: 'frame',
        });
      }
      await transitions(targets);
      expectNone(compare('Oddkin/Common/datePicker', { State: state }, targets));
    });
});

// Figma's five recent colours, as `<option>` children.
const SWATCHES = ['#2563EB', '#D4466C', '#14A39A', '#7C4DCC', '#D9922E']
  .map((color) => `<option value="${color}">${color}</option>`)
  .join('');

describe('Figma parity: odd-color-picker (colorPicker)', () => {
  const field = ['Color field and panel', 'Field focus boundary'];
  const value = [...field, 'Oddkin/Common/multiselect/Field', 'Value'];
  const controls = ['Color field and panel', 'Oddkin/Common/popover', 'Content', 'Color controls'];
  const entries = [...controls, 'Hex and opacity'];
  const description = 'Hex, RGB and opacity describe the selected color.';
  const error = 'Enter a six-digit hex color, such as #2563EB.';
  const states = {
    Closed: ' value="#2563eb"',
    'Custom hex': ' value="#d4466c"',
    Disabled: ' value="#2563eb" disabled',
    Focus: ' value="#2563eb"',
    Invalid: ` value="#2563eb" error="${error}"`,
    Open: ' value="#2563eb"',
  } as const;
  for (const [state, attributes] of Object.entries(states))
    it(state, async () => {
      const el = mount(
        `<odd-color-picker label="Layer color" description="${description}" alpha${attributes}>${SWATCHES}</odd-color-picker>`,
      ) as OddkinColorPicker;
      await settle(el);
      const part = (name: string) => shadowPart(el, name);
      const control = part('control') as HTMLInputElement;
      if (state === 'Invalid') {
        await userEvent.clear(control);
        await userEvent.type(control, '#12ZZ34');
        await userEvent.tab();
      }
      if (state === 'Focus') await interact('Focus', control);
      const open = state === 'Open' || state === 'Custom hex';
      if (open) await userEvent.click(part('button'));
      await settle(el);
      const hex = state === 'Custom hex' ? '#D4466C' : '#2563EB';
      const targets: Target[] = [
        { layer: [], el: part('field'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Layer color'], el: part('label'), kind: 'text' },
        { layer: [...value, state === 'Invalid' ? '#12ZZ34' : hex], el: control, kind: 'text' },
        state === 'Invalid'
          ? { layer: [error], el: part('error'), kind: 'text' }
          : { layer: [description], el: part('description'), kind: 'text' },
      ];
      if (state === 'Focus')
        targets.push({
          layer: [...field, 'Focus ring · 2px / 2px offset'],
          el: control,
          kind: 'ring',
        });
      if (open) {
        expect(part('popup').matches(':popover-open')).toBe(true);
        const root = el.shadowRoot!;
        const [hexEntry, opacityEntry] = root.querySelectorAll<HTMLElement>('.entry');
        const rgb = state === 'Custom hex' ? 'RGB 212, 70, 108' : 'RGB 37, 99, 235';
        const opacity = [...entries, 'Opacity'];
        targets.push(
          { layer: controls, el: root.querySelector('.controls')!, kind: 'frame', gap: 'row-gap' },
          {
            layer: [...controls, 'Saturation and brightness · color data'],
            el: part('area'),
            kind: 'frame',
          },
          {
            layer: [...controls, 'Hue · color data'],
            el: part('hue').querySelector('.track')!,
            kind: 'frame',
          },
          {
            layer: [...controls, 'Hue · color data', 'Ellipse'],
            el: part('hue-thumb'),
            kind: 'frame',
          },
          { layer: entries, el: root.querySelector('.entries')!, kind: 'frame', gap: 'column-gap' },
          { layer: [...entries, 'Hex'], el: hexEntry!, kind: 'frame', gap: 'row-gap' },
          { layer: [...entries, 'Hex', 'Hex'], el: hexEntry!.firstElementChild!, kind: 'text' },
          {
            layer: [...entries, 'Hex', 'Oddkin/Common/multiselect/Field', 'Value', hex],
            el: part('hex'),
            kind: 'text',
          },
          { layer: opacity, el: opacityEntry!, kind: 'frame', gap: 'row-gap' },
          { layer: [...opacity, 'Opacity'], el: opacityEntry!.firstElementChild!, kind: 'text' },
          {
            layer: [...opacity, 'Oddkin/Common/multiselect/Field', 'Value', '100%'],
            el: part('opacity'),
            kind: 'text',
          },
          { layer: [...controls, rgb], el: part('rgb'), kind: 'text' },
          {
            layer: [...controls, 'Recent colors'],
            el: root.querySelector('.swatches-label')!,
            kind: 'text',
          },
          {
            layer: [...controls, 'Recent swatches'],
            el: root.querySelector('.swatch-row')!,
            kind: 'frame',
            gap: 'column-gap',
          },
          {
            layer: [...controls, 'Color actions'],
            el: root.querySelector('.actions')!,
            kind: 'frame',
            gap: 'column-gap',
          },
        );
      }
      await transitions(targets);
      expectNone(compare('Oddkin/Common/colorPicker', { State: state }, targets));
    });
});

describe('Figma parity: odd-color-picker suggested colours (color/Swatch)', () => {
  deliberate([
    /^color\/Swatch \S+ \S+ fills \(none\)/,
    'The swatch is filled with its colour, user data that Figma deliberately binds to no role.',
  ]);
  for (const state of ['Default', 'Disabled', 'Focus', 'Selected'] as const)
    it(state, async () => {
      const disabled = state === 'Disabled' ? ' disabled' : '';
      const el = mount(
        `<odd-color-picker label="Layer color" value="${state === 'Default' ? '#000000' : '#2563eb'}"><option value="#2563eb"${disabled}>Blue</option></odd-color-picker>`,
      ) as OddkinColorPicker;
      await settle(el);
      // Opened from the keyboard, so focus in the popup is visible.
      shadowPart(el, 'button').focus();
      await userEvent.keyboard('{Enter}');
      await settle(el);
      const swatch = shadowPart(el, 'option-swatch');
      if (state === 'Focus') {
        await userEvent.keyboard('{Tab}{Tab}{Tab}');
        expect(swatch.matches(':has(:focus-visible)')).toBe(true);
      }
      expect(swatch.querySelector('input')!.checked).toBe(state !== 'Default');
      const targets: Target[] = [{ layer: [], el: swatch, kind: 'frame' }];
      if (state === 'Focus')
        targets.push({ layer: ['Focus ring · 2px / 2px offset'], el: swatch, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/color/Swatch', { State: state }, targets));
      if (state === 'Disabled') expect(getComputedStyle(swatch).opacity).toBe('0.45');
    });
});
