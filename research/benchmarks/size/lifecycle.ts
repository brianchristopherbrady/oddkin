// An application that follows the page lifecycle with one suspendable service:
// @oddkin/app/app and @oddkin/app/lifecycle.
import { createApp } from '@oddkin/app/app';
import { pageLifecycle } from '@oddkin/app/lifecycle';

const app = createApp({
  name: 'feed',
  setup({ app: self, use }) {
    const lifecycle = use(pageLifecycle(self));
    use({
      connect() {},
      suspend: () => globalThis.console.log('closing the feed'),
      resume: () => globalThis.console.log('opening the feed'),
    });
    lifecycle.state.subscribe((state) => globalThis.console.log(state.restorations));
  },
});
app.start();
