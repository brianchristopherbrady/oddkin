// An application's router with nested, lazy, and redirecting routes: @oddkin/app/router alone.
import { createScope } from '@oddkin/core/scope';
import { createRouter, route } from '@oddkin/app/router';

const product = route({
  path: ':id',
  params: (raw) => (/^\d+$/.test(raw['id'] ?? '') ? { id: Number(raw['id']) } : undefined),
  title: (match) => `Product ${match.params.id}`,
  load: async ({ params, signal }) =>
    (await fetch(`/api/products/${params.id}`, { signal })).json(),
});
const router = createRouter({
  base: '/shop/',
  routes: [
    route({ path: '', title: 'Shop', load: () => fetch('/api/home').then((r) => r.json()) }),
    route({ path: 'products', title: 'Products', children: [product] }),
    route({ path: 'catalogue', redirect: '/products' }),
  ],
  formatTitle: (title) => (title ? `${title} · Shop` : 'Shop'),
});
createScope().use(router);
router.state.subscribe((state) => globalThis.console.log(state.status, router.href('/products')));
