import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { OddkinElement, define } from '@oddkin/core/element';
import { computed, flush } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { scopeStats } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import { Overlay, deepActiveElement } from '../src/overlay/overlay.js';
import { popoverDefinition } from '../src/popover/index.js';
import type { OddkinPopover } from '../src/popover/popover.js';
import { hostStyles } from '../src/styles/host.styles.js';
import { overlaySurfaceStructuralStyles } from '../src/styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../src/styles/overlay-surface.styles.js';
import './register.js';
import { loadTheme, probeTag, semantics, settle, themeValue } from './probe.js';

// odd-popover (component-contracts.md §2.6, §3.5) and the shared overlay wiring it is built on.
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  for (const open of document.querySelectorAll(':popover-open'))
    (open as HTMLElement).hidePopover();
  container?.remove();
  flush();
});
async function mount(markup: string, attributes: Record<string, string> = {}) {
  container = document.createElement('div');
  for (const [name, value] of Object.entries(attributes)) container.setAttribute(name, value);
  container.innerHTML = `<button id="before">before</button>${markup}<button id="after">after</button>`;
  document.body.append(container);
  for (const el of container.querySelectorAll('*')) await settle(el);
  return container;
}
const toggled = (el: Element) =>
  new Promise<ToggleEvent>((resolve) =>
    el.addEventListener('toggle', (event) => resolve(event as ToggleEvent), { once: true }),
  );
/** After the first placement, and the one that follows the size its room gives it. */
const placed = async (el: Element) => {
  await settle(el);
  await new Promise(requestAnimationFrame);
};
const byId = <E extends HTMLElement = HTMLElement>(id: string) =>
  container.querySelector<E>(`#${id}`)!;
const close = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[part~="close"]');
const box = (el: Element) => el.getBoundingClientRect();
const POPOVER = `<button popovertarget="p" id="trigger">Share</button><odd-popover id="p" label="Share workspace"><p>Invite people.</p><a href="#docs" id="docs">Docs</a></odd-popover>`;

describe('odd-popover', () => {
  it('opens from a popovertarget button with no script, below the button, and reports open', async () => {
    await mount(POPOVER);
    const el = byId<OddkinPopover>('p');
    const trigger = byId('trigger');
    expect(el.getAttribute('popover')).toBe('auto');
    expect(el.matches(':popover-open')).toBe(false);
    const opened = toggled(el);
    await userEvent.click(trigger);
    const event = await opened;
    expect(event.newState).toBe('open');
    expect(el.open).toBe(true);
    await settle(el);
    expect(el.hasAttribute('open')).toBe(true);
    expect(Math.round(box(el).top)).toBe(Math.round(box(trigger).bottom) + 4);
    expect(Math.round(box(el).left)).toBe(Math.round(box(trigger).left));
    const closed = toggled(el);
    await userEvent.click(trigger);
    expect((await closed).newState).toBe('closed');
    expect(el.open).toBe(false);
    // Placed afresh each time it opens, after the trigger moved.
    trigger.style.marginInlineStart = '40px';
    const reopened = toggled(el);
    await userEvent.click(trigger);
    await reopened;
    await settle(el);
    expect(Math.round(box(el).left)).toBe(Math.round(box(trigger).left));
  });

  it('is a dialog named by label', async () => {
    const tag = probeTag(popoverDefinition);
    await mount(`<${tag} label="Share workspace"></${tag}>`);
    const el = container.querySelector(tag)!;
    expect(semantics(el)).toEqual({ role: 'dialog', label: 'Share workspace', hidden: null });
    el.removeAttribute('label');
    await settle(el);
    expect(semantics(el).label).toBeNull();
  });

  it('places by side and align, flips when there is no room, and follows the writing direction', async () => {
    // In the middle of the viewport, so centring needs no shift.
    await mount(POPOVER.replace('label=', 'side="inline-end" align="center" label='), {
      style: 'position: fixed; inset-block-start: 40vh; inset-inline-start: 0',
    });
    const el = byId<OddkinPopover>('p');
    const trigger = byId('trigger');
    el.show();
    await placed(el);
    expect(Math.round(box(el).left)).toBe(Math.round(box(trigger).right) + 4);
    const middle = (r: DOMRect) => Math.round(r.top + r.height / 2);
    expect(Math.abs(middle(box(el)) - middle(box(trigger)))).toBeLessThanOrEqual(1);
    el.close();
    container.remove();

    await mount(POPOVER, { dir: 'rtl' });
    const rtl = byId<OddkinPopover>('p');
    rtl.show();
    await placed(rtl);
    expect(Math.round(box(rtl).right)).toBe(Math.round(box(byId('trigger')).right));
    rtl.close();
    container.remove();

    await mount(POPOVER, { style: 'position: fixed; inset-block-end: 0; inset-inline-start: 0' });
    const low = byId<OddkinPopover>('p');
    low.show();
    await placed(low);
    expect(Math.round(box(low).bottom)).toBe(Math.round(box(byId('trigger')).top) - 4);
  });

  it('places against `anchor` or `anchorElement` over the invoker', async () => {
    await mount(
      `<button id="other">Other</button>${POPOVER.replace('label=', 'anchor="other" label=')}`,
    );
    const el = byId<OddkinPopover>('p');
    el.show();
    await placed(el);
    expect(Math.round(box(el).left)).toBe(Math.round(box(byId('other')).left));
    el.close();
    el.removeAttribute('anchor');
    el.anchorElement = byId('after');
    el.show();
    await placed(el);
    expect(Math.round(box(el).top)).toBe(Math.round(box(byId('after')).bottom) + 4);
    expect(Math.round(box(el).left)).toBe(Math.round(box(byId('after')).left));
  });

  it('closes on Escape and with its close button, returning focus to the trigger', async () => {
    await mount(POPOVER);
    const el = byId<OddkinPopover>('p');
    const trigger = byId('trigger');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.matches(':popover-open')).toBe(true);
    byId('docs').focus();
    let closed = toggled(el);
    await userEvent.keyboard('{Escape}');
    await closed;
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    close(el)!.focus();
    closed = toggled(el);
    await userEvent.keyboard('{Enter}');
    await closed;
    expect(el.matches(':popover-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a press outside, leaving focus where the press put it', async () => {
    await mount(POPOVER);
    const el = byId<OddkinPopover>('p');
    await userEvent.click(byId('trigger'));
    await settle(el);
    byId('docs').focus();
    const closed = toggled(el);
    await userEvent.click(byId('after'));
    await closed;
    expect(el.open).toBe(false);
    expect(document.activeElement).not.toBe(byId('trigger'));
  });

  it('opens from show(), close(), and open, and from the open attribute at connection', async () => {
    await mount(POPOVER.replace('label=', 'open label='));
    const el = byId<OddkinPopover>('p');
    expect(el.matches(':popover-open')).toBe(true);
    el.close();
    await toggled(el);
    expect(el.open).toBe(false);
    el.show();
    await toggled(el);
    expect(el.open).toBe(true);
    el.open = false;
    await settle(el);
    expect(el.matches(':popover-open')).toBe(false);
    el.open = true;
    await settle(el);
    expect(el.matches(':popover-open')).toBe(true);
  });

  it('pads its content, wraps it at 20rem, and keeps the close button in the corner', async () => {
    await mount(
      POPOVER.replace(
        '<p>Invite people.</p>',
        `<p>${'Invite people to collaborate. '.repeat(8)}</p>`,
      ),
    );
    const el = byId<OddkinPopover>('p');
    el.show();
    await placed(el);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(getComputedStyle(base).paddingBlockStart).toBe(`${rem}px`);
    expect(box(base).width).toBe(20 * rem);
    // space.md inside, less space.xs pulled into the corner.
    expect(Math.round(box(close(el)!).top - box(base).top)).toBe(rem - rem / 2);
    expect(Math.round(box(base).right - box(close(el)!).right)).toBe(rem - rem / 2);
  });

  it('carries a named close button unless no-close', async () => {
    await mount(POPOVER);
    const el = byId<OddkinPopover>('p');
    expect(close(el)!.localName).toBe('button');
    expect(close(el)!.getAttribute('aria-label')).toBe('Close');
    expect(getComputedStyle(close(el)!).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
    el.strings = { close: 'Schließen' };
    await settle(el);
    expect(close(el)!.getAttribute('aria-label')).toBe('Schließen');
    el.noClose = true;
    await settle(el);
    expect(close(el)).toBeNull();
  });

  it('fades only with motion allowed, and never waits for the fade to settle its state', async () => {
    await mount(POPOVER);
    const el = byId<OddkinPopover>('p');
    el.style.setProperty('--odd-motion-duration-fast', '2s');
    const trigger = byId('trigger');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(getComputedStyle(el).animationName).toBe('odd-overlay-in');
    byId('docs').focus();
    const closed = toggled(el);
    el.close();
    expect(el.matches(':popover-open')).toBe(false);
    // Still shown while it fades out, where allow-discrete is supported.
    expect(getComputedStyle(el).transitionProperty).toContain('opacity');
    await new Promise(requestAnimationFrame);
    expect(Number(getComputedStyle(el).opacity)).toBeLessThan(1);
    await closed;
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it.runIf(server.browser === 'chromium')(
    'appears and disappears without motion when motion is reduced',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });
      try {
        await mount(POPOVER);
        const el = byId<OddkinPopover>('p');
        el.show();
        await settle(el);
        expect(getComputedStyle(el).animationName).toBe('none');
        expect(getComputedStyle(el).opacity).toBe('1');
        el.close();
        expect(getComputedStyle(el).transitionProperty).not.toContain('opacity');
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it.runIf(server.browser === 'chromium')(
    'keeps its boundary and close button in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        await mount(POPOVER);
        const el = byId<OddkinPopover>('p');
        el.show();
        await settle(el);
        const system = (color: string) => {
          const probe = document.createElement('span');
          probe.style.color = color;
          container.append(probe);
          return getComputedStyle(probe).color;
        };
        expect(getComputedStyle(el).borderBlockStartColor).toBe(system('CanvasText'));
        expect(getComputedStyle(close(el)!).color).toBe(system('ButtonText'));
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('releases everything it owns when removed while open', async () => {
    const before = scopeStats();
    await mount(POPOVER);
    const el = byId<OddkinPopover>('p');
    el.show();
    await placed(el);
    container.remove();
    flush();
    expect(el.matches(':popover-open')).toBe(false);
    expect(scopeStats()).toEqual(before);
  });
});

// The wiring as another lane uses it: a trigger and an inner `[popover]` surface in one shadow root.
class TestMenuButton extends OddkinElement {
  static override styles = [hostStyles, overlaySurfaceStructuralStyles, overlaySurfaceStyles];
  readonly overlay = new Overlay({
    host: this,
    surface: () => this.shadowRoot?.querySelector<HTMLElement>('[part~="surface"]'),
    anchor: () => this.shadowRoot?.querySelector('[part~="trigger"]'),
    mode: this.hasAttribute('manual') ? 'manual' : 'auto',
    dismiss: this.hasAttribute('manual'),
    ...(this.hasAttribute('no-relay') ? { relay: false } : {}),
    onToggle: (open) =>
      this.calls.push(
        `${open} ${this.shadowRoot!.querySelector<HTMLElement>('[part~="surface"]')!.style.top ? 'placed' : 'unplaced'} focus=${deepActiveElement()?.id || deepActiveElement()?.localName}`,
      ),
  });
  readonly calls: string[] = [];
  override render() {
    return html`<button
        part="trigger"
        aria-expanded=${computed(() => String(this.overlay.open.value))}
        @click=${() => this.overlay.toggle()}
      >
        Actions
      </button>
      <div part="surface" class="overlay-surface" role="menu">
        <button role="menuitem" id="one">One</button>
      </div>`;
  }
  protected override mounted(scope: Scope): void {
    scope.use(this.overlay);
  }
}
define('test-menu-button', TestMenuButton);

describe('overlay wiring (an inner surface)', () => {
  const parts = (el: Element) => ({
    trigger: el.shadowRoot!.querySelector<HTMLElement>('[part~="trigger"]')!,
    surface: el.shadowRoot!.querySelector<HTMLElement>('[part~="surface"]')!,
    item: el.shadowRoot!.getElementById('one')!,
  });

  it('re-dispatches beforetoggle and toggle at the host, where beforetoggle can cancel', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m');
    const { trigger, surface } = parts(el);
    expect(surface.getAttribute('popover')).toBe('auto');
    const seen: string[] = [];
    el.addEventListener('beforetoggle', (e) => seen.push(`before ${(e as ToggleEvent).newState}`));
    el.addEventListener('toggle', (e) => seen.push(`toggle ${(e as ToggleEvent).newState}`));
    const cancel = (e: Event) => e.preventDefault();
    el.addEventListener('beforetoggle', cancel, { once: true });
    trigger.click();
    expect(surface.matches(':popover-open')).toBe(false);
    trigger.click();
    await toggled(el);
    expect(surface.matches(':popover-open')).toBe(true);
    expect(seen).toEqual(['before open', 'before open', 'toggle open']);
    await settle(el);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(Math.round(box(surface).top)).toBe(Math.round(box(trigger).bottom) + 4);
    const placement = (el as TestMenuButton).overlay.placement!;
    expect(getComputedStyle(surface).maxBlockSize).toBe(`${placement.availableHeight}px`);
    expect(getComputedStyle(surface).maxInlineSize).toBe(`${placement.availableWidth}px`);
  });

  it('keeps a nested surface’s toggle events off the host with relay: false', async () => {
    await mount('<test-menu-button id="m" no-relay></test-menu-button>');
    const el = byId<TestMenuButton>('m');
    const { trigger, surface, item } = parts(el);
    const seen: string[] = [];
    for (const type of ['beforetoggle', 'toggle'])
      el.addEventListener(type, (e) => {
        seen.push(type);
        e.preventDefault();
      });
    trigger.focus();
    const opened = toggled(surface);
    trigger.click();
    await opened;
    await settle(el);
    expect(surface.matches(':popover-open')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(Math.round(box(surface).top)).toBe(Math.round(box(trigger).bottom) + 4);
    item.focus();
    const closed = toggled(surface);
    el.overlay.hide();
    await closed;
    expect(el.overlay.open.value).toBe(false);
    expect(deepActiveElement()).toBe(trigger);
    expect(seen).toEqual([]);
    // Firefox and WebKit return focus before `toggle`; Chromium does not.
    expect(el.calls.map((call) => call.replace(/ focus=.*/, ''))).toEqual([
      'true placed',
      'false placed',
    ]);
  });

  it('returns focus to the opener when it closes with focus inside', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m');
    const { trigger, surface, item } = parts(el);
    trigger.focus();
    (el as TestMenuButton).overlay.show();
    await toggled(el);
    item.focus();
    expect(deepActiveElement()).toBe(item);
    (el as TestMenuButton).overlay.hide();
    await toggled(el);
    expect(surface.matches(':popover-open')).toBe(false);
    expect(deepActiveElement()).toBe(trigger);
    await settle(el);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when its anchor is pressed while open, without opening again on the click', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    const { trigger, surface } = parts(el);
    let changed = toggled(el);
    await userEvent.click(trigger);
    await changed;
    expect(surface.matches(':popover-open')).toBe(true);
    changed = toggled(el);
    await userEvent.click(trigger);
    await changed;
    await settle(el);
    expect(surface.matches(':popover-open')).toBe(false);
    // The next press opens it again.
    changed = toggled(el);
    await userEvent.click(trigger);
    await changed;
    expect(surface.matches(':popover-open')).toBe(true);
  });

  it('reports open once shown and placed, and closed before focus returns', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    const { trigger, item } = parts(el);
    trigger.focus();
    el.overlay.show();
    await toggled(el);
    item.focus();
    el.overlay.hide();
    await toggled(el);
    // Firefox and WebKit return focus themselves when the popover hides; Chromium leaves it to us.
    expect(el.calls[0]).toBe('true placed focus=button');
    expect(el.calls[1]).toMatch(/^false placed focus=(one|button)$/);
    expect(deepActiveElement()).toBe(trigger);
    expect(getComputedStyle(parts(el).surface).getPropertyValue('--_anchor-inline-size')).toBe(
      `${trigger.getBoundingClientRect().width}px`,
    );
  });

  it('opens from the keyboard after a press on its anchor that did not end in a click', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    const { trigger, surface } = parts(el);
    el.overlay.show();
    await toggled(el);
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    el.overlay.hide();
    await toggled(el);
    trigger.focus();
    const opened = toggled(el);
    await userEvent.keyboard('{Enter}');
    await opened;
    expect(surface.matches(':popover-open')).toBe(true);
  });

  it('places again after the host moves', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    el.overlay.show();
    await toggled(el);
    container.append(el);
    flush();
    await settle(el);
    el.overlay.show();
    await toggled(el);
    const { trigger, surface } = parts(el);
    expect(Math.round(box(surface).top)).toBe(Math.round(box(trigger).bottom) + 4);
    expect(Math.round(box(surface).left)).toBe(Math.round(box(trigger).left));
  });

  it('leaves focus where the closing code moved it', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    const { trigger, item } = parts(el);
    trigger.focus();
    el.overlay.show();
    await toggled(el);
    item.focus();
    const closed = toggled(el);
    el.overlay.hide();
    byId('after').focus();
    await closed;
    expect(document.activeElement).toBe(byId('after'));
  });

  it('closes without returning focus when it is disconnected', async () => {
    await mount('<test-menu-button id="m"></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    const { surface, item } = parts(el);
    byId('before').focus();
    el.overlay.show();
    await toggled(el);
    item.focus();
    el.remove();
    flush();
    await new Promise(requestAnimationFrame);
    expect(surface.matches(':popover-open')).toBe(false);
    expect(document.activeElement).not.toBe(byId('before'));
  });

  it('dismisses a manual surface on Escape inside and on a press outside, not on its anchor', async () => {
    await mount('<test-menu-button id="m" manual></test-menu-button>');
    const el = byId('m') as TestMenuButton;
    const { trigger, surface, item } = parts(el);
    expect(surface.getAttribute('popover')).toBe('manual');
    el.overlay.show();
    await toggled(el);
    item.focus();
    let closed = toggled(el);
    await userEvent.keyboard('{Escape}');
    await closed;
    expect(surface.matches(':popover-open')).toBe(false);
    el.overlay.show();
    await toggled(el);
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(surface.matches(':popover-open')).toBe(true);
    // Escape is the overlay's while open, and the host's own when closed.
    const reached: boolean[] = [];
    const listener = (event: KeyboardEvent) => reached.push(event.key === 'Escape');
    document.addEventListener('keydown', listener);
    trigger.focus();
    closed = toggled(el);
    await userEvent.keyboard('{Escape}');
    await closed;
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', listener);
    expect(reached).toEqual([true]);
    el.overlay.show();
    await toggled(el);
    closed = toggled(el);
    await userEvent.click(byId('after'));
    await closed;
    expect(surface.matches(':popover-open')).toBe(false);
  });
});
