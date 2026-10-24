import { describe, it } from 'vitest';
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

describe('Figma parity: CheckboxGroup', () => {
  const description = 'Choose how you want to hear about project updates.';
  const states: Record<string, string> = {
    Default: '',
    Disabled: ' disabled',
    Invalid: ' required error="Choose at least one notification method."',
  };
  for (const [state, attributes] of Object.entries(states))
    it(state, async () => {
      const el = mount(
        `<odd-checkbox-group label="Notifications" description="${description}"${attributes}><odd-checkbox>Email notifications</odd-checkbox><odd-checkbox>Desktop notifications</odd-checkbox></odd-checkbox-group>`,
      );
      await settle(el);
      const root = 'Checkbox group';
      const targets: Target[] = [
        { layer: [root], el: shadowPart(el, 'field'), kind: 'frame', gap: 'row-gap' },
        { layer: [root, 'Legend'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: [root, description], el: shadowPart(el, 'description'), kind: 'text' },
      ];
      if (state === 'Invalid')
        targets.push({
          layer: [root, 'Choose at least one notification method.'],
          el: shadowPart(el, 'error'),
          kind: 'text',
        });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/CheckboxGroup', { State: state }, targets));
    });
});

describe('Figma parity: radio', () => {
  const states = {
    Default: '',
    Hover: '',
    Focus: '',
    Disabled: ' disabled',
    Invalid: ' error="Required"',
  };
  for (const selection of ['Unchecked', 'Checked'])
    for (const [state, attribute] of Object.entries(states))
      it(`${selection}/${state}`, async () => {
        const value = selection === 'Checked' ? ' value="a"' : '';
        const el = mount(
          `<odd-radio-group${value}${attribute}><option value="a">Standard workspace</option></odd-radio-group>`,
        );
        await settle(el);
        const control = el.shadowRoot!.querySelector('input')!;
        await interact(state, control);
        await settle(el);
        const name = selection === 'Checked' ? 'Selected' : state === 'Default' ? selection : state;
        const root = `Radio / ${name}`;
        const targets: Target[] = [
          {
            layer: [root],
            el: el.shadowRoot!.querySelector('.choice')!,
            kind: 'frame',
            gap: 'column-gap',
          },
          {
            layer: [root, 'Standard workspace'],
            el: el.shadowRoot!.querySelector('.choice > .label')!,
            kind: 'text',
          },
          { layer: [root, 'Surface'], el: control, kind: 'frame' },
        ];
        if (selection === 'Checked')
          targets.push({
            layer: [root, 'Surface', 'Ellipse'],
            el: el.shadowRoot!.querySelector('.indicator-dot')!,
            kind: 'frame',
          });
        if (state === 'Focus')
          targets.push({ layer: [root, 'Surface [2]'], el: control, kind: 'ring' });
        if (state === 'Invalid' && selection === 'Unchecked')
          targets.push({ layer: [root, 'Required'], el: shadowPart(el, 'error'), kind: 'text' });
        await transitions(targets);
        expectNone(compare('Oddkin/Common/radio', { Selection: selection, State: state }, targets));
      });
});

describe('Figma parity: radioGroup', () => {
  deliberate([
    /^radioGroup \S+ Radio group \/ \S+ paddingLeft \(--odd-space-2xs\)/,
    'Figma insets the group frame by space/2xs, as it does the text input frame; the shared field takes no inset, so the legend lines up with the labels of the fields around it.',
  ]);
  const states: Record<string, string> = {
    Default: '',
    Invalid: ' error="Choose a visibility setting."',
  };
  for (const [state, attributes] of Object.entries(states))
    it(state, async () => {
      const el = mount(
        `<odd-radio-group label="Workspace visibility" value="private"${attributes}><option value="private" title="Only invited members">Private</option><option value="team" title="Anyone in your workspace">Team</option></odd-radio-group>`,
      );
      await settle(el);
      const root = `Radio group / ${state}`;
      const [first, second] = el.shadowRoot!.querySelectorAll('[part="option-description"]');
      const option = (name: string, text: string): string[] => [
        root,
        `Radio option \u00b7 ${name}`,
        'Option description',
        text,
      ];
      const targets: Target[] = [
        { layer: [root], el: shadowPart(el, 'field'), kind: 'frame', gap: 'row-gap' },
        { layer: [root, 'Workspace visibility'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: option('Private', 'Only invited members'), el: first!, kind: 'text' },
        { layer: option('Team', 'Anyone in your workspace'), el: second!, kind: 'text' },
      ];
      if (state === 'Invalid')
        targets.push({
          layer: [root, 'Choose a visibility setting.'],
          el: shadowPart(el, 'error'),
          kind: 'text',
        });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/radioGroup', { State: state }, targets));
    });
});

describe('Figma parity: segmented', () => {
  deliberate([
    /^segmented \S+ Surface( \[\d\])? paddingLeft \(--odd-control-padding-inline-sm\)/,
    "A segment's surface is its radio, drawn under the segment's text; the inline padding is on the text, which sizes the segment.",
  ]);
  const states: Record<string, string> = { Selected: '', Focus: '', Disabled: ' disabled' };
  for (const [state, attribute] of Object.entries(states))
    it(state, async () => {
      const el = mount(
        `<odd-segmented-control label="Preview size"${attribute}><option value="sm">Small</option><option value="md" selected>Medium</option><option value="lg">Large</option></odd-segmented-control>`,
      );
      await settle(el);
      const boxes = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.segment-box')];
      const texts = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.segment-label')];
      await interact(state, boxes[1]!);
      await settle(el);
      const root = `Segmented control / ${state}`;
      const targets: Target[] = [
        { layer: [root, 'Preview size'], el: shadowPart(el, 'label'), kind: 'text' },
        {
          layer: [root, 'Surface'],
          el: shadowPart(el, 'control'),
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      ['Small', 'Medium', 'Large'].forEach((text, i) => {
        const segment = i ? `Surface [${i + 1}]` : 'Surface';
        targets.push(
          { layer: [root, 'Surface', segment], el: boxes[i]!, kind: 'frame' },
          { layer: [root, 'Surface', segment, text], el: texts[i]!, kind: 'text' },
        );
      });
      if (state === 'Focus')
        targets.push({ layer: [root, 'Surface', 'Surface [4]'], el: boxes[1]!, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/segmented', { State: state }, targets));
    });
});

describe('Figma parity: slider', () => {
  const states: Record<string, string> = { Default: '', Focus: '', Disabled: ' disabled' };
  for (const [state, attribute] of Object.entries(states))
    it(state, async () => {
      const el = mount(
        `<odd-slider label="Preview scale" min="25" max="100" step="5" value="60"${attribute}></odd-slider>`,
      ) as HTMLElement & { renderValue: (value: number) => string };
      el.renderValue = (value) => `${value}%`;
      await settle(el);
      const thumb = shadowPart(el, 'thumb');
      await interact(state, thumb);
      await settle(el);
      const root = `Slider / ${state}`;
      const targets: Target[] = [
        { layer: [root, 'Preview scale'], el: shadowPart(el, 'label'), kind: 'text' },
        { layer: [root, '60%'], el: shadowPart(el, 'output'), kind: 'text' },
        { layer: [root, '25%'], el: shadowPart(el, 'min-label'), kind: 'text' },
        { layer: [root, '100%'], el: shadowPart(el, 'max-label'), kind: 'text' },
        { layer: [root, 'Surface'], el: shadowPart(el, 'track'), kind: 'frame' },
        { layer: [root, 'Surface [2]'], el: shadowPart(el, 'fill'), kind: 'frame' },
        { layer: [root, 'Ellipse'], el: thumb, kind: 'frame' },
      ];
      if (state === 'Focus')
        targets.push({ layer: [root, 'Surface [3]'], el: thumb, kind: 'ring' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/slider', { State: state }, targets));
    });
});
