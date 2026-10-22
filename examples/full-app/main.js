// A full application with no build step: an application root, a router in hash mode, a store,
// and the components on the default theme, under a strict CSP with Trusted Types.
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import { createApp } from '@oddkin/app/app';
import { createRouter, route } from '@oddkin/app/router';
import { createStore } from '@oddkin/state/store';

const store = createStore({ name: 'Ada', saves: 0 });
const main = document.querySelector('main');

const router = createRouter({
  base: new URL('./', import.meta.url).pathname,
  mode: 'hash',
  routes: [route({ path: '', title: 'Profile' }), route({ path: 'summary', title: 'Summary' })],
  formatTitle: (title) => `${title} · Full application`,
  focus: () => main.querySelector('h1'),
});

const element = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
};

function profile({ name }) {
  const form = element(
    'form',
    { id: 'profile' },
    element('odd-input', { label: 'Name', name: 'name', value: name, required: '' }),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = String(new FormData(form).get('name'));
    store.update((state) => ({ name: next, saves: state.saves + 1 }));
    void router.navigate('/summary');
  });
  return element(
    'odd-card',
    { label: 'Profile' },
    element('h1', { slot: 'header' }, 'Profile'),
    form,
    element(
      'odd-button',
      { slot: 'footer', appearance: 'primary', type: 'submit', form: 'profile' },
      'Save',
    ),
  );
}

function summary({ name, saves }) {
  return element(
    'section',
    {},
    element('h1', {}, 'Summary'),
    element('p', { id: 'summary' }, `${name}, saved ${saves} time${saves === 1 ? '' : 's'}.`),
    element('a', { href: router.href('/') }, 'Edit the profile'),
  );
}

const app = createApp({
  name: 'full-app',
  setup({ scope, use }) {
    use(router);
    scope.effect(() => {
      const state = router.state.value;
      if (state.status !== 'ready') return;
      const data = store.state.value;
      main.replaceChildren(state.location?.path === '/summary' ? summary(data) : profile(data));
    });
  },
});
app.start();

document
  .querySelector('nav')
  .replaceChildren(
    element('a', { href: router.href('/') }, 'Profile'),
    element('a', { href: router.href('/summary') }, 'Summary'),
  );
document.body.dataset.ready = 'true';
