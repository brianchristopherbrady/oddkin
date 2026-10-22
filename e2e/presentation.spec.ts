import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

// M8 presentation checks for the shipped components (button, input, card, side-nav) and the
// @oddkin/ai elements, on their example pages: keyboard focus visibility (normal and forced
// colours), reflow at 200% and 400% zoom equivalents, WCAG 1.4.12 text spacing, right-to-left
// layout, reduced motion, and axe-core in dark mode and right-to-left. Automated evidence only:
// screen readers, real page zoom, and Windows High Contrast themes are manual checks (M8).

const require = createRequire(import.meta.url);

const PAGES = {
  components: { url: '/examples/components-only/', tag: 'odd-card' },
  'side-nav': { url: '/examples/side-nav/', tag: 'odd-side-nav' },
  'ai-research': { url: '/examples/ai-research/' },
  'ai-writing': { url: '/examples/ai-writing/' },
  'ai-agent': { url: '/examples/ai-agent/' },
} as const;
type PageName = keyof typeof PAGES;
const NAMES = Object.keys(PAGES) as PageName[];

/** Opens a page and brings it to its richest state (an answered question, a started run). */
async function open(page: Page, name: PageName) {
  const { url, tag } = PAGES[name] as { url: string; tag?: string };
  await page.goto(url);
  if (tag) await page.waitForFunction((t) => !!customElements.get(t), tag);
  else await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  if (name === 'ai-research') {
    const composer = page.getByRole('textbox', { name: 'Ask a research question' });
    await composer.fill('Summarize ocean warming');
    await composer.press('Enter');
    await expect(page.locator('#state')).toContainText('attempt completed', { timeout: 60_000 });
  }
  if (name === 'ai-agent') {
    await page.getByRole('button', { name: 'Start run' }).click();
    await expect(page.locator('odd-question')).toBeVisible({ timeout: 10_000 });
  }
}

interface Stop {
  id: string;
  oddkin: boolean;
  ring: { style: string; width: number } | null;
}

/** Tabs through the whole page from a sentinel at the start of the body. */
async function tabStops(page: Page): Promise<Stop[]> {
  await page.evaluate(() => {
    const sentinel = document.createElement('span');
    sentinel.id = 'm8-sentinel';
    sentinel.tabIndex = 0;
    document.body.prepend(sentinel);
    sentinel.focus();
  });
  const stops: Stop[] = [];
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((): Stop | null => {
      let el = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      if (!el || el === document.body || el.id === 'm8-sentinel') return null;
      const host = (el.getRootNode() as ShadowRoot).host as Element | undefined;
      // The ring is on the focused element, or on a host that delegates focus to it.
      let ring: Stop['ring'] = null;
      for (let n: Element | null = el, depth = 0; n && depth < 4; depth++) {
        const s = getComputedStyle(n);
        if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) {
          ring = { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
          break;
        }
        n =
          n.parentElement ?? ((n.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
      }
      const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30);
      return {
        id: `${host ? `${host.localName}::` : ''}${el.localName}${el.id ? `#${el.id}` : ''} "${label}"`,
        oddkin: !!host?.localName.startsWith('odd-'),
        ring,
      };
    });
    // Headless Firefox moves focus to the browser chrome after the last element.
    if (!stop || stop.id === stops[0]?.id || stop.id === stops.at(-1)?.id) break;
    stops.push(stop);
  }
  return stops;
}

/**
 * Elements outside the viewport that no ancestor clips or scrolls (a scroller such as a code
 * block contains its own overflow), and text clipped by `overflow: hidden | clip`.
 */
function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const all: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    const parent = (n: Element) =>
      n.parentElement ?? ((n.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
    const name = (el: Element) => {
      const host = (el.getRootNode() as ShadowRoot).host as Element | undefined;
      const part = el.getAttribute('part');
      return `${host ? `${host.localName}::` : ''}${el.localName}${el.id ? `#${el.id}` : ''}${part ? `[part=${part}]` : ''}`;
    };
    const contained = (el: Element) => {
      for (let n = parent(el); n && n !== document.documentElement; n = parent(n))
        if (getComputedStyle(n).overflowX !== 'visible') return true;
      return false;
    };
    const outside: string[] = [];
    const clipped: string[] = [];
    for (const el of all) {
      // Content of a closed <details> is not rendered (Firefox still reports stale boxes for it).
      if (!el.checkVisibility({ visibilityProperty: true })) continue;
      const s = getComputedStyle(el);
      if (s.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > width + 0.5 || r.left < -0.5) && !contained(el))
        outside.push(`${name(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
      const hiddenX = s.overflowX === 'hidden' || s.overflowX === 'clip';
      const hiddenY = s.overflowY === 'hidden' || s.overflowY === 'clip';
      // Visually hidden text (1 px boxes) and deliberate ellipsis are not clipping failures.
      if (r.width <= 2 || r.height <= 2 || !el.textContent?.trim()) continue;
      if (s.textOverflow === 'ellipsis') continue;
      if (hiddenX && el.scrollWidth > el.clientWidth + 1) clipped.push(`${name(el)} x`);
      if (hiddenY && el.scrollHeight > el.clientHeight + 1) clipped.push(`${name(el)} y`);
    }
    return {
      overflow: document.documentElement.scrollWidth - width,
      outside,
      clipped,
    };
  });
}

async function axe(page: Page) {
  // Evaluated through the automation channel (not a <script>), so CSP and Trusted Types stay.
  await page.evaluate(readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
  return page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run(
            context: Document,
            options: object,
          ): Promise<{ violations: { id: string; nodes: { target: unknown }[] }[] }>;
        };
      }
    ).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map((v) => `${v.id}: ${JSON.stringify(v.nodes.map((n) => n.target))}`);
  });
}

test.describe.configure({ timeout: 120_000 });

for (const name of NAMES) {
  test.describe(name, () => {
    for (const forced of [false, true]) {
      test(`every keyboard stop shows a focus ring${forced ? ' in forced colors' : ''}`, async ({
        page,
        browserName,
      }) => {
        if (forced) await page.emulateMedia({ forcedColors: 'active' });
        await open(page, name);
        if (forced) {
          const active = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
          test.skip(!active, `${browserName} does not emulate forced colors`);
        }
        const stops = await tabStops(page);
        test.info().annotations.push({ type: 'tab stops', description: String(stops.length) });
        expect(stops.filter((s) => s.oddkin).length).toBeGreaterThan(0);
        expect(stops.filter((s) => !s.ring).map((s) => s.id)).toEqual([]);
        // Oddkin's own ring is the token-bound 2 px solid outline.
        expect(
          stops
            .filter((s) => s.oddkin && (s.ring!.style !== 'solid' || s.ring!.width < 2))
            .map((s) => `${s.id} ${s.ring!.style} ${s.ring!.width}px`),
        ).toEqual([]);
      });
    }

    test('reflows at 1280, 640 (200% zoom), and 320 (400% zoom) CSS px', async ({ page }) => {
      await open(page, name);
      for (const [width, height] of [
        [1280, 800],
        [640, 400],
        [320, 256],
      ] as const) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(() => layoutProblems(page))
          .toEqual({ overflow: 0, outside: [], clipped: [] });
      }
    });

    test('keeps content with WCAG 1.4.12 text spacing', async ({ page }) => {
      await open(page, name);
      // Applied to the document and every shadow root, as a user style sheet would be.
      await page.evaluate(() => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-block-end: 2em !important; }',
        );
        const apply = (root: Document | ShadowRoot) => {
          root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
          for (const el of root.querySelectorAll('*')) if (el.shadowRoot) apply(el.shadowRoot);
        };
        apply(document);
      });
      for (const width of [1280, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await expect
          .poll(() => layoutProblems(page))
          .toEqual({ overflow: 0, outside: [], clipped: [] });
      }
    });

    test('lays out right to left without overflow and passes axe', async ({ page }) => {
      await open(page, name);
      await page.evaluate(() => (document.documentElement.dir = 'rtl'));
      for (const width of [1280, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await expect
          .poll(() => layoutProblems(page))
          .toEqual({ overflow: 0, outside: [], clipped: [] });
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      expect(await axe(page)).toEqual([]);
    });

    test('passes axe in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await open(page, name);
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(
        true,
      );
      expect(await axe(page)).toEqual([]);
    });

    test('runs no animation or transition with reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, name);
      const moving = await page.evaluate(() => {
        const all: Element[] = [];
        const walk = (root: Document | ShadowRoot) => {
          for (const el of root.querySelectorAll('*')) {
            all.push(el);
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        walk(document);
        const longest = (value: string) =>
          Math.max(
            ...value.split(',').map((v) => parseFloat(v) * (v.trim().endsWith('ms') ? 0.001 : 1)),
          );
        return all
          .map((el) => [el, getComputedStyle(el)] as const)
          .filter(
            ([, s]) =>
              longest(s.transitionDuration) > 0.01 ||
              (s.animationName !== 'none' && longest(s.animationDuration) > 0),
          )
          .map(([el]) => el.localName);
      });
      expect(moving).toEqual([]);
      expect(
        await page.evaluate(
          () => document.getAnimations().filter((a) => a.playState === 'running').length,
        ),
      ).toBe(0);
    });
  });
}
