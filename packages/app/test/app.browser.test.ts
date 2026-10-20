// Applications on a page (core-contracts.md §9): context provided at each root for the run,
// consumers that follow stop and restart, two applications kept apart, one application per root.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OddkinElement, define } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';
import { scopeStats, type Scope } from '@oddkin/core/scope';
import { consume, createContext } from '@oddkin/state/context';
import { html } from '@oddkin/core/template';
import { createApp } from '../src/app/index.js';

const themeContext = createContext<string>('theme');

class AppThemeLabel extends OddkinElement {
  readonly theme = consume(this, themeContext, { fallback: 'none' });
  protected override connected(scope: Scope) {
    scope.use(this.theme);
  }
  protected override render() {
    return html`<span>${this.theme}</span>`;
  }
}
define('app-theme-label', AppThemeLabel);

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const rootWithLabel = () => {
  const root = document.createElement('section');
  const label = document.createElement('app-theme-label') as AppThemeLabel;
  root.append(label);
  container.append(root);
  return { root, label };
};
const textOf = async (label: AppThemeLabel) => {
  await label.updateComplete;
  return label.shadowRoot!.textContent;
};

describe('applications on a page', () => {
  it('provides context at its root for each run; consumers follow stop and restart', async () => {
    const { root, label } = rootWithLabel(); // connected before the application starts
    let theme = 'light';
    const app = createApp({
      name: 'shop',
      root,
      setup: ({ provide }) => provide(themeContext, theme),
    });
    expect(await textOf(label)).toBe('none');
    app.start();
    expect(await textOf(label)).toBe('light');
    app.stop();
    expect(await textOf(label)).toBe('none');
    expect(label.theme.provided).toBe(false);
    theme = 'dark';
    app.start();
    expect(await textOf(label)).toBe('dark'); // the new run's provider, found when it announces
    app.services!.value = 'contrast';
    expect(await textOf(label)).toBe('contrast');
    app.stop();
  });

  it('keeps two applications apart: contexts, work, and stopping', async () => {
    const baseline = scopeStats();
    const first = rootWithLabel();
    const second = rootWithLabel();
    const ticks = { a: 0, b: 0 };
    const a = createApp({
      name: 'a',
      root: first.root,
      setup({ provide, scope }) {
        provide(themeContext, 'from a');
        scope.interval(() => ticks.a++, 10);
      },
    });
    const b = createApp({
      name: 'b',
      root: second.root,
      setup({ provide, scope }) {
        provide(themeContext, 'from b');
        scope.interval(() => ticks.b++, 10);
      },
    });
    a.start();
    b.start();
    expect([await textOf(first.label), await textOf(second.label)]).toEqual(['from a', 'from b']);
    a.stop();
    expect([await textOf(first.label), await textOf(second.label)]).toEqual(['none', 'from b']);
    const stoppedAt = ticks.a;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(ticks.a).toBe(stoppedAt);
    expect(ticks.b).toBeGreaterThan(0);
    b.stop();
    first.root.remove();
    second.root.remove();
    flush();
    expect(scopeStats()).toEqual(baseline);
  });

  it('runs one application per root at a time', () => {
    const { root } = rootWithLabel();
    const first = createApp({ name: 'first', root, setup: () => {} });
    const second = createApp({ name: 'second', root, setup: () => {} });
    first.start();
    expect(() => second.start()).toThrow(
      expect.objectContaining({
        code: 'app.root.claimed',
        message: expect.stringContaining('"first"'),
      }),
    );
    expect(second.running).toBe(false);
    first.stop();
    second.start();
    expect(second.running).toBe(true);
    expect(() => first.start()).toThrow(expect.objectContaining({ code: 'app.root.claimed' }));
    second.stop();

    // A start whose setup throws does not keep the root.
    const failing = createApp({
      root,
      setup: () => {
        throw new Error('bad config');
      },
    });
    expect(() => failing.start()).toThrow('bad config');
    first.start();
    expect(first.running).toBe(true);
    first.stop();
  });

  it('lets an application inside another override context below its own root', async () => {
    const outer = rootWithLabel();
    const inner = document.createElement('div');
    const innerLabel = document.createElement('app-theme-label') as AppThemeLabel;
    inner.append(innerLabel);
    outer.root.append(inner);
    const page = createApp({
      root: outer.root,
      setup: ({ provide }) => provide(themeContext, 'page'),
    });
    const widget = createApp({
      root: inner,
      setup: ({ provide }) => provide(themeContext, 'widget'),
    });
    page.start();
    widget.start();
    expect([await textOf(outer.label), await textOf(innerLabel)]).toEqual(['page', 'widget']);
    widget.stop();
    expect(await textOf(innerLabel)).toBe('page'); // the enclosing application's provider again
    page.stop();
    expect(await textOf(innerLabel)).toBe('none');
  });
});
