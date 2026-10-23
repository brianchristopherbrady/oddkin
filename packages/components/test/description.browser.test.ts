import { afterEach, describe, expect, it } from 'vitest';
import { cdp, server } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import './register.js';
import { settle } from './probe.js';

// The internal hook another element (odd-tooltip) uses to describe a control whose focus target
// sits in its shadow root, where its own aria-describedby cannot reach (component-contracts.md §2.4).
type Describable = HTMLElement & {
  _describe(source: object, text: string | null): void;
  updateComplete: Promise<void>;
};

let container: HTMLElement;
afterEach(() => {
  container?.remove();
  flush();
});
function create(markup: string) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return document.importNode(template.content, true).firstElementChild as Describable;
}
async function mount(el: Describable) {
  container = document.createElement('div');
  container.append(el);
  document.body.append(container);
  await settle(el);
  return el;
}
/** The texts the inner control's aria-describedby lists, in order. */
const described = (el: Describable, selector: string) =>
  (el.shadowRoot!.querySelector(selector)!.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => el.shadowRoot!.getElementById(id)?.textContent?.trim() ?? `missing #${id}`);

const controls: Record<string, [string, string]> = {
  'odd-button': ['<odd-button>Save</odd-button>', 'button'],
  'odd-input': ['<odd-input label="Name"></odd-input>', 'input'],
  'odd-checkbox': ['<odd-checkbox>Updates</odd-checkbox>', 'input'],
  'odd-switch': ['<odd-switch>Alerts</odd-switch>', 'input'],
};

describe.each(Object.entries(controls))('%s', (_tag, [markup, selector]) => {
  it('describes its inner control with each source text, in order; null removes it', async () => {
    const el = await mount(create(markup));
    expect(described(el, selector)).toEqual([]);
    const [tooltip, other] = [{}, {}];
    el._describe(tooltip, 'Saves a draft');
    el._describe(other, 'Ctrl+S');
    await settle(el);
    expect(described(el, selector)).toEqual(['Saves a draft Ctrl+S']);
    el._describe(tooltip, 'Saves now');
    await settle(el);
    expect(described(el, selector)).toEqual(['Saves now Ctrl+S']);
    el._describe(tooltip, null);
    el._describe(other, '');
    await settle(el);
    expect(described(el, selector)).toEqual([]);
    expect(el.shadowRoot!.getElementById('external-description')!.hidden).toBe(true);
  });

  it('keeps a text given before the first render', async () => {
    const el = create(markup);
    el._describe({}, 'Given early');
    await mount(el);
    expect(described(el, selector)).toEqual(['Given early']);
  });
});

it('lists a form control’s own description and error first', async () => {
  const el = await mount(
    create('<odd-input label="Name" description="Help" error="Taken"></odd-input>'),
  );
  el._describe({}, 'Tooltip');
  await settle(el);
  expect(described(el, 'input')).toEqual(['Help', 'Taken', 'Tooltip']);
});

it.runIf(server.browser === 'chromium')(
  'the accessibility tree reports the description',
  async () => {
    const button = await mount(create('<odd-button>Save</odd-button>'));
    button._describe({}, 'Saves a draft');
    await settle(button);
    const session = cdp();
    await session.send('Accessibility.enable');
    try {
      // Tests run in a frame: search the tree of every frame.
      type Frame = { frame: { id: string }; childFrames?: Frame[] };
      const ids = (tree: Frame): string[] => [
        tree.frame.id,
        ...(tree.childFrames ?? []).flatMap((child) => ids(child)),
      ];
      const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: Frame };
      type Node = {
        role?: { value: string };
        name?: { value: string };
        description?: { value: string };
      };
      const nodes: Node[] = [];
      for (const frameId of ids(frameTree))
        nodes.push(
          ...((await session.send('Accessibility.getFullAXTree', { frameId })) as { nodes: Node[] })
            .nodes,
        );
      const node = nodes.find((n) => n.role?.value === 'button' && n.name?.value === 'Save');
      expect(node?.description?.value).toBe('Saves a draft');
    } finally {
      await session.send('Accessibility.disable');
    }
  },
);
