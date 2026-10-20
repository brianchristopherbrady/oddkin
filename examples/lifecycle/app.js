// The page lifecycle (ADR 0035) with no bundler: an application that uses `pageLifecycle()`, a
// polling service that pauses while the page is suspended, a store whose state survives a
// back/forward cache restoration, and two resources, of which only one has a restore policy.
import { createApp, pageLifecycle, resource } from '@oddkin/app';
import { createStore } from '@oddkin/state';
import { scopeStats } from '@oddkin/core/scope';

const counter = createStore({ clicks: 0 });
const loads = { revalidating: 0, kept: 0 };
const revalidating = resource({
  name: 'revalidating',
  source: () => 'edition',
  load: async () => ++loads.revalidating,
  revalidateOnRestore: true, // loads again after a restoration
});
const kept = resource({ name: 'kept', source: () => 'edition', load: async () => ++loads.kept });
const service = { suspended: 0, resumed: 0, ticks: 0 };

const app = createApp({
  name: 'lifecycle-example',
  setup({ app: self, scope, use }) {
    const lifecycle = use(pageLifecycle(self)); // the only page-lifecycle listeners
    // A polling service: its interval lives on a child scope, ended on suspension and renewed on
    // resumption, so resuming never duplicates it.
    let polling;
    const poll = () => {
      polling = scope.child({ name: 'polling' });
      polling.interval(() => service.ticks++, 250);
    };
    poll();
    use({
      connect() {},
      suspend() {
        service.suspended++;
        polling.dispose();
        window.lifecycleAudit.transitions.push('service:suspend');
      },
      resume() {
        service.resumed++;
        poll();
        window.lifecycleAudit.transitions.push('service:resume');
      },
    });
    scope.use(revalidating);
    scope.use(kept);
    scope.effect(() => render(lifecycle.state.value));
    return { lifecycle };
  },
});

const status = document.getElementById('status');
function render(state) {
  const value = (resource) => {
    const current = resource.state.value;
    return current.status === 'success' ? `load ${current.value}` : current.status;
  };
  const rows = [
    ['Application', app.running ? (app.suspended ? 'suspended' : 'running') : 'stopped'],
    ['Restorations', String(state?.restorations ?? 0)],
    ['Count', String(counter.state.value.clicks)],
    ['Service suspended / resumed', `${service.suspended} / ${service.resumed}`],
    ['Resource with a restore policy', value(revalidating)],
    ['Resource without one', value(kept)],
  ];
  status.replaceChildren(
    ...rows.flatMap(([term, detail]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = term;
      dd.textContent = detail;
      dd.dataset.term = term;
      return [dt, dd];
    }),
  );
}

document
  .getElementById('count')
  .addEventListener('click', () => counter.update((state) => ({ clicks: state.clicks + 1 })));
document.getElementById('stop').addEventListener('click', () => {
  app.stop();
  render(undefined);
});
document.getElementById('start').addEventListener('click', () => app.start());
app.start();

// Read by e2e/lifecycle.spec.ts: a new loadId means a new document was loaded.
window.lifecycleExample = {
  loadId: Math.random().toString(36).slice(2),
  app,
  service,
  loads,
  counter,
  scopeStats,
};
document.body.dataset.ready = 'true';
