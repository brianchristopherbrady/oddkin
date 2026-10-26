import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { OddkinCalendar } from '../src/calendar/calendar.js';
import type { OddkinDatePicker } from '../src/date-picker/date-picker.js';
import type { OddkinFileInput } from '../src/file-input/file-input.js';
import {
  compare,
  expectNone,
  interact,
  mount,
  settle,
  shadowPart,
  transitions,
  useParity,
  type Target,
} from './parity.js';

// Figma parity of the pickers: the file input, the calendar, and the date picker
// (component-contracts.md §3.3).
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
