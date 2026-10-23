import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compose, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { css } from '@oddkin/core/styles';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
};
const reflection = 'ariaLabelledByElements' in ElementInternals.prototype;

// Playwright's role locators read DOM attributes and cannot see ElementInternals semantics, so
// these tests read the internals through a test-only subclass. Accessibility-tree evidence is
// recorded separately (e2e, Chromium CDP).
type Semantics = { role: string | null; label: string | null; labelledBy: string[] | null };
let semantics: (el: HTMLElement) => Semantics;
async function probe() {
  const { OddkinCard, cardDefinition } = await import('../src/card/index.js');
  if (!customElements.get('probe-card')) {
    class ProbeCard extends OddkinCard {
      get probe(): Semantics {
        const internals = this.internals as ElementInternals & {
          ariaLabelledByElements?: readonly Element[] | null;
        };
        return {
          role: internals.role ?? null,
          label: internals.ariaLabel ?? null,
          labelledBy: internals.ariaLabelledByElements
            ? internals.ariaLabelledByElements.map((e) => e.textContent ?? '')
            : null,
        };
      }
    }
    define(compose({ ...cardDefinition, name: 'probe-card', element: ProbeCard }));
  }
  semantics = (el) => (el as HTMLElement & { probe: Semantics }).probe;
}

async function mount(markup: string, attributes: Record<string, string> = {}, tag = 'odd-card') {
  await import('../src/card/card.define.js');
  await probe();
  const el = document.createElement(tag) as HTMLElementTagNameMap['odd-card'];
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.innerHTML = markup;
  container.append(el);
  await settle(el);
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  return { el, part };
}

describe('imports', () => {
  it('the foundation and the component entry register nothing', async () => {
    const foundation = await import('../src/card/foundation.js');
    expect(Object.keys(foundation).sort()).toEqual([
      'OddkinCard',
      'cardStructuralStyles',
      'cardTemplate',
      'hostStyles',
    ]);
    await import('../src/card/index.js');
    expect(customElements.get('odd-card')).toBeUndefined();
  });
});

describe('odd-card', () => {
  it('renders base, header, body, and footer parts; hides empty header and footer', async () => {
    const { el, part } = await mount('<p>Body</p>');
    expect(part('base')).not.toBeNull();
    expect(part('header').hidden).toBe(true);
    expect(part('footer').hidden).toBe(true);
    expect(part('body').hidden).toBe(false);
    const footer = document.createElement('div');
    footer.slot = 'footer';
    footer.textContent = 'Actions';
    el.append(footer);
    await settle(el);
    expect(part('footer').hidden).toBe(false);
    footer.remove();
    await settle(el);
    expect(part('footer').hidden).toBe(true);
  });

  it('shows a header present at first render', async () => {
    const { part } = await mount('<h3 slot="header">Plan</h3><p>Body</p>');
    expect(part('header').hidden).toBe(false);
  });

  it('is not a landmark without a name', async () => {
    const { el } = await mount('<p>Body</p>', {}, 'probe-card');
    expect(semantics(el).role).toBe(null);
    expect(el.hasAttribute('role')).toBe(false);
  });

  it('is a region named by label, without sprouting host attributes', async () => {
    const { el } = await mount('<p>Body</p>', { label: 'Billing' }, 'probe-card');
    expect(semantics(el)).toMatchObject({ role: 'region', label: 'Billing' });
    expect(el.hasAttribute('role') || el.hasAttribute('aria-label')).toBe(false);
    el.label = '';
    await settle(el);
    expect(semantics(el).role).toBe(null);
  });

  it('is a region named by a slotted heading where element reflection exists', async () => {
    const { el } = await mount('<h3 slot="header">Usage</h3><p>Body</p>', {}, 'probe-card');
    if (reflection)
      expect(semantics(el)).toEqual({ role: 'region', label: null, labelledBy: ['Usage'] });
    else expect(semantics(el).role).toBe(null);
    el.querySelector('h3')!.remove();
    await settle(el);
    expect(semantics(el).role).toBe(null);
  });

  it('reflects appearance and padding, and reads roles through component variables', async () => {
    container.style.setProperty('--odd-space-lg', '20px');
    container.style.setProperty('--odd-color-surface-sunken', 'rgb(4, 5, 6)');
    container.style.setProperty('--odd-elevation-md', '0 4px 12px rgb(36, 31, 71)');
    const { el, part } = await mount('<p>Body</p>');
    expect(el.getAttribute('appearance')).toBe('outlined');
    expect(el.getAttribute('padding')).toBe('md');
    el.padding = 'lg';
    el.appearance = 'filled';
    await settle(el);
    expect(getComputedStyle(part('base')).paddingTop).toBe('20px');
    expect(getComputedStyle(part('base')).backgroundColor).toBe('rgb(4, 5, 6)');
    el.appearance = 'elevated';
    await settle(el);
    expect(getComputedStyle(part('base')).boxShadow).toContain('rgb(36, 31, 71)');
    el.style.setProperty('--odd-card-shadow', 'none');
    expect(getComputedStyle(part('base')).boxShadow).toBe('none');
  });

  it('returns to baseline after reconnects and keeps nodes across theme-value changes', async () => {
    const { el, part } = await mount('<h3 slot="header">Plan</h3><p>Body</p>', { label: 'Plan' });
    const base = part('base');
    const before = scopeStats();
    for (let i = 0; i < 10; i++) {
      el.remove();
      container.append(el);
      await settle(el);
    }
    expect(scopeStats()).toEqual(before);
    container.style.setProperty('--odd-card-radius', '0px');
    await settle(el);
    expect(part('base')).toBe(base);
    expect(getComputedStyle(base).borderTopLeftRadius).toBe('0px');
  });
});

describe('recomposition', () => {
  it('a product card reuses the foundation with its own styles beside odd-card', async () => {
    const { OddkinCard, cardDefinition, cardStructuralStyles } =
      await import('../src/card/index.js');
    const { hostStyles } = await import('../src/card/foundation.js');
    await import('../src/card/card.define.js');
    class StudioCard extends OddkinCard {}
    const studio = compose({
      ...cardDefinition,
      name: 'studio-card',
      element: StudioCard,
      styles: [
        hostStyles,
        cardStructuralStyles,
        css`
          .card {
            padding: 2px;
            border-radius: 0;
          }
        `,
      ],
    });
    define(studio);
    expect(studio.extends).toBe(cardDefinition);
    const a = document.createElement('odd-card');
    const b = document.createElement('studio-card') as InstanceType<typeof StudioCard>;
    a.textContent = b.textContent = 'Body';
    container.append(a, b);
    await settle(b);
    const baseB = b.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(getComputedStyle(baseB).paddingTop).toBe('2px');
    // Host defaults and structural styles are the same shared sheets in both definitions.
    expect(a.shadowRoot!.adoptedStyleSheets[0]).toBe(b.shadowRoot!.adoptedStyleSheets[0]);
    expect(a.shadowRoot!.adoptedStyleSheets[1]).toBe(b.shadowRoot!.adoptedStyleSheets[1]);
    expect(b.shadowRoot!.querySelector('[part="header"]')).not.toBeNull();
  });
});
