// 1,000-cycle lifetime scenarios (plan M8 917). Outside shipped code; driven by run.mjs.
// Ownership is read from core's scopeStats() (scopes, listeners, timers, effects); retained heap
// is measured by run.mjs through CDP in Chromium.
import { createApp } from '@oddkin/app/app';
import { command } from '@oddkin/app/command';
import { resource } from '@oddkin/app/resource';
import { createRouter, route } from '@oddkin/app/router';
import '@oddkin/components/define/alert';
import '@oddkin/components/define/avatar';
import '@oddkin/components/define/badge';
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/components/define/chip';
import '@oddkin/components/define/disclosure';
import '@oddkin/components/define/empty-state';
import '@oddkin/components/define/icon';
import '@oddkin/components/define/input';
import '@oddkin/components/define/progress';
import '@oddkin/components/define/side-nav';
import '@oddkin/components/define/skeleton';
import '@oddkin/components/define/spinner';
import { scopeStats } from '@oddkin/core/scope';
import { generate } from '@oddkin/tokens/generate';

type Stats = ReturnType<typeof scopeStats>;
interface Cycles {
  readonly cycles: number;
  readonly ms: number;
  readonly before: Stats;
  readonly after: Stats;
  readonly check: string;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function measure(
  cycles: number,
  body: (i: number) => Promise<void> | void,
  check: () => string,
): Promise<Cycles> {
  await tick();
  const before = scopeStats();
  const start = performance.now();
  for (let i = 0; i < cycles; i++) await body(i);
  await tick();
  return { cycles, ms: performance.now() - start, before, after: scopeStats(), check: check() };
}

/** An application with a router, a resource, and a command, started and stopped each cycle. */
function appCycles(cycles: number): Promise<Cycles> {
  let loaded = 0;
  return measure(
    cycles,
    async (i) => {
      const root = document.createElement('div');
      document.body.append(root);
      const router = createRouter({
        mode: 'hash',
        routes: [route({ path: '', title: 'home', load: async () => i })],
      });
      const data = resource({
        name: 'cycle',
        source: () => i,
        load: async (key: number) => {
          loaded++;
          return key;
        },
      });
      const save = command({ name: 'save', run: async (value: number) => value });
      const app = createApp({
        name: `cycle-${i}`,
        root,
        setup({ use, scope }) {
          use(router);
          scope.use(data);
          scope.use(save);
          scope.listen(window, 'resize', () => undefined);
          scope.timeout(() => undefined, 60_000);
        },
      });
      app.start();
      await save.run(i);
      await tick();
      app.stop();
      root.remove();
    },
    () => `resource loads: ${loaded}`,
  );
}

/** One application whose hash router navigates between a lazy nested route and a plain one. */
async function navigationCycles(cycles: number): Promise<Cycles> {
  const root = document.createElement('div');
  document.body.append(root);
  let commits = 0;
  const router = createRouter({
    mode: 'hash',
    routes: [
      route({ path: '', title: 'home' }),
      route({
        path: 'items',
        load: async () => 1,
        children: [
          route({
            path: ':id',
            params: ({ id }) => (id ? { id } : undefined),
            load: async ({ params }) => params.id,
          }),
        ],
      }),
    ],
  });
  const app = createApp({ name: 'navigation', root, setup: ({ use }) => void use(router) });
  app.start();
  const result = await measure(
    cycles,
    async (i) => {
      // A round trip, so every batch starts and ends on the same route (same level scopes).
      if (await router.navigate(`/items/${i}`)) commits++;
      if (await router.navigate('/')) commits++;
    },
    () => `committed ${commits}`,
  );
  app.stop();
  root.remove();
  return { ...result, check: `${result.check}; after stop: ${JSON.stringify(scopeStats())}` };
}

/** Theme Studio's token side: generate a draft and replace a frame-owned adopted sheet. */
async function themeEditCycles(cycles: number): Promise<Cycles> {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const win = frame.contentWindow as Window & typeof globalThis;
  const doc = frame.contentDocument as Document;
  const sheet = new win.CSSStyleSheet();
  doc.adoptedStyleSheets = [sheet];
  const seen = new Set<string>();
  const result = await measure(
    cycles,
    (i) => {
      const hue = (i * 37) % 360;
      const { css } = generate({ brand: { primary: `oklch(0.55 0.15 ${hue})` } });
      sheet.replaceSync(css ?? '');
      seen.add(win.getComputedStyle(doc.documentElement).getPropertyValue('--odd-ref-brand-600'));
    },
    () => `distinct brand-600 values: ${seen.size}`,
  );
  frame.remove();
  return result;
}

/** Connect and remove each component, with a render in between. */
function componentCycles(cycles: number): Promise<Cycles> {
  const container = document.createElement('div');
  document.body.append(container);
  let upgraded = 0;
  const result = measure(
    cycles,
    async () => {
      const button = document.createElement('odd-button');
      button.textContent = 'Save';
      const input = document.createElement('odd-input');
      input.setAttribute('label', 'Name');
      const card = document.createElement('odd-card');
      card.textContent = 'Body';
      const nav = document.createElement('odd-side-nav') as HTMLElement & { items: unknown };
      nav.items = [
        { kind: 'link', id: 'a', label: 'A', href: '#a' },
        {
          kind: 'group',
          id: 'g',
          label: 'Group',
          items: [{ kind: 'link', id: 'b', label: 'B', href: '#b' }],
        },
      ];
      const badge = document.createElement('odd-badge');
      badge.setAttribute('tone', 'success');
      badge.textContent = 'Saved';
      // Display elements, each in a state that owns something: an observer, an effect, a timer.
      const display = document.createElement('div');
      display.innerHTML = `<odd-alert tone="danger" label="Not saved" announce>Retry.</odd-alert>
        <odd-avatar label="Amelia Morgan"></odd-avatar>
        <odd-chip removable>Research</odd-chip>
        <odd-empty-state label="Nothing here">Add one.</odd-empty-state>
        <odd-icon label="Settings"></odd-icon>
        <odd-progress label="Uploading" value="0.4"></odd-progress>
        <odd-progress label="Preparing"></odd-progress>
        <odd-skeleton lines="3"></odd-skeleton>
        <odd-spinner>Loading…</odd-spinner>
        <odd-disclosure name="faq" label="One" open>1</odd-disclosure>
        <odd-disclosure name="faq" label="Two">2</odd-disclosure>`;
      const elements = [button, input, card, nav, badge, ...display.children];
      container.append(button, input, card, nav, badge, display);
      await tick();
      if (elements.every((el) => el.shadowRoot?.childElementCount)) upgraded++;
      button.remove();
      input.remove();
      card.remove();
      nav.remove();
      badge.remove();
      display.remove();
    },
    () => `container children: ${container.childElementCount}; rendered: ${upgraded}`,
  );
  return result.finally(() => container.remove());
}

Object.assign(globalThis, {
  lifetime: { appCycles, navigationCycles, themeEditCycles, componentCycles, scopeStats, tick },
});
