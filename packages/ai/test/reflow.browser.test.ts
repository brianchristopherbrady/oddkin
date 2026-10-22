import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@oddkin/core/reactive';

// Layout under narrowing containers: what a user gets when zooming in or rotating a device
// after the page has laid out (M8 reflow). Measured after the container shrinks, not at load.

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  container.style.inlineSize = '60rem';
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const frames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function shrink(el: HTMLElement & { updateComplete: Promise<void> }, selector: string) {
  container.append(el);
  await el.updateComplete;
  flush();
  await frames();
  container.style.inlineSize = '12rem';
  await frames();
  const part = el.shadowRoot!.querySelector<HTMLElement>(selector)!;
  return { part, limit: container.getBoundingClientRect().right + 0.5 };
}

const prompt =
  'Which audience should this long summary address, and which details should it keep for them?';

describe('legends follow a shrinking container', () => {
  it('odd-question', async () => {
    await import('../src/question/question.define.js');
    const el = document.createElement('odd-question');
    el.question = {
      questionId: 'q1',
      revision: 1,
      prompt,
      kind: 'choice',
      options: [{ id: 'a', label: 'Executives' }],
      status: 'requested',
    };
    const { part, limit } = await shrink(el, 'legend');
    expect(part.textContent?.trim()).toBe(prompt);
    expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(limit);
  });

  it('odd-response-feedback (negative rating with reasons)', async () => {
    await import('../src/response-feedback/response-feedback.define.js');
    const el = document.createElement('odd-response-feedback');
    el.messageId = 'm2';
    el.reasons = [prompt, 'Not helpful'];
    container.append(el);
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-rating="negative"]')!.click();
    await el.updateComplete;
    flush();
    const { part, limit } = await shrink(el, 'fieldset');
    expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(limit);
    expect(part.querySelector('legend')!.getBoundingClientRect().right).toBeLessThanOrEqual(limit);
  });
});
