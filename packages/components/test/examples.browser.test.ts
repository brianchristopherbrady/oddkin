import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { mountExample, type MountedExample } from '@oddkin/workbench/testing';
import '../src/button/button.define.js';
import '../src/card/card.define.js';
import '../src/input/input.define.js';
import '../src/side-nav/side-nav.define.js';
import button from '../src/button/button.examples.js';
import card from '../src/card/card.examples.js';
import input from '../src/input/input.examples.js';
import sideNav from '../src/side-nav/side-nav.examples.js';

const mounted: MountedExample<Element>[] = [];
afterEach(() => {
  for (const example of mounted.splice(0)) example.dispose();
  flush();
});

const settle = async (root: Element) => {
  flush();
  const elements = [...root.querySelectorAll<Element & { updateComplete?: Promise<void> }>('*')];
  await Promise.all(elements.map((el) => el.updateComplete));
  flush();
};

async function mount<E extends Element>(
  set: Parameters<typeof mountExample<E>>[0],
  name: string,
  container?: HTMLElement,
) {
  const example = await mountExample(set, name, container);
  mounted.push(example);
  await settle(example.root);
  return example;
}

// odd-button submits after the click's task, through a temporary native button.
const output = (root: Element) => expect.poll(() => root.querySelector('output')!.value);

describe('authored examples', () => {
  it('each example mounts with its properties, attributes, and slots, then releases everything', async () => {
    for (const set of [button, card, input, sideNav] as const) {
      for (const [name, example] of Object.entries(set.examples)) {
        const before = scopeStats();
        const { element, root, dispose } = await mountExample(set as never, name);
        await settle(root);
        const label = `${set.component}/${name}`;
        expect(element.isConnected, label).toBe(true);
        expect(element.shadowRoot?.childElementCount, label).toBeGreaterThan(0);
        for (const [key, value] of Object.entries(example.props ?? {}))
          expect((element as unknown as Record<string, unknown>)[key], `${label}.${key}`).toEqual(
            value,
          );
        for (const [attribute, value] of Object.entries(example.attributes ?? {}))
          expect(element.getAttribute(attribute), `${label}[${attribute}]`).toBe(value);
        for (const text of Object.values(example.slots ?? {}))
          expect(element.textContent, label).toContain(text);
        dispose();
        flush();
        expect(scopeStats(), label).toEqual(before);
      }
    }
  });

  it('button inForm submits its own name and value with the form', async () => {
    const { element, root } = await mount(button, 'inForm');
    await userEvent.click(element);
    await output(root).toBe('project=Atlas&intent=create');
  });

  it('input inForm blocks an empty submission, then submits the typed address', async () => {
    const { element, root } = await mount(input, 'inForm');
    const submit = root.querySelector('odd-button')!;
    await userEvent.click(submit);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(root.querySelector('output')!.value).toBe('');
    expect(element.validity.valueMissing).toBe(true);
    await userEvent.type(element.shadowRoot!.querySelector('input')!, 'ada@example.com');
    await userEvent.click(submit);
    await output(root).toBe('email=ada%40example.com');
  });

  it('input invalid shows its error through custom validity', async () => {
    const { element } = await mount(input, 'invalid');
    expect(element.validity.customError).toBe(true);
    expect(element.shadowRoot!.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
    expect(element.shadowRoot!.textContent).toContain('Enter an address like ada@example.com.');
  });

  it('card headed puts a heading in the header and an action in the footer', async () => {
    const { element } = await mount(card, 'headed');
    expect(element.querySelector('h3')!.slot).toBe('header');
    expect(element.querySelector('odd-button')!.slot).toBe('footer');
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!.hidden).toBe(false);
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="footer"]')!.hidden).toBe(false);
  });

  it('side-nav controlled lets the page own expansion through odd-toggle', async () => {
    const { element } = await mount(sideNav, 'controlled');
    const toggle = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await settle(element);
    expect(element.expanded).toEqual(['guides']);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('side-nav wide and declarative show the container layout and slotted links', async () => {
    // The test frame is narrower than 40rem; a preview at that width would stay one column.
    const frame = document.createElement('div');
    frame.style.inlineSize = '1000px';
    document.body.append(frame);
    const wide = await mount(sideNav, 'wide', frame);
    const content = wide.element.shadowRoot!.querySelector('.content')!;
    expect(getComputedStyle(content).gridTemplateColumns.split(' ')).toHaveLength(3);
    frame.remove();
    const declarative = await mount(sideNav, 'declarative');
    expect(declarative.element.querySelectorAll('a')).toHaveLength(3);
    expect(declarative.element.shadowRoot!.querySelector('slot:not([name])')).not.toBeNull();
  });
});
