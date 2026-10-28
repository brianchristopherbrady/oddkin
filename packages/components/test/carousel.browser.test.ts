import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { compose, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { carouselDefinition, OddkinCarousel } from '../src/carousel/index.js';
import './register.js';
import { loadTheme, settle, themeValue } from './probe.js';

// odd-carousel (component-contracts.md §3.4; Figma carousel), with the shipped theme.
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

const SLIDES =
  '<div><h3>A place for every project</h3><p>Organize shared work in one workspace.</p><button type="button" id="explore-1">Explore workspace</button></div><div><h3>Keep your team in sync</h3><p>Share updates.</p></div><div><h3>Move from idea to delivery</h3><p>Bring the next step into focus.</p></div>';

async function mount(attributes = 'label="Workspace highlights"', slides = SLIDES) {
  container = document.createElement('div');
  container.innerHTML = `<button type="button" id="before">before</button><odd-carousel ${attributes}>${slides}</odd-carousel><button type="button" id="after">after</button>`;
  document.body.append(container);
  const el = container.querySelector<OddkinCarousel>('odd-carousel')!;
  await settle(el);
  const log: string[] = [];
  el.addEventListener('input', () => log.push(`input ${el.current}`));
  el.addEventListener('change', () => log.push(`change ${el.current}`));
  return { el, log };
}
const part = (el: Element, name: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const parts = (el: Element, name: string) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`),
];
/** The heading of each slide that shows. */
const shown = (el: OddkinCarousel) =>
  parts(el, 'slide')
    .filter((slide) => !slide.hidden)
    .map(
      (slide) =>
        slide.querySelector('slot')!.assignedElements()[0]!.querySelector('h3')!.textContent,
    );
const press = async (el: OddkinCarousel, button: HTMLElement) => {
  // Playwright waits for an aria-disabled button to become enabled; a user can still press it.
  await userEvent.click(button, { force: true });
  await settle(el);
};

// Playwright's role locators cannot see ElementInternals semantics (card.browser.test.ts): a
// test-only subclass reads them.
type Semantics = { role: string | null; label: string | null; description: string | null };
class ProbeCarousel extends OddkinCarousel {
  get probe(): Semantics {
    return {
      role: this.internals.role ?? null,
      label: this.internals.ariaLabel ?? null,
      description: this.internals.ariaRoleDescription ?? null,
    };
  }
}
define(compose({ ...carouselDefinition, name: 'probe-carousel', element: ProbeCarousel }));

describe('odd-carousel', () => {
  it('is a named carousel region of slide groups, one shown, with previous, position, slide buttons, and next', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('[part~="slides"]')!.getAttribute('aria-live')).toBe(
      'polite',
    );
    const slides = parts(el, 'slide');
    expect(slides.map((s) => s.getAttribute('aria-label'))).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(slides.every((s) => s.getAttribute('role') === 'group')).toBe(true);
    expect(slides[0]!.getAttribute('aria-roledescription')).toBe('slide');
    expect(shown(el)).toEqual(['A place for every project']);
    expect(part(el, 'position').textContent).toBe('1 of 3');
    expect(part(el, 'previous').getAttribute('aria-label')).toBe('Previous slide');
    expect(part(el, 'previous').getAttribute('aria-disabled')).toBe('true');
    expect(part(el, 'next').hasAttribute('aria-disabled')).toBe(false);
    const picks = parts(el, 'pick');
    expect(picks.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Go to slide 1',
      'Go to slide 2',
      'Go to slide 3',
    ]);
    expect(picks.map((p) => p.textContent!.trim())).toEqual(['1', '2', '3']);
    expect(picks.map((p) => p.getAttribute('aria-current'))).toEqual(['true', null, null]);
    expect(part(el, 'picker').getAttribute('aria-label')).toBe('Slides');
  });

  it('is a region named by label, described as a carousel; a group without a label', async () => {
    container = document.createElement('div');
    container.innerHTML = `<probe-carousel label="Workspace highlights">${SLIDES}</probe-carousel>`;
    document.body.append(container);
    const el = container.querySelector<ProbeCarousel>('probe-carousel')!;
    await settle(el);
    expect(el.probe).toEqual({
      role: 'region',
      label: 'Workspace highlights',
      description: 'carousel',
    });
    el.label = '';
    el.strings = { carousel: 'carrusel' };
    await settle(el);
    expect(el.probe).toEqual({ role: 'group', label: null, description: 'carrusel' });
  });

  it('moves with previous, next, and the slide buttons, reporting input and change, focus staying put', async () => {
    const { el, log } = await mount();
    const next = part(el, 'next');
    // From the keyboard, focus stays on next, also once it is unavailable at the last slide.
    // (WebKit, as Safari, does not keep focus on a clicked button, so focus is checked by key.)
    next.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(shown(el)).toEqual(['Keep your team in sync']);
    expect(el.current).toBe('2');
    expect(part(el, 'position').textContent).toBe('2 of 3');
    expect(el.shadowRoot!.activeElement).toBe(next);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(el.shadowRoot!.activeElement).toBe(next);
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.current).toBe('3');
    // Presses: next at the end does nothing, previous, a slide button, the shown one's does nothing.
    await press(el, next);
    expect(el.current).toBe('3');
    await press(el, part(el, 'previous'));
    expect(shown(el)).toEqual(['Keep your team in sync']);
    await press(el, parts(el, 'pick')[0]!);
    expect(shown(el)).toEqual(['A place for every project']);
    // The shown slide's button does nothing.
    await press(el, parts(el, 'pick')[0]!);
    expect(log).toEqual([
      'input 2',
      'change 2',
      'input 3',
      'change 3',
      'input 2',
      'change 2',
      'input 1',
      'change 1',
    ]);
  });

  it('is reached with Tab through the shown slide, then its controls; Enter and Space activate', async () => {
    const { el } = await mount();
    container.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(document.activeElement!.id).toBe('explore-1');
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'previous'));
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(parts(el, 'pick')[0]);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(el.current).toBe('2');
    await userEvent.tab();
    await userEvent.tab();
    expect(el.shadowRoot!.activeElement).toBe(part(el, 'next'));
    await userEvent.keyboard(' ');
    await settle(el);
    expect(el.current).toBe('3');
    await userEvent.tab();
    expect(document.activeElement!.id).toBe('after');
  });

  it('shows the slide `current` names, the nearest one out of range, without reporting', async () => {
    const { el, log } = await mount('label="Highlights" current="3"');
    expect(shown(el)).toEqual(['Move from idea to delivery']);
    expect(part(el, 'next').getAttribute('aria-disabled')).toBe('true');
    expect(part(el, 'previous').hasAttribute('aria-disabled')).toBe(false);
    el.current = '9';
    await settle(el);
    expect(shown(el)).toEqual(['Move from idea to delivery']);
    el.current = '0';
    await settle(el);
    expect(shown(el)).toEqual(['A place for every project']);
    el.current = 'two';
    await settle(el);
    expect(shown(el)).toEqual(['A place for every project']);
    expect(log).toEqual([]);
  });

  it('follows slides added and removed', async () => {
    const { el } = await mount();
    const extra = document.createElement('div');
    extra.innerHTML = '<h3>Ship it</h3>';
    el.append(extra);
    await expect.poll(() => parts(el, 'pick').length).toBe(4);
    await settle(el);
    expect(part(el, 'position').textContent).toBe('1 of 4');
    el.current = '4';
    await settle(el);
    expect(shown(el)).toEqual(['Ship it']);
    extra.remove();
    await expect.poll(() => parts(el, 'pick').length).toBe(3);
    await settle(el);
    expect(shown(el)).toEqual(['Move from idea to delivery']);
    el.replaceChildren();
    await expect.poll(() => parts(el, 'slide').length).toBe(0);
    await settle(el);
    expect(part(el, 'position').textContent).toBe('');
  });

  it('keeps every control on a narrow carousel, wrapping them', async () => {
    const { el } = await mount();
    el.style.inlineSize = '200px';
    await settle(el);
    const box = el.getBoundingClientRect();
    const controls = [part(el, 'previous'), ...parts(el, 'pick'), part(el, 'next')];
    for (const control of controls) {
      const rect = control.getBoundingClientRect();
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.right).toBeLessThanOrEqual(box.right + 0.5);
    }
    // None overlaps another: they wrap instead.
    controls.forEach((a, i) =>
      controls.slice(i + 1).forEach((b) => {
        const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        const apart =
          ra.right <= rb.left + 0.5 ||
          rb.right <= ra.left + 0.5 ||
          ra.bottom <= rb.top + 0.5 ||
          rb.bottom <= ra.top + 0.5;
        expect(apart, `${a.getAttribute('part')} ${i}`).toBe(true);
      }),
    );
    expect(part(el, 'slide').getBoundingClientRect().right).toBeLessThanOrEqual(box.right + 0.5);
  });

  it('draws the slide on the sunken surface and the shown slide button on the selection surface', async () => {
    const { el } = await mount();
    const slide = getComputedStyle(part(el, 'slide'));
    expect(slide.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-surface-sunken'),
    );
    expect(slide.borderTopColor).toBe(themeValue('border-top-color', '--odd-color-border-default'));
    expect(getComputedStyle(part(el, 'base')).rowGap).toBe(themeValue('row-gap', '--odd-space-sm'));
    const [current, other] = parts(el, 'pick').map((p) => getComputedStyle(p));
    expect(current!.backgroundColor).toBe(
      themeValue('background-color', '--odd-color-selection-surface'),
    );
    expect(current!.color).toBe(themeValue('color', '--odd-color-link'));
    expect(other!.color).toBe(themeValue('color', '--odd-color-text-secondary'));
    // Previous looks disabled at the first slide, next does not.
    expect(getComputedStyle(part(el, 'previous')).color).toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
    expect(getComputedStyle(part(el, 'next')).color).not.toBe(
      themeValue('color', '--odd-color-text-disabled'),
    );
  });

  it('takes localized strings and mirrors its arrows right to left', async () => {
    const { el } = await mount('label="Temas" dir="rtl"');
    el.strings = {
      position: '{index} de {count}',
      goTo: 'Ir a la diapositiva {index}',
      next: 'Siguiente',
    };
    await settle(el);
    expect(part(el, 'position').textContent).toBe('1 de 3');
    expect(parts(el, 'pick')[1]!.getAttribute('aria-label')).toBe('Ir a la diapositiva 2');
    expect(part(el, 'next').getAttribute('aria-label')).toBe('Siguiente');
    expect(getComputedStyle(part(el, 'next').querySelector('.glyph')!).scale).toBe('-1 1');
  });

  it('releases everything when removed', async () => {
    const before = scopeStats();
    const { el } = await mount();
    await press(el, part(el, 'next'));
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
