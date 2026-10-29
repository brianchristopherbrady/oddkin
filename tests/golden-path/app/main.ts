// The golden path's application (P0.5): the library's two elements on the library's theme, an
// Oddkin card, and an AI element, with two routes in hash mode and a store.
import '@acme/widgets/theme.css';
import '@oddkin/components/css/layout.css';
import '@acme/widgets/define/greeting';
import '@acme/widgets/define/tally';
import '@oddkin/ai/define/suggestions';
import '@oddkin/components/define/card';
import { createApp } from '@oddkin/app/app';
import { createRouter, route } from '@oddkin/app/router';
import { createStore } from '@oddkin/state/store';

interface State {
  readonly name: string;
  readonly count: number;
}

const store = createStore<State>({ name: 'Ada', count: 0 });
const main = document.querySelector('main')!;

const router = createRouter({
  base: new URL('./', document.baseURI).pathname,
  mode: 'hash',
  routes: [route({ path: '', title: 'Home' }), route({ path: 'about', title: 'About' })],
  formatTitle: (title) => `${title} · Acme`,
  focus: () => main.querySelector('h1'),
});

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  properties: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), properties);
  node.append(...children);
  return node;
}

function home({ name, count }: State): HTMLElement {
  // Suggested names: choosing one renames the greeting through the store.
  const suggestions = element('odd-suggestions', {
    insertOnly: true,
    strings: { label: 'Suggested names' },
    suggestions: ['Grace', 'Katherine'].map((label) => ({
      id: label.toLowerCase(),
      label,
      prompt: label,
    })),
  });
  suggestions.addEventListener('odd-suggestion-select', (event) => {
    const { prompt } = (event as CustomEvent<{ prompt: string }>).detail;
    store.update((state) => ({ ...state, name: prompt }));
  });
  const tally = element('acme-tally', { label: 'Presses', count });
  tally.addEventListener('count-change', (event) => {
    const { count: next } = (event as CustomEvent<{ count: number }>).detail;
    store.update((state) => ({ ...state, count: next }));
  });
  return element(
    'odd-card',
    {},
    element('h1', { slot: 'header' }, 'Acme'),
    element(
      'div',
      { className: 'odd-stack' },
      element('acme-greeting', { name }),
      suggestions,
      tally,
    ),
  );
}

function about({ name, count }: State): HTMLElement {
  return element(
    'section',
    { className: 'odd-stack' },
    element('h1', {}, 'About'),
    element(
      'p',
      { id: 'summary' },
      `${name} pressed the tally ${count} time${count === 1 ? '' : 's'}.`,
    ),
    element('a', { href: router.href('/') }, 'Back home'),
  );
}

const app = createApp({
  name: 'acme',
  setup({ scope, use }) {
    use(router);
    // A view renders from the store's snapshot when the route changes (an untracked read).
    scope.effect(() => {
      const state = router.state.value;
      if (state.status !== 'ready') return;
      const view = state.location?.path === '/about' ? about : home;
      main.replaceChildren(view(store.getSnapshot()));
    });
    // The greeting follows the store's name in place, without rendering the view again.
    scope.effect(() => {
      const { name } = store.state.value;
      for (const greeting of main.querySelectorAll('acme-greeting')) greeting.name = name;
    });
  },
});
app.start();

document
  .querySelector('nav')!
  .replaceChildren(
    element('a', { href: router.href('/') }, 'Home'),
    element('a', { href: router.href('/about') }, 'About'),
  );
document.body.dataset['ready'] = 'true';
