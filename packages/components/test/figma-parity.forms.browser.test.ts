import { describe, it } from 'vitest';
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

// Figma parity of the form controls (Agent 1 lane): each variant of the Common page (158:22)
// mounted with the attributes that produce it; each bound layer compared with its part's computed
// style (parity.ts).
useParity();

describe('Figma parity: checkbox', () => {
  const selections = { Unchecked: '', Checked: ' checked', Mixed: ' indeterminate' };
  const states = {
    Default: '',
    Hover: '',
    Focus: '',
    Disabled: ' disabled',
    Invalid: ' error="Required"',
  };
  for (const [selection, selectionAttribute] of Object.entries(selections))
    for (const [state, stateAttribute] of Object.entries(states))
      it(`${selection}/${state}`, async () => {
        const el = mount(
          `<odd-checkbox${selectionAttribute}${stateAttribute}>Email notifications</odd-checkbox>`,
        );
        await settle(el);
        const control = shadowPart(el, 'control');
        await interact(state, control);
        await settle(el);
        const name =
          selection !== 'Unchecked' ? selection : state === 'Default' ? selection : state;
        const root = `Checkbox / ${name}`;
        const targets: Target[] = [
          {
            layer: [root],
            el: el.shadowRoot!.querySelector('.choice')!,
            kind: 'frame',
            gap: 'column-gap',
          },
          { layer: [root, 'Email notifications'], el: shadowPart(el, 'label'), kind: 'text' },
          { layer: [root, 'Surface'], el: control, kind: 'frame' },
        ];
        if (state === 'Focus')
          targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
        if (state === 'Invalid' && selection === 'Unchecked')
          targets.push({ layer: [root, 'Required'], el: shadowPart(el, 'error'), kind: 'text' });
        await transitions(targets);
        expectNone(
          compare('Oddkin/Common/checkbox', { Selection: selection, State: state }, targets),
        );
      });
});

describe('Figma parity: switch', () => {
  for (const value of ['Off', 'On'])
    for (const [state, attribute] of Object.entries({
      Default: '',
      Hover: '',
      Focus: '',
      Disabled: ' disabled',
    }))
      it(`${value}/${state}`, async () => {
        const checked = value === 'On' ? ' checked' : '';
        const el = mount(`<odd-switch${checked}${attribute}>Notifications</odd-switch>`);
        await settle(el);
        const control = shadowPart(el, 'control');
        await interact(state, control);
        await settle(el);
        const root = `Switch / ${value === 'On' || state === 'Default' ? value : state}`;
        const targets: Target[] = [
          { layer: [root], el: el.shadowRoot!.querySelector('.choice')!, kind: 'frame' },
          {
            layer: [root, `Notifications ${value.toLowerCase()}`],
            el: shadowPart(el, 'label'),
            kind: 'text',
          },
          { layer: [root, 'Surface'], el: control, kind: 'frame' },
          { layer: [root, 'Surface', 'Ellipse'], el: shadowPart(el, 'thumb'), kind: 'frame' },
        ];
        if (state === 'Focus')
          targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
        await transitions(targets);
        expectNone(compare('Oddkin/Common/switch', { Value: value, State: state }, targets));
      });
});

describe('Figma parity: toggleButton', () => {
  for (const value of ['Off', 'On'])
    for (const [state, attribute] of Object.entries({
      Default: '',
      Hover: '',
      Focus: '',
      Disabled: ' disabled',
    }))
      it(`${value}/${state}`, async () => {
        const pressed = value === 'On' ? ' pressed' : '';
        const el = mount(`<odd-button toggle${pressed}${attribute}>Bold</odd-button>`);
        await settle(el);
        const control = shadowPart(el, 'control');
        await interact(state, control);
        await settle(el);
        const named = value === 'On' || state === 'Default' || state === 'Hover';
        const root = `Toggle button / ${named ? value : state}`;
        const targets: Target[] = [
          { layer: [root, 'Surface'], el: control, kind: 'frame' },
          {
            layer: [root, 'Surface', value === 'On' ? 'Bold \u00b7 on' : 'Bold'],
            el: el.shadowRoot!.querySelector('.label')!,
            kind: 'text',
          },
        ];
        if (state === 'Focus')
          targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
        await transitions(targets);
        expectNone(compare('Oddkin/Common/toggleButton', { Value: value, State: state }, targets));
      });
});

describe('Figma parity: odd-input types (number, search, dateTime)', () => {
  for (const state of ['Default', 'Disabled', 'Focus'])
    it(`number ${state}`, async () => {
      const disabled = state === 'Disabled' ? ' disabled' : '';
      const el = mount(
        `<odd-input type="number" label="Seats" description="1–50 seats available." value="12" min="1" max="50"${disabled}></odd-input>`,
      );
      await settle(el);
      const control = shadowPart(el, 'control');
      await interact(state, control);
      await settle(el);
      const root = `Number input / ${state}`;
      const targets: Target[] = [
        { layer: [root, 'Seats'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: [root, '1–50 seats available.'], el: shadowPart(el, 'description'), kind: 'text' },
        { layer: [root, 'Surface'], el: control, kind: 'frame' },
        { layer: [root, 'Surface', '12'], el: control, kind: 'text' },
      ];
      if (state === 'Focus')
        targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/number', { State: state }, targets));
    });

  for (const state of ['Empty', 'Filled', 'Focus', 'Disabled'])
    it(`search ${state}`, async () => {
      const value = state === 'Empty' ? 'placeholder="Search…"' : 'value="Design system"';
      const disabled = state === 'Disabled' ? ' disabled' : '';
      const el = mount(
        `<odd-input type="search" label="Search projects" description="Search by name or description." ${value}${disabled}></odd-input>`,
      );
      await settle(el);
      const control = shadowPart(el, 'control');
      await interact(state, control);
      await settle(el);
      const root = `Search input / ${state}`;
      const targets: Target[] = [
        { layer: [root, 'Search projects'], el: shadowPart(el, 'label'), kind: 'text' },
        {
          layer: [root, 'Search by name or description.'],
          el: shadowPart(el, 'description'),
          kind: 'text',
        },
        { layer: [root, 'Surface'], el: control, kind: 'frame' },
        state === 'Empty'
          ? {
              layer: [root, 'Surface', 'Search…'],
              el: control,
              kind: 'text',
              pseudo: '::placeholder',
            }
          : { layer: [root, 'Surface', 'Design system'], el: control, kind: 'text' },
      ];
      if (state === 'Focus')
        targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/search', { State: state }, targets));
    });

  for (const state of ['Default', 'Focus', 'Invalid'])
    it(`dateTime ${state}`, async () => {
      const invalid = state === 'Invalid';
      const box = mount(
        `<div><odd-input type="date" label="Publish date" ${invalid ? 'error="Enter a valid date."' : 'description="Uses your local date and time format." value="2026-10-24"'}></odd-input><odd-input type="time" label="Time" value="09:30"></odd-input></div>`,
      );
      const [date, time] = [...box.querySelectorAll('odd-input')] as HTMLElement[];
      await settle(date!);
      await settle(time!);
      const dateControl = shadowPart(date!, 'control');
      await interact(state, dateControl);
      await settle(date!);
      const root = `Date / time input / ${state}`;
      const targets: Target[] = [
        { layer: [root, 'Publish date'], el: shadowPart(date!, 'label'), kind: 'text' },
        { layer: [root, 'Time'], el: shadowPart(time!, 'label'), kind: 'text' },
        { layer: [root, 'Surface'], el: dateControl, kind: 'frame' },
        {
          layer: [root, 'Surface', invalid ? 'mm / dd / yyyy' : '10 / 24 / 2026'],
          el: dateControl,
          kind: 'text',
        },
        { layer: [root, 'Surface [2]'], el: shadowPart(time!, 'control'), kind: 'frame' },
        {
          layer: [root, 'Surface [2]', '09 : 30 AM'],
          el: shadowPart(time!, 'control'),
          kind: 'text',
        },
      ];
      if (invalid)
        targets.push({
          layer: [root, 'Enter a valid date.'],
          el: shadowPart(date!, 'error'),
          kind: 'text',
        });
      else
        targets.push({
          layer: [root, 'Uses your local date and time format.'],
          el: shadowPart(date!, 'description'),
          kind: 'text',
        });
      if (state === 'Focus')
        targets.push({ layer: [root, 'Surface [3]'], el: dateControl, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/dateTime', { State: state }, targets));
    });
});

describe('Figma parity: textarea', () => {
  const filled = 'A shared home for our component foundations.';
  const text = 'A shared home for our\ncomponent foundations.';
  const states: Record<string, string> = {
    Empty: 'placeholder="Describe this project…" maxlength="500"',
    Filled: `value="${filled}" maxlength="500"`,
    Focus: `value="${filled}" maxlength="500"`,
    Invalid:
      'placeholder="Describe this project…" maxlength="500" required error="Description is required."',
    Disabled: `value="${filled}" maxlength="500" disabled`,
  };
  for (const [state, attributes] of Object.entries(states))
    it(state, async () => {
      const el = mount(`<odd-textarea label="Project description" ${attributes}></odd-textarea>`);
      await settle(el);
      const control = shadowPart(el, 'control');
      await interact(state, control);
      await settle(el);
      const root = `Textarea / ${state}`;
      const targets: Target[] = [
        { layer: [root, 'Project description'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: [root, 'Surface'], el: control, kind: 'frame' },
      ];
      if (state === 'Empty')
        targets.push(
          {
            layer: [root, 'Describe this project…'],
            el: control,
            kind: 'text',
            pseudo: '::placeholder',
          },
          { layer: [root, '0 / 500 characters'], el: shadowPart(el, 'count'), kind: 'text' },
        );
      else if (state === 'Invalid')
        targets.push(
          // The snapshot names the placeholder layer after the filled text.
          { layer: [root, text], el: control, kind: 'text', pseudo: '::placeholder' },
          { layer: [root, 'Description is required.'], el: shadowPart(el, 'error'), kind: 'text' },
        );
      else
        targets.push(
          { layer: [root, text], el: control, kind: 'text' },
          { layer: [root, '44 / 500 characters'], el: shadowPart(el, 'count'), kind: 'text' },
        );
      if (state === 'Focus')
        targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/textarea', { State: state }, targets));
    });
});
