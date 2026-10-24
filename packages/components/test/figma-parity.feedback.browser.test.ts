import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  compare,
  expectNone,
  mount,
  settle,
  shadowPart,
  useParity,
  type Target,
} from './parity.js';

// Figma parity of the form feedback elements (component-contracts.md §3.3): odd-validation-summary
// on Figma's ValidationSummary. The summary's danger glyph has no Figma layer (contracts §2.8: the
// tone glyph comes with the tone look).
useParity();

describe('Figma parity: odd-validation-summary (ValidationSummary)', () => {
  it('Errors', async () => {
    const form = mount(
      `<form><odd-validation-summary></odd-validation-summary>
        <input name="project" aria-label="Project name" required />
        <input name="owner" aria-label="Owner email" type="email" value="ada@" required />
        <button type="submit">Save</button></form>`,
    );
    const el = form.querySelector('odd-validation-summary')!;
    await settle(el);
    await userEvent.click(form.querySelector('button')!);
    await settle(el);
    const [project, owner] = el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="link"]');
    const frame = 'Validation summary';
    const targets: Target[] = [
      { layer: [frame], el: shadowPart(el, 'base'), kind: 'frame', gap: 'row-gap' },
      { layer: [frame, 'Heading'], el: shadowPart(el, 'label'), kind: 'text' },
      { layer: [frame, 'Project name — enter a name'], el: project!, kind: 'text' },
      { layer: [frame, 'Owner email — enter a valid email address'], el: owner!, kind: 'text' },
    ];
    expectNone(compare('Oddkin/Common/ValidationSummary', { State: 'Errors' }, targets));
    // Figma spaces every row of the frame by its item spacing, the links too.
    expect(getComputedStyle(shadowPart(el, 'list')).rowGap).toBe(
      getComputedStyle(shadowPart(el, 'base')).rowGap,
    );
  });
});
