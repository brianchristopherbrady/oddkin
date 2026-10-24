import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { tooltipDefinition } from '../src/tooltip/index.js';
import type { OddkinTooltip } from '../src/tooltip/tooltip.js';
import './register.js';
import { loadTheme, probeTag, semantics, settle, themeValue } from './probe.js';

// odd-tooltip (component-contracts.md §2.4, §3.5; WCAG 1.4.13).
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
});
afterAll(() => unload());

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
  flush();
});
async function mount(markup: string, attributes: Record<string, string> = {}) {
  container = document.createElement('div');
  container.style.padding = '4rem';
  for (const [name, value] of Object.entries(attributes)) container.setAttribute(name, value);
  container.innerHTML = `<button id="before">before</button>${markup}<button id="after">after</button>`;
  document.body.append(container);
  for (const el of container.querySelectorAll('*')) await settle(el);
  return container;
}
const byId = <E extends HTMLElement = HTMLElement>(id: string) =>
  container.querySelector<E>(`#${id}`)!;
const toggled = (el: Element) =>
  new Promise<ToggleEvent>((resolve) =>
    el.addEventListener('toggle', (event) => resolve(event as ToggleEvent), { once: true }),
  );
const box = (el: Element) => el.getBoundingClientRect();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const NATIVE = `<button id="copy" aria-label="Copy link">C</button><odd-tooltip id="t" anchor="copy">Copy a link to this workspace</odd-tooltip>`;
/** The texts an Oddkin control's inner focus target lists in aria-describedby. */
const described = (el: Element, selector: string) =>
  (el.shadowRoot!.querySelector(selector)!.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => el.shadowRoot!.getElementById(id)?.textContent?.trim());

describe('odd-tooltip', () => {
  it('is a manual popover with the tooltip role that describes a native anchor', async () => {
    const tag = probeTag(tooltipDefinition);
    await mount(
      `<button id="copy" aria-label="Copy link" aria-describedby="hint">C</button><span id="hint">Shortcut C</span><${tag} anchor="copy">Copy a link</${tag}>`,
    );
    const el = container.querySelector<HTMLElement>(tag)!;
    expect(el.getAttribute('popover')).toBe('manual');
    expect(semantics(el).role).toBe('tooltip');
    expect(el.id).toMatch(/^odd-tooltip-\d+$/);
    expect(byId('copy').getAttribute('aria-describedby')).toBe(`hint ${el.id}`);
    el.remove();
    flush();
    expect(byId('copy').getAttribute('aria-describedby')).toBe('hint');
  });

  it('follows anchor and anchorElement, describing one anchor at a time', async () => {
    await mount(`<button id="other">Other</button>${NATIVE}`);
    const el = byId<OddkinTooltip>('t');
    el.anchor = 'other';
    await settle(el);
    expect(byId('copy').hasAttribute('aria-describedby')).toBe(false);
    expect(byId('other').getAttribute('aria-describedby')).toBe('t');
    el.anchorElement = byId('after');
    await settle(el);
    expect(byId('other').hasAttribute('aria-describedby')).toBe(false);
    expect(byId('after').getAttribute('aria-describedby')).toBe('t');
  });

  it('shows after the pointer rests on its anchor, above and centred, and stays while hovered', async () => {
    await mount(NATIVE);
    const el = byId<OddkinTooltip>('t');
    const anchor = byId('copy');
    const shown = toggled(el);
    await userEvent.hover(anchor);
    await wait(200);
    expect(el.matches(':popover-open')).toBe(false);
    await shown;
    await settle(el);
    expect(el.open).toBe(true);
    expect(Math.round(box(el).bottom)).toBe(Math.round(box(anchor).top) - 4);
    const middle = (r: DOMRect) => Math.round(r.left + r.width / 2);
    expect(Math.abs(middle(box(el)) - middle(box(anchor)))).toBeLessThanOrEqual(1);
    // Hoverable: the pointer moves onto the tooltip, and it stays.
    await userEvent.hover(el);
    await wait(300);
    expect(el.matches(':popover-open')).toBe(true);
    const hidden = toggled(el);
    await userEvent.hover(byId('after'));
    await hidden;
    expect(el.open).toBe(false);
  });

  it('shows on focus at once and hides when focus leaves, unless the pointer is on it', async () => {
    await mount(NATIVE);
    const el = byId<OddkinTooltip>('t');
    byId('before').focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(byId('copy'));
    await settle(el);
    expect(el.matches(':popover-open')).toBe(true);
    await userEvent.tab();
    await settle(el);
    expect(el.matches(':popover-open')).toBe(false);
  });

  it('stays while the pointer or focus holds it, and hides once neither does', async () => {
    await mount(NATIVE);
    const el = byId<OddkinTooltip>('t');
    const anchor = byId('copy');
    // Hover alone: leaving the anchor straight for another control hides it.
    let change = toggled(el);
    await userEvent.hover(anchor);
    await change;
    change = toggled(el);
    await userEvent.hover(byId('after'));
    await change;
    expect(el.open).toBe(false);
    // Focus holds it while the pointer leaves.
    anchor.focus();
    await settle(el);
    await userEvent.hover(anchor);
    await userEvent.hover(byId('after'));
    await wait(300);
    expect(el.open).toBe(true);
    // Hover holds it while focus leaves.
    await userEvent.hover(anchor);
    byId('before').focus();
    await wait(300);
    expect(el.open).toBe(true);
  });

  it('ignores touch, which has no hover', async () => {
    await mount(NATIVE);
    const el = byId<OddkinTooltip>('t');
    byId('copy').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    await wait(700);
    expect(el.open).toBe(false);
  });

  it('hides on Escape, keeping focus and the key from anything else', async () => {
    await mount(NATIVE);
    const el = byId<OddkinTooltip>('t');
    byId('copy').focus();
    await settle(el);
    expect(el.open).toBe(true);
    let prevented: boolean | undefined;
    const listener = (event: KeyboardEvent) => (prevented = event.defaultPrevented);
    document.addEventListener('keydown', listener);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', listener);
    await settle(el);
    expect(el.open).toBe(false);
    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(byId('copy'));
    // Closed, it leaves Escape alone.
    document.addEventListener('keydown', listener);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', listener);
    expect(prevented).toBe(false);
  });

  it('adds its text to the description of Oddkin controls, following it', async () => {
    await mount(
      `<odd-button id="b">Archive</odd-button><odd-tooltip id="tb" anchor="b">Restore it from settings.</odd-tooltip>
       <odd-input id="i" label="Name" description="Shown publicly."></odd-input><odd-tooltip id="ti" anchor="i">Up to 40 characters.</odd-tooltip>
       <odd-checkbox id="c">Updates</odd-checkbox><odd-tooltip id="tc" anchor="c">Weekly.</odd-tooltip>`,
    );
    const button = byId('b');
    expect(described(button, 'button')).toEqual(['Restore it from settings.']);
    expect(described(byId('i'), 'input')).toEqual(['Shown publicly.', 'Up to 40 characters.']);
    expect(described(byId('c'), 'input')).toEqual(['Weekly.']);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    byId('tb').textContent = 'Restore it later.';
    await new Promise(requestAnimationFrame);
    await settle(button);
    expect(described(button, 'button')).toEqual(['Restore it later.']);
    byId('tb').remove();
    flush();
    await settle(button);
    expect(described(button, 'button')).toEqual([]);
  });

  it.runIf(server.browser === 'chromium')(
    'the accessibility tree reports the tooltip as the description, never the name',
    async () => {
      await mount(
        `${NATIVE}<odd-button id="b">Archive</odd-button><odd-tooltip anchor="b">Restore it from settings.</odd-tooltip>`,
      );
      await settle(byId('b'));
      const session = cdp();
      await session.send('Accessibility.enable');
      try {
        type Frame = { frame: { id: string }; childFrames?: Frame[] };
        const ids = (tree: Frame): string[] => [
          tree.frame.id,
          ...(tree.childFrames ?? []).flatMap((child) => ids(child)),
        ];
        const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: Frame };
        type Node = {
          role?: { value: string };
          name?: { value: string };
          description?: { value: string };
        };
        const nodes: Node[] = [];
        for (const frameId of ids(frameTree))
          nodes.push(
            ...(
              (await session.send('Accessibility.getFullAXTree', { frameId })) as {
                nodes: Node[];
              }
            ).nodes,
          );
        const button = (name: string) =>
          nodes.find((n) => n.role?.value === 'button' && n.name?.value === name);
        expect(button('Copy link')?.description?.value).toBe('Copy a link to this workspace');
        expect(button('Archive')?.description?.value).toBe('Restore it from settings.');
      } finally {
        await session.send('Accessibility.disable');
      }
    },
  );

  it('opens from show(), close(), and open; places by side and align, right to left too', async () => {
    await mount(NATIVE.replace('anchor=', 'side="inline-end" align="start" anchor='), {
      dir: 'rtl',
    });
    const el = byId<OddkinTooltip>('t');
    const anchor = byId('copy');
    el.show();
    await toggled(el);
    await settle(el);
    expect(el.open).toBe(true);
    // inline-end is the left in right-to-left text.
    expect(Math.round(box(el).right)).toBe(Math.round(box(anchor).left) - 4);
    expect(Math.round(box(el).top)).toBe(Math.round(box(anchor).top));
    el.close();
    await toggled(el);
    expect(el.open).toBe(false);
    el.open = true;
    await settle(el);
    expect(el.matches(':popover-open')).toBe(true);
  });

  it('pads its text in the UI type and wraps it at 16rem', async () => {
    await mount(NATIVE.replace('Copy a link to this workspace', 'Copy a link. '.repeat(12)));
    const el = byId<OddkinTooltip>('t');
    el.show();
    await toggled(el);
    await settle(el);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const style = getComputedStyle(base);
    expect(style.paddingBlockStart).toBe(themeValue('padding-top', '--odd-space-xs'));
    expect(style.paddingInlineStart).toBe(themeValue('padding-left', '--odd-space-sm'));
    expect(style.fontSize).toBe(themeValue('font-size', '--odd-type-ui-size'));
    expect(style.color).toBe(themeValue('color', '--odd-color-text-primary'));
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(box(base).width).toBe(16 * rem);
  });

  it('releases everything it owns when removed while shown', async () => {
    const before = scopeStats();
    await mount(NATIVE);
    const el = byId<OddkinTooltip>('t');
    el.show();
    await toggled(el);
    container.remove();
    flush();
    expect(el.matches(':popover-open')).toBe(false);
    expect(scopeStats()).toEqual(before);
  });
});
