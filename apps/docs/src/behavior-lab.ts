import type { Scope } from '@oddkin/core/scope';
import type { WorkbenchIndex } from '@oddkin/workbench/data';
import { createIsolatedPreview } from '@oddkin/workbench/preview';
import type { FrameSettings } from '@oddkin/workbench/protocol';
import type { BehaviorCanvas, BehaviorMetrics } from './behavior-canvas.js';
import { behaviorExamples, behaviorPayload, type BehaviorExample } from './behavior-data.js';
import { loadComponent, loadIndex } from './reference.js';

const FRAME = '/apps/docs/behavior-frame.html';
const SCENARIOS = [
  ['review-in-disclosure', 'Review inside a disclosure'],
  ['toolbar-tools', 'Related controls in an action area'],
  ['details-in-tabs', 'Supporting details in tabs'],
  ['form-in-dialog', 'An editing task in a dialog'],
] as const;
const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
};

/** One docs-owned lab lifetime; the components and fixture scopes stay owned by Workbench. */
export function mountBehaviorLab(host: HTMLElement, owner: Scope): () => void {
  const scope = owner.child({ name: 'docs-responsiveness-lab' });
  host.classList.add('behavior-lab');
  const controls = element('div', 'behavior-lab-controls odd-auto-grid odd-auto-grid-fit');
  controls.id = 'behavior-lab-controls';
  const makeSelect = (
    label: string,
    id: string,
    options: readonly (readonly [string, string])[],
  ) => {
    const field = element('div', 'behavior-lab-field odd-stack');
    const caption = element('label', undefined, label);
    caption.htmlFor = id;
    const select = element('select');
    select.id = id;
    for (const [value, text] of options) {
      const option = element('option', undefined, text);
      option.value = value;
      select.append(option);
    }
    field.append(caption, select);
    controls.append(field);
    return select;
  };
  const component = makeSelect('Component', 'behavior-component', []);
  const example = makeSelect('Example', 'behavior-example', []);
  const purpose = makeSelect('Purpose', 'behavior-purpose', [
    ['flow', 'Flow — allow growth'],
    ['bounded', 'Bounded — reserve space'],
  ]);
  const widthField = element('div', 'behavior-lab-field odd-stack');
  const widthLabel = element('label', undefined, 'Width');
  widthLabel.htmlFor = 'behavior-width';
  const width = element('input');
  width.id = 'behavior-width';
  width.type = 'range';
  width.min = '240';
  width.max = '960';
  width.step = '10';
  width.value = '640';
  const widthValue = element('output', 'behavior-lab-width-value', '640 px requested');
  widthValue.htmlFor = width.id;
  widthField.append(widthLabel, width, widthValue);
  controls.append(widthField);
  const density = makeSelect('Density', 'behavior-density', [
    ['default', 'Default'],
    ['compact', 'Compact'],
  ]);
  const mode = makeSelect('Appearance', 'behavior-mode', [
    ['light', 'Light'],
    ['dark', 'Dark'],
  ]);
  mode.value = document.documentElement.dataset['oddMode'] === 'dark' ? 'dark' : 'light';
  const direction = makeSelect('Direction', 'behavior-direction', [
    ['ltr', 'Left to right'],
    ['rtl', 'Right to left'],
  ]);
  const actions = element('div', 'behavior-lab-actions odd-cluster');
  const reset = element('button', 'odd-button', 'Reset example');
  reset.type = 'button';
  reset.disabled = true;
  example.disabled = true;
  actions.append(reset);
  controls.append(actions);
  const status = element('p', 'behavior-lab-status', 'Loading component examples…');
  status.id = 'behavior-lab-status';
  status.setAttribute('role', 'status');
  status.dataset['state'] = 'loading';
  const metrics = element('output', 'behavior-lab-meta');
  metrics.id = 'behavior-lab-metrics';
  const canvasHost = element('div', 'behavior-lab-canvas odd-center');
  canvasHost.id = 'behavior-lab-canvas';
  const guidance = element('p', 'behavior-lab-help');
  const sourceLink = element('a', undefined, 'Open component reference');
  sourceLink.hidden = true;
  const events = element('details', 'behavior-lab-events');
  events.append(element('summary', undefined, 'Interaction events'));
  const eventList = element('ol');
  events.append(eventList);
  const snippet = element('details', 'behavior-lab-help');
  snippet.append(element('summary', undefined, 'Use this parent pattern'));
  const pre = element('pre');
  const code = element('code');
  pre.append(code);
  snippet.append(pre);
  host.append(controls, status, metrics, canvasHost, guidance, sourceLink, events, snippet);
  scope.add(() => {
    for (const node of [
      controls,
      status,
      metrics,
      canvasHost,
      guidance,
      sourceLink,
      events,
      snippet,
    ])
      node.remove();
  }, 'lab interface');
  const abort = new AbortController();
  scope.add(() => abort.abort(), 'lab data');
  let index: WorkbenchIndex;
  let cases: BehaviorExample[] = [];
  let caseOwner = '';
  let canvas: BehaviorCanvas | undefined;
  let revision = 0;
  let currentHeight = 640;
  let frameError: string | undefined;
  let mountQueue: Promise<void> = Promise.resolve();
  const settings = (): FrameSettings => ({
    mode: mode.value === 'dark' ? 'dark' : 'light',
    direction: direction.value === 'rtl' ? 'rtl' : 'ltr',
    ...(density.value === 'compact' ? { density: 'compact' } : {}),
  });
  const setStatus = (state: 'loading' | 'ready' | 'error', message: string) => {
    if (!scope.disposed) {
      status.dataset['state'] = state;
      status.textContent = message;
      reset.disabled = state !== 'ready';
      example.disabled = state === 'loading' || caseOwner !== component.value || cases.length < 2;
    }
  };
  const failure = (error: unknown) => {
    if (!scope.disposed) setStatus('error', error instanceof Error ? error.message : String(error));
  };
  const preview = createIsolatedPreview({
    document,
    container: canvasHost,
    frameUrl: FRAME,
    title: 'Responsive component playground',
    timeoutMs: 60000,
    onMessage(message) {
      if (scope.disposed) return;
      if (message.kind === 'error') {
        frameError = `Example unavailable: ${JSON.stringify(message.payload)}`;
        failure(frameError);
      }
      if (message.kind === 'event') {
        const item = element('li');
        const text = JSON.stringify(message.payload);
        item.textContent = text.length > 700 ? text.slice(0, 700) + '…' : text;
        eventList.prepend(item);
        while (eventList.children.length > 15) eventList.lastElementChild?.remove();
      }
    },
  });
  preview.iframe.id = 'behavior-lab-frame';
  scope.add(() => preview.dispose(), 'lab preview');
  function renderMetrics(value: BehaviorMetrics) {
    if (scope.disposed) return;
    metrics.textContent = `${Math.round(value.width)} px canvas · ${Math.round(value.capacity)} px usable · ${value.shift > 0 ? '+' : ''}${value.shift} px neighbor movement${value.purpose === 'flow' ? ' (growth allowed)' : ''}`;
    metrics.dataset['width'] = String(value.width);
    metrics.dataset['capacity'] = String(value.capacity);
    metrics.dataset['shift'] = String(value.shift);
    const height = Math.max(value.purpose === 'bounded' ? 640 : 420, value.height);
    if (height !== currentHeight) {
      currentHeight = height;
      preview.setViewport(Number(width.value), height);
    }
  }
  function updateSnippet() {
    code.textContent = `<odd-container measure="fluid">\n  <section class="responsive-region${purpose.value === 'bounded' ? ' reserved' : ''}">\n    <!-- Keep the same component instance here. -->\n  </section>\n</odd-container>\n\n.responsive-region {\n  container: odd-container / inline-size;\n  min-inline-size: 0;\n  padding: var(--odd-space-md);\n}\n.reserved {\n  block-size: 20rem;\n  overflow: auto;\n  scrollbar-gutter: stable;\n}`;
  }
  function queueMount(own: number, work: () => Promise<unknown>): Promise<void> {
    const pending = mountQueue.then(async () => {
      if (scope.disposed || own !== revision) return;
      frameError = undefined;
      await work();
    });
    mountQueue = pending.catch(() => undefined);
    return pending;
  }
  async function applyGrant() {
    await preview.request('settings', settings());
    await canvas?.configurePurpose(purpose.value === 'bounded' ? 'bounded' : 'flow');
    updateSnippet();
  }
  async function selectCase(changeComponent: boolean) {
    const own = ++revision;
    frameError = undefined;
    setStatus('loading', 'Loading the working example…');
    eventList.replaceChildren();
    const scenario = component.value.startsWith('scenario:') ? component.value.slice(9) : undefined;
    if (scenario) {
      example.replaceChildren(element('option', undefined, 'Composed working flow'));
      example.disabled = true;
      sourceLink.hidden = true;
      guidance.textContent =
        'The components share the allocated region and retain their own state. App responses in this example are simulated.';
      await queueMount(own, () =>
        preview.request('mount', {
          tag: 'odd-container',
          registration: '@oddkin/components/define/container',
          example: `example:odd-container/${scenario}`,
          fixture: '/apps/docs/dist/behavior-scenarios.js',
          attributes: { measure: 'fluid' },
          settings: settings(),
          events: [
            'input',
            'change',
            'submit',
            'odd-question-answer',
            'odd-question-skip',
            'odd-action',
            'odd-model-change',
            'odd-tool-retry',
          ],
        }),
      );
    } else {
      const page = await loadComponent(index, component.value, abort.signal);
      if (!page) throw new Error('This component has no published example page.');
      if (scope.disposed || own !== revision) return;
      if (changeComponent) {
        cases = behaviorExamples(page);
        caseOwner = page.tag;
        example.replaceChildren(
          ...cases.map((item) => {
            const option = element('option', undefined, item.label);
            option.value = item.name;
            return option;
          }),
        );
        example.value = cases.some((item) => item.name === 'default')
          ? 'default'
          : cases[0]?.name || '';
      }
      const selected = cases.find((item) => item.name === example.value);
      if (!selected) throw new Error('This component has no supported authored example.');
      guidance.textContent =
        selected.guidance ||
        (selected.fixture
          ? 'Try the controls: this authored example includes its simulated app response.'
          : 'This example shows the supplied state; some actions report intent for an app to handle.');
      sourceLink.href = `/components/${page.tag}`;
      sourceLink.hidden = false;
      await queueMount(own, () =>
        preview.request('mount', behaviorPayload(page, selected, settings())),
      );
    }
    if (scope.disposed || own !== revision) return;
    await canvas?.settle(true);
    if (scope.disposed || own !== revision) return;
    if (!frameError)
      setStatus(
        'ready',
        'Ready. Change the space, interact with the example, or keep writing in the neighboring draft.',
      );
  }
  const run = (work: () => Promise<unknown>) => {
    const pending = work();
    const own = revision;
    void pending.catch((error: unknown) => {
      if (own === revision) failure(error);
    });
  };
  scope.listen(component, 'change', () => run(() => selectCase(true)));
  scope.listen(example, 'change', () => run(() => selectCase(false)));
  scope.listen(purpose, 'change', () => run(applyGrant));
  for (const select of [density, mode, direction])
    scope.listen(select, 'change', () => run(applyGrant));
  scope.listen(width, 'input', () => {
    widthValue.textContent = `${width.value} px requested`;
    preview.setViewport(Number(width.value), currentHeight);
  });
  // A responsive page reflow can move an editing iframe above the parent viewport.
  // Keep the active control in view on viewport changes, without changing its focus
  // or scrolling for background record updates or toolbar-driven setting changes.
  let visibilityFrame = 0;
  let visibilityTimer: ReturnType<typeof setTimeout> | undefined;
  const keepActiveWorkVisible = () => {
    cancelAnimationFrame(visibilityFrame);
    clearTimeout(visibilityTimer);
    if (scope.disposed || document.activeElement !== preview.iframe) return;
    const child = preview.iframe.contentDocument;
    let active: Element | null | undefined = child?.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (!active || active === child?.body || active === child?.documentElement) return;
    const local = active.getBoundingClientRect();
    if (!local.width || !local.height) return;
    const frameBox = preview.iframe.getBoundingClientRect();
    const inset = Math.max(
      16,
      (document.querySelector('header')?.getBoundingClientRect().bottom || 0) + 8,
    );
    const top = frameBox.top + local.top;
    const bottom = frameBox.top + local.bottom;
    const delta =
      top < inset ? top - inset : bottom > innerHeight - 16 ? bottom - innerHeight + 16 : 0;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
  };
  scope.listen(window, 'resize', () => {
    cancelAnimationFrame(visibilityFrame);
    clearTimeout(visibilityTimer);
    visibilityFrame = requestAnimationFrame(keepActiveWorkVisible);
    visibilityTimer = setTimeout(keepActiveWorkVisible, 120);
  });
  scope.add(() => {
    cancelAnimationFrame(visibilityFrame);
    clearTimeout(visibilityTimer);
  }, 'active-work visibility');
  scope.listen(reset, 'click', () =>
    run(async () => {
      const own = ++revision;
      setStatus('loading', 'Resetting the example…');
      await queueMount(own, () => preview.request('reset'));
      if (scope.disposed || own !== revision) return;
      await applyGrant();
      await canvas?.settle(true);
      if (scope.disposed || own !== revision) return;
      if (!frameError)
        setStatus(
          'ready',
          'Ready. The example has been reset; its parent settings and neighboring draft remain.',
        );
    }),
  );
  preview.setViewport(Number(width.value), currentHeight);
  run(async () => {
    const loaded = await Promise.all([loadIndex(abort.signal), preview.ready]);
    index = loaded[0];
    if (scope.disposed) return;
    canvas = preview.iframe.contentWindow?.oddkinBehaviorCanvas;
    if (!canvas) throw new Error('The responsiveness canvas did not initialize.');
    scope.add(canvas.subscribe(renderMetrics), 'canvas measurements');
    const entries = index.registry.pages
      .filter((item) => item.kind === 'component' && item.visible)
      .sort((a, b) => a.title.localeCompare(b.title));
    for (const entry of entries) {
      const tag = entry.id.replace(/^components\//, '');
      const option = element('option', undefined, `${entry.title} · ${tag}`);
      option.value = tag;
      component.append(option);
    }
    const group = element('optgroup');
    group.label = 'Components together';
    for (const [name, label] of SCENARIOS) {
      const option = element('option', undefined, label);
      option.value = `scenario:${name}`;
      group.append(option);
    }
    component.append(group);
    const query = new URLSearchParams(location.search).get('component');
    component.value = entries.some((item) => item.id === `components/${query}`)
      ? query!
      : entries.some((item) => item.id === 'components/odd-input')
        ? 'odd-input'
        : component.options[0]?.value || '';
    run(() => selectCase(true));
    updateSnippet();
  });
  return () => scope.dispose();
}
