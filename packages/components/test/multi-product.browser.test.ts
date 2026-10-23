import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { compose, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { css } from '@oddkin/core/styles';
import { generate } from '@oddkin/tokens/generate';
import { OddkinButton, buttonDefinition, buttonStructuralStyles } from '../src/button/index.js';
import { OddkinCard, cardDefinition, cardStructuralStyles } from '../src/card/index.js';
import { focusRingStyles, hostStyles } from '../src/styles/index.js';
import '../src/button/button.define.js';
import '../src/card/card.define.js';

// Multi-product customization levels 1-3 (multi-product.md §6) on odd-button and odd-card:
// scoped product tokens, documented variables and parts, and a second visual implementation
// composed from the shared foundation in the same document.

const theme = new CSSStyleSheet();
const page = new CSSStyleSheet();
beforeAll(() => {
  const { css: tokens } = generate({
    brand: { primary: '#6250e8' },
    products: { alpha: { brand: { primary: '#0f766e' } }, beta: { brand: { primary: '#b91c1c' } } },
  });
  theme.replaceSync(tokens!);
  // Level 2 for one product only: a documented component variable and a part.
  page.replaceSync(`
    [data-odd-product='beta'] odd-card { --odd-card-radius: 0px; }
    [data-odd-product='beta'] odd-button::part(control) { text-transform: uppercase; }
    odd-button::part(control) { transition: none; }
  `);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, theme, page];
  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== theme && s !== page,
    );
  };
});

class StudioButton extends OddkinButton {}
class StudioCard extends OddkinCard {}
const studioStyles = css`
  [part~='control'] {
    border-radius: 999px;
    letter-spacing: 0.08em;
  }
`;
const studioButtonDefinition = compose({
  ...buttonDefinition,
  name: 'studio-button',
  element: StudioButton,
  styles: [hostStyles, buttonStructuralStyles, focusRingStyles, studioStyles],
});
const studioCardDefinition = compose({
  ...cardDefinition,
  name: 'studio-card',
  element: StudioCard,
  styles: [
    hostStyles,
    cardStructuralStyles,
    css`
      [part~='base'] {
        border-radius: 2px;
      }
    `,
  ],
});
define(studioButtonDefinition);
define(studioCardDefinition);

const roots: HTMLElement[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) root.remove();
  flush();
});

async function render(product: string | null, markup: string) {
  const root = document.createElement('div');
  if (product) root.dataset['oddProduct'] = product;
  root.innerHTML = markup;
  document.body.append(root);
  roots.push(root);
  const elements = [...root.querySelectorAll<HTMLElement & { updateComplete: Promise<void> }>('*')];
  await Promise.all(elements.map((el) => el.updateComplete));
  flush();
  return root;
}
const part = (host: Element, name: string) =>
  getComputedStyle(host.shadowRoot!.querySelector(`[part~="${name}"]`)!);

describe('customization levels 1-3 on odd-button and odd-card', () => {
  it('level 1: two products share definitions and differ only by scoped tokens', async () => {
    const markup =
      '<odd-button appearance="primary">Save</odd-button><odd-card appearance="filled">x</odd-card>';
    const alpha = await render('alpha', markup);
    const beta = await render('beta', markup);
    const [aButton, aCard] = [alpha.querySelector('odd-button')!, alpha.querySelector('odd-card')!];
    const [bButton, bCard] = [beta.querySelector('odd-button')!, beta.querySelector('odd-card')!];
    expect(aButton.constructor).toBe(bButton.constructor);
    expect(part(aButton, 'control').backgroundColor).not.toBe(
      part(bButton, 'control').backgroundColor,
    );
    expect(aCard.constructor).toBe(bCard.constructor);
    // A theme-value edit (switching the product) keeps the instance and its internals.
    const control = aButton.shadowRoot!.querySelector('[part~="control"]');
    const before = part(aButton, 'control').backgroundColor;
    alpha.dataset['oddProduct'] = 'beta';
    expect(alpha.querySelector('odd-button')).toBe(aButton);
    expect(aButton.shadowRoot!.querySelector('[part~="control"]')).toBe(control);
    expect(part(aButton, 'control').backgroundColor).not.toBe(before);
  });

  it('level 2: documented variables and parts customize one product without new definitions', async () => {
    const markup = '<odd-button>Save</odd-button><odd-card>x</odd-card>';
    const alpha = await render('alpha', markup);
    const beta = await render('beta', markup);
    expect(part(alpha.querySelector('odd-button')!, 'control').textTransform).toBe('none');
    expect(part(beta.querySelector('odd-button')!, 'control').textTransform).toBe('uppercase');
    expect(part(alpha.querySelector('odd-card')!, 'base').borderTopLeftRadius).not.toBe('0px');
    expect(part(beta.querySelector('odd-card')!, 'base').borderTopLeftRadius).toBe('0px');
  });

  it('level 3: a second visual implementation shares behavior and structural sheets in one document', async () => {
    const root = await render(
      'alpha',
      '<odd-button>A</odd-button><studio-button>B</studio-button><odd-card>C</odd-card><studio-card>D</studio-card>',
    );
    const [odd, studio] = [root.querySelector('odd-button')!, root.querySelector('studio-button')!];
    expect(customElements.get('studio-button')).toBe(StudioButton);
    expect(odd.constructor).not.toBe(studio.constructor);
    expect(studio).toBeInstanceOf(OddkinButton);
    expect(part(studio, 'control').borderTopLeftRadius).toBe('999px');
    expect(part(odd, 'control').borderTopLeftRadius).not.toBe('999px');
    // One constructed sheet per shared style object, adopted by both implementations.
    const shared = buttonStructuralStyles.sheetFor(document)!;
    expect(odd.shadowRoot!.adoptedStyleSheets).toContain(shared);
    expect(studio.shadowRoot!.adoptedStyleSheets).toContain(shared);
    const card = root.querySelector('studio-card')!;
    expect(card).toBeInstanceOf(OddkinCard);
    expect(part(card, 'base').borderTopLeftRadius).toBe('2px');
    expect(part(root.querySelector('odd-card')!, 'base').borderTopLeftRadius).not.toBe('2px');
  });

  it('reusing a constructor or redefining a name reports the documented diagnostics', () => {
    const codeOf = (fn: () => void) => {
      try {
        fn();
        return 'none';
      } catch (error) {
        return (error as { code?: string }).code;
      }
    };
    // The same definition again is a no-op.
    expect(codeOf(() => define(studioButtonDefinition))).toBe('none');
    // Another name for an already registered constructor.
    expect(codeOf(() => define(compose({ ...studioButtonDefinition, name: 'other-button' })))).toBe(
      'registry.constructorReused',
    );
    // A different definition for a registered name and constructor.
    expect(codeOf(() => define(compose({ ...studioButtonDefinition, styles: [hostStyles] })))).toBe(
      'registry.definitionConflict',
    );
  });
});
