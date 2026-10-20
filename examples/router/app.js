// A small application on the @oddkin/app router, loaded through an import map with no bundler:
// nested, lazy, and redirecting routes; native links; titles, focus, announcements, and scroll
// restoration. index.html runs it in history mode below /examples/router/, and hash.html in hash
// mode, as on a static host without rewrites.
import { createApp, createRouter, route } from '@oddkin/app';

const mode = document.body.dataset.mode === 'hash' ? 'hash' : 'history';
const main = document.querySelector('main');
const nav = document.querySelector('nav');

const guide = route({
  path: ':slug',
  params: ({ slug }) => (slug === 'one' || slug === 'two' ? { slug } : undefined),
  title: ({ params }) => `Guide ${params.slug}`,
  // A lazy level whose data arrives a little later, as from a network; it stops when superseded.
  load: ({ params, signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(`The ${params.slug} guide.`), 50);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      });
    }),
});

const router = createRouter({
  base: '/examples/router/',
  mode,
  routes: [
    route({ path: '', title: 'Home' }),
    route({ path: 'guides', title: 'Guides', children: [route({ path: '' }), guide] }),
    route({ path: 'long', title: 'Long page' }),
    route({ path: 'old-guides', redirect: '/guides' }),
  ],
  formatTitle: (title, state) =>
    `${state.status === 'not-found' ? 'Not found' : title} · Router example`,
  focus: () => main.querySelector('h1'),
});

const element = (tag, text, attributes = {}) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};

const otherPage =
  mode === 'hash'
    ? ['History-mode page', new URL('./', import.meta.url).pathname]
    : ['Hash-mode page', new URL('hash.html', import.meta.url).pathname];
nav.replaceChildren(
  ...[
    ['Home', router.href('/')],
    ['Guides', router.href('/guides')],
    ['Guide one', router.href('/guides/one')],
    ['Guide two', router.href('/guides/two')],
    ['Long page', router.href('/long')],
    ['Long page, section 2', router.href('/long#section-2')],
    ['Old guides', router.href('/old-guides')],
    ['Guide one in a new tab', router.href('/guides/one'), { target: '_blank' }],
    // Inside the base path, so only rel="external" keeps the router from handling it.
    [...otherPage, { rel: 'external' }],
    ['Download the example script', new URL('app.js', import.meta.url).pathname, { download: '' }],
  ].map(([text, href, attributes]) => element('a', text, { href, ...attributes })),
);

function render(state) {
  if (state.status === 'idle') return;
  const children = [element('h1', document.title.split(' · ')[0])];
  const leaf = state.matches.at(-1);
  if (state.status === 'error') children.push(element('p', `This page failed: ${state.error}`));
  else if (leaf?.status === 'ready' && typeof leaf.data === 'string')
    children.push(element('p', leaf.data));
  if (state.location?.path === '/' || state.location?.path === '/long') {
    // Long pages, to show scroll restoration and fragments.
    children.push(
      element('div', '', { class: 'tall' }),
      element('h2', 'Section 2', { id: 'section-2' }),
      element('div', '', { class: 'tall' }),
    );
  }
  main.replaceChildren(...children);
}

const app = createApp({
  name: 'router-example',
  setup({ scope, use }) {
    use(router); // listeners, levels, and the live region belong to this run
    scope.effect(() => render(router.state.value));
  },
});
app.start();

// Read by e2e/router.spec.ts: a new value means a new document was loaded.
window.loadId = Math.random().toString(36).slice(2);
document.body.dataset.ready = 'true';
