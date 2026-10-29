// An example module as Workbench serves it to preview frames: a `defineExamples`-shaped default
// export whose fixture the frame runs, and the template renderer its `mount(content)` uses.
import { html } from '@oddkin/core/template';

export { render as oddkinFrameRender } from '@oddkin/core/template';

interface Context {
  readonly element: HTMLElement;
  mount(content: unknown): Element;
}

export default {
  component: 'fixture-button',
  examples: {
    staged: {
      label: 'Staged',
      fixture({ element, mount }: Context) {
        element.setAttribute('data-fixture', element.isConnected ? 'connected' : 'detached');
        const node = element.ownerDocument.createElement('span');
        node.textContent = 'Mounted node';
        mount(node);
        mount(html`<b>Mounted template</b>`);
      },
    },
    broken: {
      label: 'Broken setup',
      fixture() {
        throw new Error('Setup failed');
      },
    },
  },
};
