import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cdp, server } from 'vitest/browser';
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

// The badge in its parent (page 1395:2 and its handoff acceptance B-A2 to B-A7): intrinsic CSS,
// passive, the host owning words, tone, count, and announcements.
describe('odd-badge in its parent', () => {
  const settle = async (el: OddkinBadge) => {
    await el.updateComplete;
    flush();
    await new Promise(requestAnimationFrame);
  };
  const base = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const marker = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[part="marker"]')!;
  /** The rendered lines of the badge's own text. */
  const lines = (el: Element) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].filter((r) => r.width > 0);
  };
  const resolveIn = (scope: Element, property: string, variable: string) => {
    const probe = document.createElement('div');
    probe.style.setProperty(property, `var(${variable})`);
    scope.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };
  const TEXTS = [
    'Waiting for security review',
    'Überprüfung der Veröffentlichung ausstehend',
    '公開前の確認が必要です',
    'بانتظار مراجعة النشر',
    'RELEASE_REVIEW_REQUIRED_2026_11_15',
  ];

  it('B-A2: wraps long, localized, and unbroken words inside the grant, keeping all of them', async () => {
    for (const grant of [80, 160, 240])
      for (const text of TEXTS) {
        container.style.inlineSize = `${grant}px`;
        const { el } = await mount(text, { tone: 'info' });
        await settle(el);
        const at = `${grant} px: ${text}`;
        const surface = base(el).getBoundingClientRect();
        expect(surface.right, at).toBeLessThanOrEqual(
          container.getBoundingClientRect().right + 0.5,
        );
        expect(base(el).scrollWidth, at).toBeLessThanOrEqual(base(el).clientWidth + 1);
        expect(base(el).scrollHeight, at).toBeLessThanOrEqual(base(el).clientHeight + 1);
        // Every line lies inside the surface, after the glyph.
        const glyph = marker(el).getBoundingClientRect();
        for (const line of lines(el)) {
          expect(line.left, at).toBeGreaterThanOrEqual(Math.max(surface.left, glyph.right) - 0.5);
          expect(line.right, at).toBeLessThanOrEqual(surface.right + 0.5);
        }
        if (grant === 80) expect(lines(el).length, at).toBeGreaterThan(1);
        expect(el.textContent, at).toBe(text);
        el.remove();
      }
  });

  it('B-L1: the host is exactly its surface, so badges with and without a glyph line up', async () => {
    container.innerHTML = `<div style="display: flex; align-items: center; gap: 8px">
      <odd-badge tone="info">In review</odd-badge><odd-badge no-marker>12</odd-badge></div>
      <p>Inline <odd-badge tone="info">In review</odd-badge> and <odd-badge no-marker>12</odd-badge> text.</p>`;
    const badges = [...container.querySelectorAll<OddkinBadge>('odd-badge')];
    for (const badge of badges) await settle(badge);
    for (const badge of badges)
      expect(badge.getBoundingClientRect().height).toBe(base(badge).getBoundingClientRect().height);
    const centre = (badge: OddkinBadge) => {
      const box = base(badge).getBoundingClientRect();
      return box.top + box.height / 2;
    };
    expect(centre(badges[1]!)).toBeCloseTo(centre(badges[0]!), 1);
    expect(centre(badges[3]!)).toBeCloseTo(centre(badges[2]!), 1);
  });

  it('B-A9: wraps one inline label beside a focused action in a no-wrap parent', async () => {
    container.innerHTML = `<div style="display:flex; inline-size:240px; gap:4px; white-space:nowrap">
      <odd-badge tone="info">Waiting for <strong>security</strong> review</odd-badge>
      <button style="flex:none; inline-size:36px; white-space:inherit">OK</button>
    </div>`;
    const row = container.firstElementChild as HTMLElement;
    const badge = row.querySelector('odd-badge')!;
    const action = row.querySelector('button')!;
    await settle(badge);
    action.focus();

    row.style.inlineSize = '112px';
    await settle(badge);
    const badgeBox = badge.getBoundingClientRect();
    const actionBox = action.getBoundingClientRect();
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    expect(badgeBox.right + 4).toBeLessThanOrEqual(actionBox.left + 0.5);
    expect(new Set(lines(badge).map((line) => line.top)).size).toBeGreaterThan(1);
    for (const line of lines(badge)) {
      expect(line.left).toBeGreaterThanOrEqual(marker(badge).getBoundingClientRect().right - 0.5);
      expect(line.right).toBeLessThanOrEqual(badgeBox.right + 0.5);
    }
    expect(getComputedStyle(badge.querySelector('strong')!).display).toBe('inline');
    expect(getComputedStyle(action).whiteSpace).toBe('nowrap');
    expect(badge.textContent).toBe('Waiting for security review');
    expect(row.querySelector('odd-badge')).toBe(badge);
    expect(document.activeElement).toBe(action);
  });

  it('B-A10: keeps the token-sized marker beside the first line in both directions', async () => {
    container.style.inlineSize = '112px';
    const cases = [
      ['ltr', 'Waiting for accessibility review'],
      ['rtl', 'بانتظار مراجعة إمكانية الوصول'],
    ] as const;
    for (const [dir, text] of cases) {
      const { el } = await mount(text, { dir, tone: 'warning' });
      await settle(el);
      expect(lines(el).length).toBeGreaterThan(1);
      const surface = base(el);
      const styles = getComputedStyle(surface);
      const glyph = marker(el).querySelector('svg')!.getBoundingClientRect();
      const firstLineCentre =
        surface.getBoundingClientRect().top +
        parseFloat(styles.paddingBlockStart) +
        parseFloat(styles.lineHeight) / 2;
      expect(glyph.top + glyph.height / 2).toBeCloseTo(firstLineCentre);
      expect(glyph.width).toBe(parseFloat(resolveIn(container, 'width', '--odd-icon-size-sm')));
      el.remove();
    }
  });

  it('B-A3: shows the host’s committed words and tone in place, beside a focused action', async () => {
    const { el } = await mount('In review', { tone: 'info' });
    const action = document.createElement('button');
    action.textContent = 'Continue';
    container.append(action);
    action.focus();
    const events: string[] = [];
    for (const type of ['click', 'input', 'change', 'focus'])
      el.addEventListener(type, () => events.push(type));
    el.tone = 'success';
    el.textContent = 'Ready';
    await settle(el);
    el.noMarker = true;
    el.textContent = '13';
    await settle(el);
    expect(container.querySelector('odd-badge')).toBe(el);
    expect(document.activeElement).toBe(action);
    expect([el.tone, el.textContent]).toEqual(['success', '13']);
    expect(events).toEqual([]);
  });

  it('B-A4: has no role, tab stop, or live region; its glyph is decorative', async () => {
    const { el } = await mount('Failed', { tone: 'danger' });
    const internals = (el as unknown as { internals: ElementInternals }).internals;
    expect([el.getAttribute('role'), internals.role ?? null, internals.ariaLive ?? null]).toEqual([
      null,
      null,
      null,
    ]);
    expect(el.shadowRoot!.querySelector('[aria-live], [role]')).toBe(null);
    el.focus();
    expect(document.activeElement).not.toBe(el);
    expect(el.shadowRoot!.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    expect(marker(el).querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('B-A5: in a bounded reader the parent scrolls, and every record and the action stay reachable', async () => {
    container.innerHTML = `<section aria-label="Review records" tabindex="0"
      style="block-size: 176px; overflow-y: auto; inline-size: 240px">${Array.from(
        { length: 6 },
        (_, i) => `<p>Review record ${i + 1} <odd-badge tone="info">In review</odd-badge></p>`,
      ).join('')}<button id="continue">Continue</button></section>`;
    const reader = container.querySelector('section')!;
    const badges = [...reader.querySelectorAll<OddkinBadge>('odd-badge')];
    for (const badge of badges) await settle(badge);
    expect(reader.scrollHeight).toBeGreaterThan(reader.clientHeight);
    for (const badge of badges) {
      expect(getComputedStyle(base(badge)).overflowY).toBe('visible');
      expect(base(badge).scrollHeight).toBeLessThanOrEqual(base(badge).clientHeight + 1);
    }
    const action = container.querySelector<HTMLButtonElement>('#continue')!;
    action.focus();
    expect(document.activeElement).toBe(action);
    // The reader brings it into view (engines differ on whether focus() scrolls at once).
    action.scrollIntoView({ block: 'nearest' });
    await new Promise(requestAnimationFrame);
    const box = reader.getBoundingClientRect();
    const last = action.getBoundingClientRect();
    expect(last.top).toBeGreaterThanOrEqual(box.top - 0.5);
    expect(last.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
  });

  it('B-A6: leads with its glyph right to left, follows theme and density, and grows with the text', async () => {
    container.innerHTML = `<div dir="rtl"><odd-badge tone="info">قيد المراجعة</odd-badge></div>`;
    const rtl = container.querySelector<OddkinBadge>('odd-badge')!;
    await settle(rtl);
    const words = lines(rtl);
    expect(marker(rtl).getBoundingClientRect().left).toBeGreaterThanOrEqual(
      Math.max(...words.map((r) => r.right)) - 0.5,
    );
    for (const scope of ['data-odd-mode="dark"', 'data-odd-density="compact"']) {
      container.innerHTML = `<div ${scope}><odd-badge tone="warning">Needs review</odd-badge></div>`;
      const wrapper = container.firstElementChild!;
      const el = wrapper.firstElementChild as OddkinBadge;
      await settle(el);
      const style = getComputedStyle(base(el));
      expect(
        [style.paddingInlineStart, style.paddingBlockStart, style.columnGap, style.backgroundColor],
        scope,
      ).toEqual([
        resolveIn(wrapper, 'padding-inline-start', '--odd-space-xs'),
        resolveIn(wrapper, 'padding-block-start', '--odd-space-3xs'),
        resolveIn(wrapper, 'column-gap', '--odd-space-2xs'),
        resolveIn(wrapper, 'background-color', '--odd-color-warning-surface'),
      ]);
    }
    container.innerHTML = '<odd-badge tone="success">Ready for release</odd-badge>';
    const el = container.firstElementChild as OddkinBadge;
    await settle(el);
    const before = base(el).getBoundingClientRect().height;
    document.documentElement.style.fontSize = '200%';
    try {
      await new Promise(requestAnimationFrame);
      expect(base(el).getBoundingClientRect().height).toBeCloseTo(before * 2, 0);
      expect(base(el).scrollHeight).toBeLessThanOrEqual(base(el).clientHeight + 1);
    } finally {
      document.documentElement.style.fontSize = '';
    }
  });

  it.runIf(server.browser === 'chromium')(
    'B-A6: keeps a visible boundary and readable words in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const { el } = await mount('Failed', { tone: 'danger' });
        await settle(el);
        const style = getComputedStyle(base(el));
        const probe = document.createElement('span');
        probe.style.color = 'CanvasText';
        container.append(probe);
        expect([style.borderTopWidth, style.borderTopStyle, style.borderTopColor]).toEqual([
          '1px',
          'solid',
          getComputedStyle(probe).color,
        ]);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );

  it('B-A7: changing the marker keeps the words and adds no focus target', async () => {
    const { el } = await mount('12', { 'no-marker': '' });
    for (const noMarker of [false, true, false]) {
      el.noMarker = noMarker;
      await settle(el);
      expect(marker(el).hidden).toBe(noMarker);
      expect(el.textContent).toBe('12');
      expect(el.shadowRoot!.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    }
  });
});
