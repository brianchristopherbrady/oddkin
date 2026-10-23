import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server } from 'vitest/browser';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { html } from '@oddkin/core/template';
import { hostStyles } from '../src/styles/host.styles.js';
import { overlaySurfaceStructuralStyles } from '../src/styles/overlay-surface.structural.styles.js';
import { overlayPickerStyles, overlaySurfaceStyles } from '../src/styles/overlay-surface.styles.js';
import { css } from '@oddkin/core/styles';
import { loadTheme, settle } from './probe.js';

// The overlay-surface module (component-catalog.md ??6), drawn by test elements until the overlays
// use it: an inner popover, an inner modal dialog (`.sheet`), and a host that is itself a popover.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

class TestOverlaySurfaces extends OddkinElement {
  static override styles = [hostStyles, overlaySurfaceStructuralStyles, overlaySurfaceStyles];
  override render() {
    return html`<div class="overlay-surface" popover="manual" id="anchored">Anchored</div>
      <dialog class="overlay-surface sheet" id="sheet">Sheet</dialog>`;
  }
}
define('test-overlay-surfaces', TestOverlaySurfaces);
class TestOverlayHost extends OddkinElement {
  static override styles = [hostStyles, overlaySurfaceStructuralStyles, overlaySurfaceStyles];
  override render() {
    return html`<slot></slot>`;
  }
}
define('test-overlay-host', TestOverlayHost);
// A customizable select, as odd-select opts in, with the module's picker look.
class TestOverlayPicker extends OddkinElement {
  static override styles = [
    hostStyles,
    css`
      @supports (appearance: base-select) and selector(::picker(select)) {
        select,
        ::picker(select) {
          appearance: base-select;
        }
      }
    `,
    overlayPickerStyles,
  ];
  override render() {
    return html`<select id="select">
      <option>One</option>
      <option>Two</option>
    </select>`;
  }
}
define('test-overlay-picker', TestOverlayPicker);

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
});
async function mount(mode: 'light' | 'dark' = 'light') {
  container = document.createElement('div');
  container.dataset['oddMode'] = mode;
  container.innerHTML =
    '<test-overlay-surfaces></test-overlay-surfaces><test-overlay-host popover="manual">Host</test-overlay-host>';
  document.body.append(container);
  const el = container.querySelector('test-overlay-surfaces')!;
  const host = container.querySelector<HTMLElement>('test-overlay-host')!;
  await settle(el);
  await settle(host);
  const anchored = el.shadowRoot!.getElementById('anchored')!;
  const sheet = el.shadowRoot!.getElementById('sheet') as HTMLDialogElement;
  anchored.showPopover();
  host.showPopover();
  sheet.showModal();
  return { anchored, sheet, host };
}
/** A token's computed value for `property`, read inside the mounted mode. */
const token = (property: string, variable: string) => {
  const probe = document.createElement('div');
  probe.style.borderStyle = 'solid';
  probe.style.setProperty(property, `var(${variable})`);
  container.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
};

describe('overlay-surface module', () => {
  it('replaces the popover box with the raised surface, a border, the control radius, and elevation md', async () => {
    const { anchored, host } = await mount();
    for (const surface of [anchored, host]) {
      const style = getComputedStyle(surface);
      expect(style.paddingBlockStart).toBe('0px');
      expect(style.borderBlockStartStyle).toBe('solid');
      expect(style.borderBlockStartWidth).toBe(
        token('border-top-width', '--odd-border-width-default'),
      );
      expect(style.borderBlockStartColor).toBe(token('color', '--odd-color-border-default'));
      expect(style.borderStartStartRadius).toBe(
        token('border-top-left-radius', '--odd-control-radius'),
      );
      expect(style.backgroundColor).toBe(token('background-color', '--odd-color-surface-raised'));
      expect(style.color).toBe(token('color', '--odd-color-text-primary'));
      expect(style.boxShadow).toBe(token('box-shadow', '--odd-elevation-md'));
    }
  });

  it('draws a modal sheet on the default surface with the card radius, elevation xl, and the scrim', async () => {
    const { sheet } = await mount();
    const style = getComputedStyle(sheet);
    expect(style.paddingBlockStart).toBe('0px');
    expect(style.borderBlockStartColor).toBe(token('color', '--odd-color-border-default'));
    expect(style.borderStartStartRadius).toBe(token('border-top-left-radius', '--odd-card-radius'));
    expect(style.backgroundColor).toBe(token('background-color', '--odd-color-surface-default'));
    expect(style.boxShadow).toBe(token('box-shadow', '--odd-elevation-xl'));
    expect(getComputedStyle(sheet, '::backdrop').backgroundColor).toBe(
      token('background-color', '--odd-color-scrim'),
    );
  });

  it('sizes with the border included and scrolls a non-modal dialog', async () => {
    const { anchored, sheet } = await mount();
    anchored.style.inlineSize = '200px';
    expect(anchored.getBoundingClientRect().width).toBe(200);
    sheet.close();
    sheet.show();
    expect(getComputedStyle(sheet).overflowY).toBe('auto');
  });

  it('follows dark mode, where the raised surface differs from the default one', async () => {
    const { anchored, sheet } = await mount('dark');
    const raised = token('background-color', '--odd-color-surface-raised');
    expect(raised).not.toBe(token('background-color', '--odd-color-surface-default'));
    expect(getComputedStyle(anchored).backgroundColor).toBe(raised);
    expect(getComputedStyle(sheet).backgroundColor).toBe(
      token('background-color', '--odd-color-surface-default'),
    );
    expect(getComputedStyle(anchored).boxShadow).toBe(token('box-shadow', '--odd-elevation-md'));
  });

  it.runIf(server.browser === 'chromium')(
    'keeps a CanvasText boundary in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { anchored, sheet, host } = await mount();
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        const canvasText = getComputedStyle(probe).color;
        for (const surface of [anchored, sheet, host])
          expect(getComputedStyle(surface).borderBlockStartColor).toBe(canvasText);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('gives a select picker the anchored look only where the picker can be styled', async () => {
    container = document.createElement('div');
    // Dark mode: the raised and default surfaces differ there.
    container.dataset['oddMode'] = 'dark';
    container.innerHTML = '<test-overlay-picker></test-overlay-picker>';
    document.body.append(container);
    const el = container.querySelector('test-overlay-picker')!;
    await settle(el);
    const rules = overlayPickerStyles.sheetFor(document)!.cssRules;
    expect(rules.length).toBe(1);
    const gate = rules[0] as CSSSupportsRule;
    expect(gate.conditionText).toContain('selector(::picker(select))');
    const supported = CSS.supports(gate.conditionText);
    // Where the engine cannot style the picker, the rule inside the gate never applies.
    if (!supported) return;
    const picker = getComputedStyle(el.shadowRoot!.getElementById('select')!, '::picker(select)');
    expect(picker.backgroundColor).toBe(token('background-color', '--odd-color-surface-raised'));
    expect(picker.borderTopColor).toBe(token('color', '--odd-color-border-default'));
    expect(picker.borderTopLeftRadius).toBe(
      token('border-top-left-radius', '--odd-control-radius'),
    );
    expect(picker.boxShadow).toBe(token('box-shadow', '--odd-elevation-md'));
  });
});
