import { describe, expect, it } from 'vitest';
import { flush, scopeStats } from '@oddkin/core';

// Migration acceptance for examples/core-counter (IMPLEMENTATION_PLAN.md M4, ADR 0036):
// the folder-structured elements keep their public behavior, binding paths, DOM identity,
// and ownership, and ordinary imports register nothing. Runs against the built output.

const settle = async (el: Element & { updateComplete?: Promise<void> }) => {
  await el.updateComplete;
  flush();
};

describe('core-counter after the component-folder migration', () => {
  it('ordinary barrels register nothing; define entries register explicitly', async () => {
    const barrel = await import('../../examples/core-counter/dist/index.js');
    expect(barrel.DemoCounter).toBeTypeOf('function');
    expect(barrel.demoCounterDefinition.name).toBe('demo-counter');
    expect(customElements.get('demo-counter')).toBeUndefined();
    expect(customElements.get('demo-greeting')).toBeUndefined();
    await import('../../examples/core-counter/dist/define.js');
    expect(customElements.get('demo-counter')).toBe(barrel.DemoCounter);
    expect(customElements.get('demo-greeting')).toBe(barrel.DemoGreeting);
  });

  it('demo-counter: a click writes only the bound output text and keeps DOM identity', async () => {
    const el = document.createElement('demo-counter');
    el.setAttribute('step', '2');
    el.setAttribute('label', 'Clicks');
    document.body.append(el);
    await settle(el);
    const root = el.shadowRoot!;
    const button = root.querySelector('button')!;
    const output = root.querySelector('output')!;
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Clicks: 0');

    const events: number[] = [];
    el.addEventListener('count-change', (e) =>
      events.push((e as CustomEvent<{ count: number }>).detail.count),
    );
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => writes.push(...records));
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });

    button.click();
    await settle(el);
    observer.takeRecords().forEach((r) => writes.push(r));
    expect(output.textContent).toBe('2');
    expect(el.count).toBe(2);
    expect(events).toEqual([2]);
    expect(el.matches(':state(positive)')).toBe(true);
    // Direct binding: every DOM write is inside <output>; nothing else re-rendered.
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every((r) => output.contains(r.target))).toBe(true);
    expect(root.querySelector('button')).toBe(button);
    expect(root.querySelector('output')).toBe(output);

    // A tracked property read re-runs the template but keeps the stable nodes.
    el.label = 'Taps';
    await settle(el);
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Taps: 2');
    expect(root.querySelector('output')).toBe(output);

    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    await settle(el);
    expect(output.textContent).toBe('0');
    observer.disconnect();
    el.remove();
  });

  it('demo-greeting: attributes in, properties, reflection out, property-only arrays', async () => {
    const el = document.createElement('demo-greeting');
    el.setAttribute('name', 'reader');
    el.setAttribute('tone', 'warm');
    document.body.append(el);
    await settle(el);
    const text = () => el.shadowRoot!.querySelector('p')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(text()).toBe('Lovely to see you, reader.');
    el.history = ['reader'];
    el.name = 'Ada';
    el.excited = true;
    await settle(el);
    expect(text()).toBe('Lovely to see you, Ada!');
    expect(el.getAttribute('excited')).toBe('');
    expect(el.hasAttribute('history')).toBe(false);
    expect(el.shadowRoot!.querySelector('small')!.textContent).toBe('Earlier: reader');
    expect(el.shadowRoot!.adoptedStyleSheets).toHaveLength(1);
    el.remove();
  });

  it('connection-owned work returns to baseline across reconnects', async () => {
    const before = scopeStats();
    const counter = document.createElement('demo-counter');
    const greeting = document.createElement('demo-greeting');
    for (let i = 0; i < 10; i++) {
      document.body.append(counter, greeting);
      await settle(counter);
      counter.remove();
      greeting.remove();
    }
    flush();
    expect(scopeStats()).toEqual(before);
  });
});
