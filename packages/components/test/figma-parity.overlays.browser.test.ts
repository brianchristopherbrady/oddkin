import { describe, it } from 'vitest';
import { OddkinElement, define } from '@oddkin/core/element';
import { html } from '@oddkin/core/template';
import { hostStyles } from '../src/styles/host.styles.js';
import { overlaySurfaceStructuralStyles } from '../src/styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../src/styles/overlay-surface.styles.js';
import {
  compare,
  expectNone,
  mount,
  settle,
  transitions,
  useParity,
  type Target,
} from './parity.js';

// Figma parity of the overlays lane (component-contracts.md §2.6, §3.5). The overlay-surface module
// is also drawn by a test element, for the families whose elements are still to come: the anchored
// look on Figma's popover, tooltip, and Menu surfaces, and the sheet look on dialog, alertDialog,
// drawer, and toast.
useParity();

class TestParitySurfaces extends OddkinElement {
  static override styles = [hostStyles, overlaySurfaceStructuralStyles, overlaySurfaceStyles];
  override render() {
    return html`<div class="overlay-surface" popover="manual" id="anchored">Anchored</div>
      <dialog class="overlay-surface sheet" id="sheet">Sheet</dialog>`;
  }
}
define('test-parity-surfaces', TestParitySurfaces);

describe('Figma parity: odd-popover (popover)', () => {
  for (const state of ['Default', 'Settings'])
    it(state, async () => {
      const el = mount(
        `<odd-popover label="Share workspace" open>Invite people to collaborate.</odd-popover>`,
      );
      await settle(el);
      const targets: Target[] = [{ layer: [`Popover / ${state}`, 'Surface'], el, kind: 'frame' }];
      await transitions(targets);
      expectNone(compare('Oddkin/Common/popover', { State: state }, targets));
    });
});

describe('Figma parity: overlay-surface module', () => {
  const cases: [string, string, Record<string, string>, string, 'anchored' | 'sheet'][] = [
    ['popover', 'Popover / Default', { State: 'Default' }, 'Surface', 'anchored'],
    ['popover', 'Popover / Settings', { State: 'Settings' }, 'Surface', 'anchored'],
    ['tooltip', 'Tooltip / Default', { State: 'Default' }, 'Surface', 'anchored'],
    ['Menu', 'Menu / Open', { State: 'Open' }, 'Surface', 'anchored'],
    ['dialog', 'Dialog / Default', { State: 'Default' }, 'Surface', 'sheet'],
    ['alertDialog', 'Alert dialog / Default', { State: 'Default' }, 'Surface', 'sheet'],
    ['drawer', 'Drawer / Default', { State: 'Default' }, 'Surface', 'sheet'],
    ['toast', 'Toast / Success', { State: 'Success' }, 'Surface', 'sheet'],
  ];
  for (const [family, frame, values, layer, kind] of cases)
    it(`${frame} (${kind})`, async () => {
      const el = mount('<test-parity-surfaces></test-parity-surfaces>');
      await settle(el);
      const anchored = el.shadowRoot!.getElementById('anchored')!;
      const sheet = el.shadowRoot!.getElementById('sheet') as HTMLDialogElement;
      anchored.showPopover();
      sheet.showModal();
      const targets: Target[] = [
        { layer: [frame, layer], el: kind === 'sheet' ? sheet : anchored, kind: 'frame' },
      ];
      await transitions(targets);
      expectNone(compare(`Oddkin/Common/${family}`, values, targets));
      sheet.close();
    });
});
