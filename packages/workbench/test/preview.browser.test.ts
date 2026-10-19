import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { OddkinElement, define, html } from '@oddkin/core';
import { defineLayoutRecipe, grid, stack } from '@oddkin/core/layout';
import { flush } from '@oddkin/core/reactive';
import { generate } from '@oddkin/tokens/generate';
import '@oddkin/components/define/side-nav';
import { sideNavRecipeStyles } from '@oddkin/components/side-nav';
import { sideNavRecipe } from '@oddkin/components/side-nav/recipe';
import { previewStyles } from '../src/preview/index.js';

// Live condition editing (IMPLEMENTATION_PLAN M2; theming-and-styling.md §11): thresholds are
// literal query text, so an edited condition reaches a preview only through regenerated CSS. The
// preview adopts its own copy of the shared sheet and replaces the copy's rules; the shared sheet
// is never mutated and nothing is remounted.

const frames: HTMLElement[] = [];
afterEach(() => {
  for (const frame of frames.splice(0)) frame.remove();
  flush();
});
function frame(width: string): HTMLElement {
  const el = document.createElement('div');
  el.style.inlineSize = width;
  document.body.append(el);
  frames.push(el);
  return el;
}
const display = (host: Element) =>
  getComputedStyle(host.shadowRoot!.querySelector('.content')!).display;
const rules = (sheet: CSSStyleSheet) => [...sheet.cssRules].map((r) => r.cssText).join('\n');

/** The theme's `navigation.expanded`, generated with `minInlineSize` as Theme Studio would. */
function conditionsFor(minInlineSize: string) {
  const { theme } = generate({
    brand: { primary: '#6250e8' },
    conditions: { 'navigation.expanded': { container: 'side-nav', minInlineSize } },
  });
  return Object.fromEntries(theme!.conditions);
}

describe('preview-owned stylesheets', () => {
  it('an edited theme condition reaches the preview through a regenerated recipe only', async () => {
    const probe = defineLayoutRecipe({
      name: 'preview-probe',
      container: { name: 'side-nav' },
      regions: { root: stack(), content: stack() },
      when: { 'navigation.expanded': { content: grid({ columns: 3 }) } },
      conditions: conditionsFor('40rem'),
    });
    class Probe extends OddkinElement {
      static override styles = probe.styles;
      protected override render() {
        return html`<div class="root"><div class="content"></div></div>`;
      }
    }
    define('preview-probe', Probe);
    const [inside, outside] = [frame('35rem'), frame('35rem')].map((f) => {
      const el = document.createElement('preview-probe') as Probe;
      f.append(el);
      return el;
    });
    await Promise.all([inside!.updateComplete, outside!.updateComplete]);
    const shared = probe.styles.sheetFor(document)!;
    const before = rules(shared);
    expect([display(inside!), display(outside!)]).toEqual(['flex', 'flex']);

    const preview = previewStyles(probe.styles, frames[0]!);
    preview.update(probe.extend({ conditions: conditionsFor('30rem') }).cssText);
    expect(display(inside!)).toBe('grid');
    expect(display(outside!)).toBe('flex');
    expect(rules(shared)).toBe(before);
    expect(probe.cssText).toContain('min-inline-size: 40rem');
    expect(outside!.shadowRoot!.adoptedStyleSheets).toContain(shared);
  });

  it('odd-side-nav keeps its nodes, focus, and expanded group while its threshold is edited', async () => {
    const items = [
      { id: 'a', kind: 'link' as const, label: 'A', href: '#a' },
      {
        id: 'g',
        kind: 'group' as const,
        label: 'Group',
        items: [{ id: 'b', kind: 'link' as const, label: 'B', href: '#b' }],
      },
    ];
    const [edited, other] = [frame('35rem'), frame('35rem')].map((f) => {
      const nav = document.createElement('odd-side-nav');
      nav.label = 'Primary';
      nav.items = items;
      f.append(nav);
      return nav;
    });
    await Promise.all([edited!.updateComplete, other!.updateComplete]);
    await userEvent.click(edited!.shadowRoot!.querySelector('[part~="group-toggle"]')!);
    await edited!.updateComplete;
    const link = edited!.shadowRoot!.querySelector<HTMLAnchorElement>('a[href="#a"]')!;
    link.focus();
    const nodes = [...edited!.shadowRoot!.querySelectorAll('*')];
    const shared = sideNavRecipeStyles.sheetFor(document)!;
    const before = rules(shared);
    expect(edited!.shadowRoot!.adoptedStyleSheets).toContain(shared);
    expect(display(edited!)).toBe('flex');

    // The component's own (inline) condition, given a new threshold as a regenerated recipe.
    const key = '@container side-nav (min-inline-size: 40rem)';
    expect(sideNavRecipe.cssText).toContain(key);
    const at = (threshold: string) =>
      sideNavRecipe.extend({
        conditions: { [key]: `@container side-nav (min-inline-size: ${threshold})` },
      }).cssText;
    const preview = previewStyles(sideNavRecipeStyles, frames[0]!);
    expect(edited!.shadowRoot!.adoptedStyleSheets).toContain(preview.sheet);
    expect(edited!.shadowRoot!.adoptedStyleSheets).not.toContain(shared);
    preview.update(at('30rem'));
    expect(display(edited!)).toBe('grid');
    expect(display(other!)).toBe('flex');
    // Same nodes, same focus, same expanded group: nothing was remounted or re-rendered.
    expect([...edited!.shadowRoot!.querySelectorAll('*')]).toEqual(nodes);
    expect(edited!.shadowRoot!.activeElement).toBe(link);
    expect(
      edited!.shadowRoot!.querySelector('[part~="group-toggle"]')!.getAttribute('aria-expanded'),
    ).toBe('true');
    // The shared sheet, the recipe, and every other instance are untouched.
    expect(rules(shared)).toBe(before);
    expect(sideNavRecipe.cssText).toBe(sideNavRecipeStyles.cssText);
    expect(other!.shadowRoot!.adoptedStyleSheets).toContain(shared);

    // Further edits replace the same preview sheet.
    const sheet = preview.sheet;
    preview.update(at('36rem'));
    expect(display(edited!)).toBe('flex');
    preview.update(at('30rem'));
    expect(edited!.shadowRoot!.adoptedStyleSheets).toContain(sheet);

    // Elements added to the preview later adopt the copy on refresh.
    const late = document.createElement('odd-side-nav');
    late.items = items;
    frames[0]!.append(late);
    await late.updateComplete;
    expect(display(late)).toBe('flex');
    expect(preview.refresh()).toBe(1);
    expect(display(late)).toBe('grid');

    preview.restore();
    for (const nav of [edited!, late]) {
      expect(nav.shadowRoot!.adoptedStyleSheets).toContain(shared);
      expect(nav.shadowRoot!.adoptedStyleSheets).not.toContain(sheet);
      expect(display(nav)).toBe('flex');
    }
    expect(rules(shared)).toBe(before);
  });
});
