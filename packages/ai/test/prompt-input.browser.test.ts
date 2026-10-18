import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { ComposerController } from '../src/controllers/composer.js';
import type { PromptSubmitDetail } from '../src/events.js';
import type { OddkinPromptInput } from '../src/prompt-input/prompt-input.js';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
};

async function mount(setup?: (el: OddkinPromptInput) => void) {
  await import('../src/prompt-input/prompt-input.define.js');
  const el = document.createElement('odd-prompt-input');
  setup?.(el);
  container.append(el);
  await settle(el);
  const area = el.shadowRoot!.querySelector('textarea')!;
  const submits: PromptSubmitDetail[] = [];
  el.addEventListener('prompt-submit', (e) =>
    submits.push((e as CustomEvent<PromptSubmitDetail>).detail),
  );
  return { el, area, submits };
}

const type = async (el: OddkinPromptInput, area: HTMLTextAreaElement, text: string) => {
  area.value = text;
  area.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  await settle(el);
};
const key = (area: HTMLTextAreaElement, init: KeyboardEventInit & { keyCode?: number }) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  if (init.keyCode !== undefined) Object.defineProperty(event, 'keyCode', { value: init.keyCode });
  area.dispatchEvent(event);
  return event;
};

describe('odd-prompt-input', () => {
  it('imports register nothing; the define entry registers the element and odd-button', async () => {
    const entry = await import('../src/prompt-input/index.js');
    expect(Object.keys(entry).sort()).toEqual([
      'OddkinPromptInput',
      'PROMPT_INPUT_STRINGS',
      'promptInputDefinition',
      'promptInputStyles',
      'promptInputTemplate',
    ]);
    await import('../src/prompt-input/prompt-input.define.js');
    expect(customElements.get('odd-prompt-input')).toBe(entry.OddkinPromptInput);
    expect(customElements.get('odd-button')).toBeDefined();
  });

  it('labels the text area and sends with Enter, not Shift+Enter', async () => {
    const { el, area, submits } = await mount();
    expect(el.shadowRoot!.querySelector(`label[for="${area.id}"]`)?.textContent).toBe('Message');
    await type(el, area, 'Hello');
    expect(key(area, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(submits).toHaveLength(0);
    expect(key(area, {}).defaultPrevented).toBe(true);
    expect(submits).toEqual([expect.objectContaining({ text: 'Hello', revision: 1 })]);
  });

  it('A01: composition keystrokes and the Enter that ends composition never submit', async () => {
    const { el, area, submits } = await mount();
    await type(el, area, 'にほん');
    area.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    key(area, { isComposing: true });
    key(area, {});
    area.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本' }));
    // Safari reports the confirming Enter after compositionend with keyCode 229.
    key(area, { keyCode: 229 });
    expect(submits).toHaveLength(0);
    key(area, {});
    expect(submits).toHaveLength(1);
  });

  it('newline mode sends with Ctrl/⌘+Enter only', async () => {
    const { el, area, submits } = await mount((e) => e.setAttribute('enter-behavior', 'newline'));
    await type(el, area, 'x');
    key(area, {});
    expect(submits).toHaveLength(0);
    key(area, { ctrlKey: true });
    expect(submits).toHaveLength(1);
  });

  it('A02: a failure keeps the draft; acknowledging an older submission keeps newer edits', async () => {
    const { el, area, submits } = await mount();
    await type(el, area, 'first');
    key(area, {});
    const first = submits[0]!;
    await settle(el);
    expect(el.shadowRoot!.querySelector('[part="status"]')?.textContent?.trim()).toBe('Sending…');
    el.fail(first.submissionId, { code: 'net', message: 'Network error.' });
    await settle(el);
    expect(area.value).toBe('first');
    expect(el.shadowRoot!.querySelector('[part="status"]')?.textContent).toContain(
      'Network error.',
    );
    expect(area.getAttribute('aria-invalid')).toBe('true');
    key(area, {});
    const second = submits[1]!;
    await type(el, area, 'first and a follow-up');
    expect(el.acknowledge(second.submissionId)).toBe(true);
    await settle(el);
    expect(area.value).toBe('first and a follow-up');
    key(area, {});
    el.acknowledge(submits[2]!.submissionId);
    await settle(el);
    expect(area.value).toBe('');
  });

  it('a cancelled submit event vetoes locally; programmatic value never dispatches events', async () => {
    const { el, area, submits } = await mount();
    const seen: string[] = [];
    for (const type of ['prompt-submit', 'input', 'change', 'attachment-add'])
      el.addEventListener(type, () => seen.push(type));
    el.value = 'set by host';
    await settle(el);
    expect(area.value).toBe('set by host');
    expect(seen).toEqual([]);
    el.addEventListener('prompt-submit', (e) => e.preventDefault(), { once: true });
    key(area, {});
    await settle(el);
    expect(submits).toHaveLength(1);
    expect(el.activeController.getSnapshot().submission).toBeUndefined();
    expect(area.value).toBe('set by host');
  });

  it('validates attachments and shows localized issues; pasted files attach', async () => {
    const { el, area } = await mount((e) => {
      e.accept = 'image/*';
      e.maxFileSize = 4;
      e.strings = { 'ai.attachment.type': '{name}: type refusé' };
    });
    const data = new DataTransfer();
    data.items.add(new File(['abc'], 'pic.png', { type: 'image/png' }));
    data.items.add(new File(['abc'], 'doc.txt', { type: 'text/plain' }));
    data.items.add(new File(['abcdef'], 'big.png', { type: 'image/png' }));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
    input.files = data.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(el);
    const names = () =>
      [...el.shadowRoot!.querySelectorAll('.attachment .name')].map((n) => n.textContent);
    expect(names()).toEqual(['pic.png']);
    const issues = [...el.shadowRoot!.querySelectorAll('#issues li')].map((n) => n.textContent);
    expect(issues).toEqual(['doc.txt: type refusé', 'big.png is larger than 4 B.']);
    expect(area.getAttribute('aria-describedby')).toContain('issues');
    // Paste uses the same path; engines that drop clipboardData from synthetic events are skipped.
    const pasted = new DataTransfer();
    pasted.items.add(new File(['z'], 'shot.png', { type: 'image/png' }));
    const event = new ClipboardEvent('paste', {
      clipboardData: pasted,
      bubbles: true,
      cancelable: true,
    });
    if (event.clipboardData?.files.length) {
      area.dispatchEvent(event);
      await settle(el);
      expect(names()).toEqual(['pic.png', 'shot.png']);
    }
  });

  it('A18: owned preview URLs are released on disconnect and restored on reconnect; no leaked listeners', async () => {
    const { el } = await mount();
    el.activeController.addFiles([new File(['x'], 'a.png', { type: 'image/png' })]);
    await settle(el);
    expect(el.activeController.ownedUrlCount).toBe(1);
    const baseline = { ...scopeStats() };
    for (let i = 0; i < 10; i++) {
      el.remove();
      flush();
      expect(el.activeController.ownedUrlCount).toBe(0);
      container.append(el);
      await settle(el);
      expect(el.activeController.ownedUrlCount).toBe(1);
    }
    expect(scopeStats()).toEqual(baseline);
    expect(el.shadowRoot!.querySelector<HTMLImageElement>('.thumb')?.src).toMatch(/^blob:/);
  });

  it('a host-owned controller keeps the draft across elements and shows Stop while busy', async () => {
    const controller = new ComposerController();
    controller.setText('shared draft');
    const { el } = await mount((e) => {
      e.controller = controller;
      e.capabilities = { send: { available: true }, stop: { available: true } };
      e.busy = true;
      e.attemptId = 'attempt-1';
    });
    expect(el.shadowRoot!.querySelector('textarea')!.value).toBe('shared draft');
    const stops: unknown[] = [];
    el.addEventListener('prompt-stop', (e) => stops.push((e as CustomEvent).detail));
    (el.shadowRoot!.querySelector('odd-button.stop') as HTMLElement).click();
    expect(stops).toEqual([{ attemptId: 'attempt-1' }]);
    el.capabilities = { send: { available: false, reason: 'Sending is paused.' } };
    el.busy = false;
    await settle(el);
    el.submit();
    await settle(el);
    expect(el.shadowRoot!.querySelector('[part="status"]')?.textContent?.trim()).toBe(
      'Sending is paused.',
    );
  });
});
