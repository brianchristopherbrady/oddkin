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
