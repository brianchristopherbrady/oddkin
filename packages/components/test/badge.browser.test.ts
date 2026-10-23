import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import '../src/badge/badge.define.js';
import type { OddkinBadge } from '../src/badge/badge.js';
import { TONES } from '../src/styles/tone.styles.js';

// The shipped default theme, so colours are compared with real role values.
let theme: HTMLLinkElement;
beforeAll(async () => {
  theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  await new Promise((resolve, reject) => {
    theme.onload = resolve;
    theme.onerror = reject;
    document.head.append(theme);
  });
});
afterAll(() => theme.remove());

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

async function mount(text: string, attributes: Record<string, string> = {}) {
  const el = document.createElement('odd-badge');
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.textContent = text;
  container.append(el);
  await el.updateComplete;
  flush();
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  return { el, part };
}

/** The computed colour of a theme custom property, resolved in this document. */
function themeColor(property: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${property})`;
  container.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

const glyphShape = (el: OddkinBadge) =>
  el.shadowRoot!.querySelector('[part="marker"] svg')!.innerHTML.replace(/\s+/g, ' ');

describe('odd-badge', () => {
  it('shows its text in place with a neutral tone and a decorative glyph by default', async () => {
    const { el, part } = await mount('Draft');
    expect(el.tone).toBe('neutral');
    expect(el.getAttribute('tone')).toBe('neutral');
    expect(el.textContent).toBe('Draft');
    const marker = part('marker');
    expect(marker.hidden).toBe(false);
    expect(marker.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(part('base')).color).toBe(themeColor('--odd-color-neutral-foreground'));
    expect(getComputedStyle(part('base')).backgroundColor).toBe(
      themeColor('--odd-color-neutral-surface'),
    );
    // The theme is loaded: the surface is a real colour, not the transparent fallback.
    expect(getComputedStyle(part('base')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('takes each tone colour from the theme and a glyph that differs where Figma differs', async () => {
    const shapes = new Map<string, string>();
    for (const tone of TONES) {
      const { el, part } = await mount(tone, { tone });
      expect(getComputedStyle(part('base')).color, tone).toBe(
        themeColor(`--odd-color-${tone}-foreground`),
      );
      expect(getComputedStyle(part('base')).backgroundColor, tone).toBe(
        themeColor(`--odd-color-${tone}-surface`),
      );
      shapes.set(tone, glyphShape(el));
    }
    expect(shapes.get('info')).toBe(shapes.get('neutral'));
    expect(shapes.get('danger')).toBe(shapes.get('warning'));
    expect(new Set(shapes.values()).size).toBe(3);
  });

  it('hides the glyph for a count and follows tone changes', async () => {
    const { el, part } = await mount('12', { 'no-marker': '' });
    expect(el.noMarker).toBe(true);
    expect(getComputedStyle(part('marker')).display).toBe('none');
    const neutral = glyphShape(el);
    el.tone = 'success';
    el.noMarker = false;
    await el.updateComplete;
    flush();
    expect(el.getAttribute('tone')).toBe('success');
    expect(el.hasAttribute('no-marker')).toBe(false);
    expect(getComputedStyle(part('marker')).display).not.toBe('none');
    expect(glyphShape(el)).not.toBe(neutral);
  });

  it('falls back to neutral for an unknown tone and reports it', async () => {
    const codes: string[] = [];
    setErrorHandler((_error, context) => codes.push(context.code ?? ''));
    try {
      const { el, part } = await mount('Failed', { tone: 'error' });
      expect(el.tone).toBe('neutral');
      expect(getComputedStyle(part('base')).color).toBe(
        themeColor('--odd-color-neutral-foreground'),
      );
    } finally {
      setErrorHandler(undefined);
    }
    expect(codes).toEqual(['element.attribute.invalid']);
  });
});
