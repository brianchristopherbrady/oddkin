import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { mountExample } from '@oddkin/workbench/testing';
import { createScriptedVoiceAdapter } from '../src/controllers/voice.js';
import { DocumentSession } from '../src/controllers/document.js';
import { highlight } from '../src/highlight/index.js';
import type { ApprovalRecord, CheckpointRecord, ToolCallRecord } from '../src/contracts/types.js';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });
const settle = async (el: { updateComplete: Promise<void> }) => {
  await el.updateComplete;
  flush();
  await frames(1);
  await el.updateComplete;
  flush();
};

async function mount<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  define: () => Promise<unknown>,
  setup: (el: HTMLElementTagNameMap[K]) => void,
) {
  await define();
  const el = document.createElement(tag);
  setup(el);
  container.append(el);
  await settle(el as unknown as { updateComplete: Promise<void> });
  return el;
}
const $ = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector);
const $$ = (el: Element, selector: string) => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];
const text = (el: Element | null | undefined) =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('registration', () => {
  // The first test of the file pays for transforming the package's modules; allow for that
  // while three browser projects run in parallel.
  it(
    'ordinary entries register nothing; define entries register their element and dependencies',
    { timeout: 60_000 },
    async () => {
      const before = customElements.get('odd-tool-call');
      await import('../src/tool-call/index.js');
      await import('../src/markdown/index.js');
      await import('../src/controllers/index.js');
      expect(customElements.get('odd-tool-call')).toBe(before);
      await import('../src/tool-call/tool-call.define.js');
      expect(customElements.get('odd-tool-call')).toBeDefined();
      expect(customElements.get('odd-action-approval')).toBeDefined();
    },
  );
});

describe('odd-response', () => {
  const define = () => import('../src/response/response.define.js');

  it('A13: renders streamed Markdown split at awkward points; copy uses the canonical source', async () => {
    const el = await mount('odd-response', define, (e) => {
      e.status = 'streaming';
      e.copyable = true;
    });
    const source =
      'Intro with **bold** and a [link](https://example.com).\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |';
    for (let i = 1; i <= source.length; i += 7) {
      el.text = source.slice(0, i);
      await settle(el);
    }
    el.text = source;
    el.status = 'complete';
    await settle(el);
    const content = $(el, '[part="content"]')!;
    expect(content.querySelector('strong')?.textContent).toBe('bold');
    expect(content.querySelector('a')?.getAttribute('href')).toBe('https://example.com/');
    expect(content.querySelector('code')?.textContent).toBe('const a = 1;\nconst b = 2;');
    expect(content.querySelectorAll('td')).toHaveLength(2);
    const written: string[] = [];
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(async (t) => void written.push(t));
    try {
      await el.copy();
      expect(written).toEqual([source]);
    } finally {
      clipboard.mockRestore();
    }
  });

  it('A14: adversarial content stays inert through Markdown, URLs, highlighting, and updates', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.message);
    window.addEventListener('error', onError);
    (window as unknown as { __pwned?: boolean }).__pwned = false;
    const el = await mount('odd-response', define, (e) => {
      e.status = 'streaming';
      e.markdown = { highlight };
    });
    const payload = [
      '<img src=x onerror="window.__pwned=true">',
      '',
      '[click](javascript:window.__pwned=true) [data](data:text/html,<script>window.__pwned=true</script>) [ok](https://ok.example)',
      '',
      '![img](https://tracker.example/pixel.gif)',
      '',
      '```html',
      '<script>window.__pwned=true</script>',
      '```',
      '',
      '<svg onload="window.__pwned=true"></svg>',
    ].join('\n');
    for (let i = 1; i <= payload.length; i += 5) {
      el.text = payload.slice(0, i);
      await settle(el);
    }
    el.status = 'complete';
    await settle(el);
    const content = $(el, '[part="content"]')!;
    expect(content.querySelectorAll('script, img, svg, iframe')).toHaveLength(0);
    expect([...content.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://ok.example/',
      'https://tracker.example/pixel.gif',
    ]);
    expect(content.querySelector('.image-link')?.getAttribute('rel')).toContain('noreferrer');
    expect(content.querySelectorAll('.unsafe-link')).toHaveLength(2);
    expect(content.querySelector('code')?.textContent).toBe('<script>window.__pwned=true</script>');
    expect(
      [...content.querySelectorAll('*')].some((n) =>
        [...n.attributes].some((a) => a.name.startsWith('on')),
      ),
    ).toBe(false);
    await frames(2);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBe(false);
    window.removeEventListener('error', onError);
  });

  it('A15: unresolved citations say so instead of inventing a source', async () => {
    const el = await mount('odd-response', define, (e) => {
      e.text = 'Claim [^known] and [^missing].';
      e.sources = [
        {
          type: 'source',
          id: 's',
          sourceId: 'known',
          title: 'Known source',
          url: 'https://k.example',
        },
      ];
    });
    const citations = [...$(el, '[part="content"]')!.querySelectorAll('odd-citation')];
    await settle(citations[1] as unknown as { updateComplete: Promise<void> });
    const triggers = citations.map((c) => c.shadowRoot!.querySelector('button')!);
    expect(triggers.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Source 1: Known source',
      'Unresolved source reference missing',
    ]);
    triggers[1]!.click();
    await settle(citations[1] as unknown as { updateComplete: Promise<void> });
    expect(triggers[1]!.getAttribute('aria-expanded')).toBe('true');
    expect(text(citations[1]!.shadowRoot!.querySelector('[part="preview"]'))).toContain(
      'not available',
    );
    triggers[1]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
    );
    await settle(citations[1] as unknown as { updateComplete: Promise<void> });
    expect(triggers[1]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows interruption and failure without losing partial output', async () => {
    const el = await mount('odd-response', define, (e) => {
      e.text = 'Partial answer';
      e.status = 'interrupted';
    });
    expect(text($(el, '[part="status"]'))).toContain('may be incomplete');
    el.status = 'failed';
    el.error = { code: 'x', message: 'Model overloaded.' };
    await settle(el);
    expect(text($(el, '[part="status"]'))).toBe('Model overloaded.');
    expect(text($(el, '[part="content"]'))).toBe('Partial answer');
  });
});

describe('odd-tool-call and odd-action-approval', () => {
  const tool = (
    status: ToolCallRecord['status'],
    extra: Partial<ToolCallRecord> = {},
  ): ToolCallRecord => ({
    toolCallId: 't1',
    toolName: 'search',
    title: 'Web search',
    status,
    ...extra,
  });

  it('A08: finished arguments read as "not run yet", never as success; failure offers retry', async () => {
    const el = await mount(
      'odd-tool-call',
      () => import('../src/tool-call/tool-call.define.js'),
      (e) => {
        e.tool = tool('input-streaming', { inputText: '{"q":"wea' });
      },
    );
    expect(text($(el, '.status'))).toBe('Preparing arguments…');
    el.tool = tool('input-available', { input: { q: 'weather' } });
    await settle(el);
    expect(text($(el, '.status'))).toBe('Arguments ready; not run yet');
    expect($(el, '[part="arguments"] pre')?.textContent).toContain('"q": "weather"');
    el.tool = tool('output-error', { error: { code: 'e', message: 'Timeout' }, retryable: true });
    await settle(el);
    const retries: unknown[] = [];
    el.addEventListener('odd-tool-retry', (e) => retries.push((e as CustomEvent).detail));
    $(el, '.failure button')!.click();
    expect(retries).toEqual([{ toolCallId: 't1' }]);
  });

  it('status labels take their colours from the shared tone styles', async () => {
    const theme = document.createElement('link');
    theme.rel = 'stylesheet';
    theme.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
    await new Promise((resolve, reject) => {
      theme.onload = resolve;
      theme.onerror = reject;
      document.head.append(theme);
    });
    try {
      const el = await mount(
        'odd-tool-call',
        () => import('../src/tool-call/tool-call.define.js'),
        (e) => {
          e.tool = tool('input-available');
        },
      );
      const probe = container.appendChild(document.createElement('span'));
      const resolved = (property: string, value: string) => {
        probe.style.setProperty(property, value);
        return getComputedStyle(probe).getPropertyValue(property);
      };
      const look = async (status: ToolCallRecord['status']) => {
        el.tool = tool(status);
        await settle(el);
        const style = getComputedStyle($(el, '.status')!);
        return [style.color, style.backgroundColor, style.borderTopColor];
      };
      const colours = (foreground: string, surface: string, border: string) => [
        resolved('color', `var(--odd-color-${foreground})`),
        resolved(
          'background-color',
          surface === 'none' ? 'transparent' : `var(--odd-color-${surface})`,
        ),
        resolved('border-top-color', `var(--odd-color-${border})`),
      ];
      // Neutral (no tone), success and danger (filled, with a currentColor border), and active.
      expect(await look('input-available')).toEqual(
        colours('text-secondary', 'none', 'border-default'),
      );
      expect(await look('output-available')).toEqual(
        colours('success-foreground', 'success-surface', 'success-foreground'),
      );
      expect(await look('output-error')).toEqual(
        colours('danger-foreground', 'danger-surface', 'danger-foreground'),
      );
      expect(await look('executing')).toEqual(colours('text-primary', 'none', 'border-strong'));
      expect(
        new Set([await look('input-available'), await look('output-available')].map(String)).size,
      ).toBe(2);
    } finally {
      theme.remove();
    }
  });

  it('A10: a decision is requested once, stays pending until the record changes, and a new revision resets it', async () => {
    const approval = (status: ApprovalRecord['status'], revision = 1): ApprovalRecord => ({
      approvalId: 'ap',
      revision,
      title: 'Send email',
      target: 'team@example.com',
      changes: [{ label: 'Subject', before: 'Draft', after: 'Final' }],
      status,
    });
    const el = await mount(
      'odd-action-approval',
      () => import('../src/action-approval/action-approval.define.js'),
      (e) => {
        e.approval = approval('requested');
        e.capabilities = { respondToApproval: { available: true } };
      },
    );
    const decisions: unknown[] = [];
    el.addEventListener('odd-approval-decide', (e) => decisions.push((e as CustomEvent).detail));
    const approve = () => $(el, 'odd-button[appearance="primary"]')!;
    approve().click();
    approve().click();
    await settle(el);
    expect(decisions).toHaveLength(1);
    expect(text($(el, '.state'))).toBe('Submitting your decision…');
    expect(approve().hasAttribute('loading')).toBe(true);
    expect(text($(el, '[part="changes"]'))).toContain('Before: Draft');
    el.approval = approval('requested', 2);
    await settle(el);
    expect(approve().hasAttribute('loading')).toBe(false);
    approve().click();
    expect(decisions).toEqual([
      expect.objectContaining({ revision: 1 }),
      expect.objectContaining({ revision: 2, decision: 'approve' }),
    ]);
    el.approval = approval('approved', 2);
    await settle(el);
    expect($(el, '[part="actions"]')!.hidden).toBe(true);
    expect(text($(el, '.state'))).toContain('runs separately');
    el.capabilities = {};
    el.approval = approval('requested', 3);
    await settle(el);
    expect(approve().hasAttribute('disabled')).toBe(true);
    expect(text(el.shadowRoot!.querySelector('[part="actions"] + .muted'))).toBe(
      'Decisions are not available here.',
    );
  });

  it('their examples play the host: Retry runs the call again; each decision is recorded', async () => {
    await import('../src/tool-call/tool-call.define.js');
    await import('../src/action-approval/action-approval.define.js');
    const { default: tools } = await import('../src/tool-call/tool-call.examples.js');
    const failed = await mountExample(tools, 'failed', container);
    try {
      const el = failed.element;
      expect(text($(el, '.status'))).toBe('Failed');
      $(el, '.failure button')!.click();
      await settle(el);
      expect(text($(el, '.status'))).toBe('Finished');
      expect($(el, '[part="result"] pre')?.textContent).toContain('"results": 3');
      expect($(el, '.failure')).toBeNull();
    } finally {
      failed.dispose();
    }
    const { default: approvals } =
      await import('../src/action-approval/action-approval.examples.js');
    const approved = await mountExample(approvals, 'default', container);
    try {
      const el = approved.element;
      $(el, 'odd-button[appearance="primary"]')!.click();
      await settle(el);
      expect(el.approval).toMatchObject({ status: 'approved', decision: 'approve' });
      expect(text($(el, '.state'))).toBe(
        'Approved. The action runs separately; its result appears with the action.',
      );
      expect($(el, '[part="actions"]')!.hidden).toBe(true);
    } finally {
      approved.dispose();
    }
    const rejected = await mountExample(approvals, 'default', container);
    try {
      const el = rejected.element;
      const reason = $(el, '.reason textarea') as HTMLTextAreaElement;
      reason.value = 'Not before Friday.';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
      $$(el, '[part="actions"] odd-button')[1]!.click();
      await settle(el);
      expect(el.approval).toMatchObject({
        status: 'rejected',
        decision: 'reject',
        reason: 'Not before Friday.',
      });
      expect(text($(el, '.state'))).toBe('Rejected. The action will not run.');
    } finally {
      rejected.dispose();
    }
  });
});

describe('odd-checkpoint', () => {
  it('A20: shows restoration success only after the record says restored', async () => {
    const record = (
      status: CheckpointRecord['status'],
      extra: Partial<CheckpointRecord> = {},
    ): CheckpointRecord => ({
      checkpointId: 'cp',
      label: 'Before refactor',
      description: 'Files and plan as of step 3.',
      restores: ['src/ (12 files)', 'Plan steps 4–7'],
      status,
      ...extra,
    });
    const el = await mount(
      'odd-checkpoint',
      () => import('../src/checkpoint/checkpoint.define.js'),
      (e) => {
        e.checkpoint = record('available');
        e.capabilities = { restoreCheckpoint: { available: true } };
      },
    );
    const requests: unknown[] = [];
    el.addEventListener('odd-checkpoint-restore', (e) => requests.push((e as CustomEvent).detail));
    $(el, '[part="actions"] odd-button')!.click();
    await settle(el);
    expect(text($(el, '.confirm'))).toContain('Restore to “Before refactor”?');
    $(el, '[data-confirm]')!.click();
    await settle(el);
    expect(requests).toEqual([{ checkpointId: 'cp' }]);
    expect(text($(el, '.state'))).toBe('Restoring… Not restored yet.');
    el.checkpoint = record('restore-failed', {
      error: { code: 'x', message: 'Conflict in src/a.ts' },
    });
    await settle(el);
    expect(text($(el, '.state'))).toBe('Restore failed: Conflict in src/a.ts');
    el.checkpoint = record('restored', { outcome: 'Workspace matches step 3.' });
    await settle(el);
    expect(text($(el, '.state'))).toBe('Restored. Workspace matches step 3.');
  });

  it('its default example plays the host: a confirmed restore comes back restored', async () => {
    await import('../src/checkpoint/checkpoint.define.js');
    const { default: set } = await import('../src/checkpoint/checkpoint.examples.js');
    const mounted = await mountExample(set, 'default', container);
    try {
      const el = mounted.element;
      $(el, '[part="actions"] odd-button')!.click();
      await settle(el);
      $(el, '[data-confirm]')!.click();
      await settle(el);
      expect(el.checkpoint?.status).toBe('restored');
      expect(text($(el, '.state'))).toBe('Restored. Restored the document to 09:30.');
    } finally {
      mounted.dispose();
    }
  });
});

describe('selection, review, and controls', () => {
  it('odd-model-select: user change is cancelable; programmatic value is silent', async () => {
    const el = await mount(
      'odd-model-select',
      () => import('../src/model-select/model-select.define.js'),
      (e) => {
        e.models = [
          { id: 'fast', label: 'Fast', available: true, capabilities: ['text'] },
          { id: 'deep', label: 'Deep', available: true, capabilities: ['text', 'tools'] },
          { id: 'vision', label: 'Vision', available: false, reason: 'Not in your plan' },
        ];
        e.value = 'fast';
      },
    );
    const changes: unknown[] = [];
    el.addEventListener('odd-model-change', (e) => changes.push((e as CustomEvent).detail));
    el.value = 'deep';
    await settle(el);
    expect(changes).toEqual([]);
    const select = $(el, 'select') as HTMLSelectElement;
    expect(select.value).toBe('deep');
    expect([...select.options].map((o) => [o.textContent?.trim(), o.disabled])).toEqual([
      ['Fast', false],
      ['Deep', false],
      ['Vision (unavailable)', true],
    ]);
    el.addEventListener('odd-model-change', (e) => e.preventDefault(), { once: true });
    select.value = 'fast';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(select.value).toBe('deep');
    expect(el.value).toBe('deep');
    select.value = 'fast';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.value).toBe('fast');
    expect(changes).toEqual([
      { modelId: 'fast', previousModelId: 'deep' },
      { modelId: 'fast', previousModelId: 'deep' },
    ]);
  });

  it('odd-suggestions: insert and send are distinct intents', async () => {
    const el = await mount(
      'odd-suggestions',
      () => import('../src/suggestions/suggestions.define.js'),
      (e) => {
        e.suggestions = [{ id: 's1', label: 'Compare prices', prompt: 'Compare the prices' }];
      },
    );
    const events: string[] = [];
    el.addEventListener('odd-suggestion-select', () => events.push('select'));
    el.addEventListener('odd-suggestion-submit', () => events.push('submit'));
    $(el, '[part="suggestion"]')!.click();
    $(el, '[part="send"]')!.click();
    expect(events).toEqual(['select', 'submit']);
    expect($(el, '[part="send"]')!.getAttribute('aria-label')).toBe('Send: Compare prices');
    el.disabled = true;
    await settle(el);
    expect(($(el, '[part="suggestion"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('A15: odd-usage-meter shows measured, estimated, and unknown values as supplied', async () => {
    const el = await mount(
      'odd-usage-meter',
      () => import('../src/usage-meter/usage-meter.define.js'),
      (e) => {
        e.usage = [
          {
            kind: 'context',
            label: 'Context',
            used: 6000,
            limit: 8000,
            unit: 'tokens',
            precision: 'measured',
          },
          { kind: 'cost', label: 'Cost', used: 0.0123, currency: 'USD', precision: 'estimated' },
          { kind: 'quota', label: 'Quota', precision: 'unknown' },
        ];
      },
    );
    expect($$(el, '.value').map(text)).toEqual([
      '6,000 tokens of 8,000 tokens (measured)',
      '$0.0123 (estimated)',
      'Unknown',
    ]);
    expect($$(el, 'meter')).toHaveLength(1);
  });

  it('A17: odd-change-review applies to the intended revision only and marks stale proposals', async () => {
    const doc = new DocumentSession('The quick fox.');
    const el = await mount(
      'odd-change-review',
      () => import('../src/change-review/change-review.define.js'),
      (e) => {
        e.proposals = [...doc.getSnapshot().proposals];
      },
    );
    const sync = async () => {
      el.proposals = [...doc.getSnapshot().proposals];
      await settle(el);
    };
    el.addEventListener('odd-change-accept', (e) =>
      doc.accept((e as CustomEvent).detail.proposalId),
    );
    el.addEventListener('odd-change-undo', (e) => doc.undo((e as CustomEvent).detail.proposalId));
    const base = doc.getSnapshot().revision;
    doc.propose({
      proposalId: 'a',
      baseRevision: base,
      range: { start: 4, end: 9 },
      original: 'quick',
      replacement: 'swift',
      label: 'Word choice',
    });
    doc.propose({
      proposalId: 'b',
      baseRevision: base,
      range: { start: 10, end: 13 },
      original: 'fox',
      replacement: 'hare',
    });
    await sync();
    expect(text($(el, 'del'))).toBe('[deleted: quick]');
    expect(text($(el, 'ins'))).toBe('[inserted: swift]');
    // Each proposal is a group named by its label, or by the start of its new text.
    expect(
      $$(el, '.proposal > [role="group"]').map((group) => group.getAttribute('aria-label')),
    ).toEqual(['Word choice', 'hare']);
    ($(el, 'odd-button[data-action="accept"]') as HTMLElement).click();
    await sync();
    expect(doc.getSnapshot().text).toBe('The swift fox.');
    expect($$(el, '.state').map(text)).toEqual(['Applied', expect.stringContaining('Out of date')]);
    ($(el, 'odd-button[data-action="undo"]') as HTMLElement).click();
    await sync();
    expect(doc.getSnapshot().text).toBe('The quick fox.');
    expect($$(el, '.state').map(text)[0]).toBe('Undone');
    // Without a label, the name stops short of 60 rather than split a surrogate pair.
    el.proposals = [
      {
        proposalId: 'c',
        baseRevision: base,
        range: { start: 10, end: 13 },
        original: 'fox',
        replacement: `${'a'.repeat(59)}\u{1F98A} and more`,
        status: 'proposed',
      },
    ];
    await settle(el);
    expect($(el, '.proposal > [role="group"]')!.getAttribute('aria-label')).toBe('a'.repeat(59));
  });

  it('odd-change-review: a rewrite reads whole between its context; Dismiss when out of date, Undo only where the host can undo', async () => {
    const doc = new DocumentSession('The build is very slow. Contact the team.');
    const el = await mount(
      'odd-change-review',
      () => import('../src/change-review/change-review.define.js'),
      () => {},
    );
    const sync = async () => {
      el.proposals = [...doc.getSnapshot().proposals];
      await settle(el);
    };
    const requests: string[] = [];
    const id = (e: Event) => (e as CustomEvent<{ proposalId: string }>).detail.proposalId;
    el.addEventListener('odd-change-accept', (e) => {
      requests.push(`accept ${id(e)}`);
      doc.accept(id(e));
    });
    el.addEventListener('odd-change-reject', (e) => {
      requests.push(`reject ${id(e)}`);
      doc.reject(id(e));
    });
    const base = doc.getSnapshot().revision;
    doc.propose({
      proposalId: 'rewrite',
      baseRevision: base,
      range: { start: 0, end: 23 },
      original: 'The build is very slow.',
      replacement: 'Builds take 40% less time.',
      label: 'Make it specific',
    });
    doc.propose({
      proposalId: 'who',
      baseRevision: base,
      range: { start: 24, end: 41 },
      original: 'Contact the team.',
      replacement: 'Write to the release team.',
    });
    await sync();
    const item = (i: number) => $$(el, '.proposal')[i]!;
    const actions = (li: Element) =>
      [...li.querySelectorAll('[part="actions"] odd-button')].map(text);
    // One deletion, then one insertion, not word by word; the text around them muted.
    expect([...item(0).querySelectorAll('del, ins')].map(text)).toEqual([
      '[deleted: The build is very slow.]',
      '[inserted: Builds take 40% less time.]',
    ]);
    expect(text(item(0).querySelector('[part="diff"]'))).toBe(
      '[deleted: The build is very slow.][inserted: Builds take 40% less time.] Contact the team.',
    );
    expect([...item(1).querySelectorAll('.context')].map(text)).toEqual([
      'The build is very slow.',
      '',
    ]);
    // Changes that an unchanged word separates stay apart.
    expect([...item(1).querySelectorAll('del, ins')].map(text)).toEqual([
      '[deleted: Contact ]',
      '[inserted: Write to ]',
      '[inserted: release]',
    ]);
    // Awaiting review: no status text. The label, status, and actions are parts.
    expect(text(item(0).querySelector('[part="label"]'))).toBe('Make it specific');
    expect((item(0).querySelector('[part="status"]') as HTMLElement).hidden).toBe(true);
    expect(actions(item(0))).toEqual(['Accept', 'Reject']);
    (item(0).querySelector('[data-action="accept"]') as HTMLElement).click();
    await sync();
    expect(doc.getSnapshot().text).toBe('Builds take 40% less time. Contact the team.');
    expect(actions(item(0))).toEqual(['Undo']);
    // The other proposal was made for the earlier text: out of date, so Dismiss.
    expect(text(item(1).querySelector('[part="status"]'))).toContain('Out of date');
    expect(actions(item(1))).toEqual(['Dismiss']);
    (item(1).querySelector('[data-action="reject"]') as HTMLElement).click();
    await sync();
    expect(text(item(1).querySelector('[part="status"]'))).toBe('Rejected');
    expect(item(1).querySelector('[part="actions"]')).toBeNull();
    // After a user edit the session can no longer undo the change, so no Undo.
    doc.setText(`${doc.getSnapshot().text} Soon.`);
    await sync();
    expect(doc.getSnapshot().proposals[0]).toMatchObject({ status: 'applied', undoable: false });
    expect(text(item(0).querySelector('[part="status"]'))).toBe('Applied');
    expect(item(0).querySelector('[part="actions"]')).toBeNull();
    expect(requests).toEqual(['accept rewrite', 'reject who']);
  });

  it("odd-change-review: its default example plays the host, so the reader sees each request's outcome", async () => {
    await import('../src/change-review/change-review.define.js');
    await import('@oddkin/components/define/textarea');
    const { default: set } = await import('../src/change-review/change-review.examples.js');
    const before = 'The build is very slow, so every release waits a day.';
    const mounted = await mountExample(set, 'default', container);
    try {
      const el = mounted.element;
      const field = mounted.root.querySelector('odd-textarea')!;
      const act = async (action: string) => {
        $(el, `odd-button[data-action="${action}"]`)!.click();
        await settle(el);
      };
      expect(field.value).toBe(before);
      await act('accept');
      expect(field.value).toBe('The build is slow (12 minutes), so every release waits a day.');
      expect($$(el, '.state').map(text)).toEqual(['Applied']);
      await act('undo');
      expect(field.value).toBe(before);
      expect($$(el, '.state').map(text)).toEqual(['Undone']);
    } finally {
      mounted.dispose();
    }
    // An edit to the text puts a pending proposal out of date, and Reject removes it.
    const again = await mountExample(set, 'default', container);
    try {
      const el = again.element;
      const field = again.root.querySelector('odd-textarea')!;
      field.value = `${before} Soon.`;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(el);
      expect($$(el, '.state').map(text)).toEqual([expect.stringContaining('Out of date')]);
      $(el, 'odd-button[data-action="reject"]')!.click();
      await settle(el);
      expect($$(el, '.state').map(text)).toEqual(['Rejected']);
    } finally {
      again.dispose();
    }
  });

  it('C1 examples play the host: a voice transcript, an assist answer, a source, context items', async () => {
    await import('../src/voice-input/voice-input.define.js');
    await import('../src/inline-assist/inline-assist.define.js');
    await import('../src/citation/citation.define.js');
    await import('../src/sources/sources.define.js');
    await import('../src/context-picker/context-picker.define.js');
    await import('@oddkin/components/define/textarea');
    const until = async (check: () => boolean, what: string) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 25));
      expect(check(), what).toBe(true);
    };
    const button = (el: Element, label: string) =>
      $$(el, 'button').find((b) => text(b) === label && !b.hidden)!;

    // Voice input: start, hear the script, stop, use it; the host's field takes the text.
    const voiceSet = (await import('../src/voice-input/voice-input.examples.js')).default;
    const voice = await mountExample(voiceSet, 'default', container);
    try {
      const el = voice.element;
      const field = voice.root.querySelector('odd-textarea')!;
      const transcript = $(el, 'odd-transcript') as HTMLElement & {
        segments: readonly { text: string }[];
      };
      $(el, 'button.record')!.click();
      await until(
        () => transcript.segments.some((s) => s.text.includes('release notes')),
        'the scripted speech',
      );
      $(el, 'button.record')!.click();
      await until(() => Boolean(button(el, 'Use transcript')), 'Use transcript');
      button(el, 'Use transcript').click();
      await settle(el);
      expect(field.value).toBe('Summarize the release notes.');
    } finally {
      voice.dispose();
    }

    // Inline assist: Explain is pending, then the host's answer shows.
    const assistSet = (await import('../src/inline-assist/inline-assist.examples.js')).default;
    const assist = await mountExample(assistSet, 'default', container);
    try {
      const el = assist.element;
      $(el, '[data-action="explain"]')!.click();
      await settle(el);
      expect(el.status).toBe('pending');
      await until(() => el.status === 'complete', 'the answer');
      await settle(el);
      expect(el.shadowRoot!.textContent).toContain('turns sources into the files that ship');
    } finally {
      assist.dispose();
    }

    // Citation: Show in sources reveals the source in the host's list.
    const citationSet = (await import('../src/citation/citation.examples.js')).default;
    const citation = await mountExample(citationSet, 'default', container);
    try {
      const el = citation.element;
      const list = citation.root.querySelector('odd-sources')!;
      const revealed: string[] = [];
      const reveal = list.reveal.bind(list);
      list.reveal = (id: string) => {
        revealed.push(id);
        return reveal(id);
      };
      $(el, '[part="trigger"]')!.click();
      await settle(el);
      button(el, 'Show in sources').click();
      await settle(el);
      expect(revealed).toEqual(['wcag']);
      expect(list.sources).toHaveLength(1);
    } finally {
      citation.dispose();
    }

    // Context picker: a link is added as processing, then ready; Remove takes an item away.
    const pickerSet = (await import('../src/context-picker/context-picker.examples.js')).default;
    const picker = await mountExample(pickerSet, 'default', container);
    try {
      const el = picker.element;
      const input = $(el, 'input[type="url"]') as HTMLInputElement;
      input.value = 'https://example.com/paper';
      $(el, 'form.url')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(el);
      expect(el.items.at(-1)).toMatchObject({
        label: 'https://example.com/paper',
        status: 'processing',
      });
      await until(() => el.items.at(-1)?.status === 'ready', 'ready');
      $(el, '[aria-label="Remove scan.tiff"]')!.click();
      await settle(el);
      expect(el.items.map((item) => item.id)).not.toContain('f2');
    } finally {
      picker.dispose();
    }
  });

  it('C1 examples play the host: suggestions, feedback, answer branches, the composer', async () => {
    await import('../src/suggestions/suggestions.define.js');
    await import('../src/response-feedback/response-feedback.define.js');
    await import('../src/message-branch/message-branch.define.js');
    await import('../src/prompt-input/prompt-input.define.js');
    await import('@oddkin/components/define/textarea');
    const until = async (check: () => boolean, what: string) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 25));
      expect(check(), what).toBe(true);
    };

    // Suggestions: choosing puts the prompt in the host's field; the send button sends it.
    const suggestionsSet = (await import('../src/suggestions/suggestions.examples.js')).default;
    const suggestions = await mountExample(suggestionsSet, 'default', container);
    try {
      const el = suggestions.element;
      const field = suggestions.root.querySelector('odd-textarea')!;
      $(el, '[part="suggestion"]')!.click();
      await settle(el);
      expect(field.value).toBe('Summarize this page in three bullets.');
      $(el, '[part="send"]')!.click();
      await settle(el);
      expect(suggestions.root.querySelector('p')!.textContent).toBe(
        'Sent: Summarize this page in three bullets.',
      );
    } finally {
      suggestions.dispose();
    }

    // Feedback: a rating sent is pending, then submitted.
    const feedbackSet = (await import('../src/response-feedback/response-feedback.examples.js'))
      .default;
    const feedback = await mountExample(feedbackSet, 'default', container);
    try {
      const el = feedback.element;
      $(el, '[data-rating="positive"]')!.click();
      await settle(el);
      $(el, 'form odd-button[type="submit"]')!.click();
      await settle(el);
      expect(el.feedback).toMatchObject({ messageId: 'm2', rating: 'positive', status: 'pending' });
      await until(() => el.feedback?.status === 'submitted', 'submitted');
    } finally {
      feedback.dispose();
    }

    // Answer branches: Next shows the third answer, Previous the second again.
    const branchSet = (await import('../src/message-branch/message-branch.examples.js')).default;
    const branch = await mountExample(branchSet, 'default', container);
    try {
      const el = branch.element;
      const answer = () => branch.root.querySelector('p')!.textContent;
      expect(answer()).toBe('Use a container query on the card.');
      $(el, '[data-direction="next"]')!.click();
      await settle(el);
      expect([el.messageId, el.branch?.index, answer()]).toEqual([
        'm2c',
        3,
        'Use a grid with auto-fit columns.',
      ]);
      $(el, '[data-direction="previous"]')!.click();
      await settle(el);
      expect([el.messageId, el.branch?.index]).toEqual(['m2', 2]);
    } finally {
      branch.dispose();
    }

    // Composer: a message sent is taken a moment later; the field clears and the host says so.
    const composerSet = (await import('../src/prompt-input/prompt-input.examples.js')).default;
    const composer = await mountExample(composerSet, 'default', container);
    try {
      const el = composer.element;
      const input = $(el, '[part="input"]') as HTMLTextAreaElement;
      input.value = 'Draft the release notes.';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await settle(el);
      $(el, '[part="form"]')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(el);
      expect(el.loading).toBe(true);
      await until(() => !el.loading, 'acknowledged');
      await settle(el);
      expect(composer.root.querySelector('p')!.textContent).toBe('Sent: Draft the release notes.');
      expect(($(el, '[part="input"]') as HTMLTextAreaElement).value).toBe('');
    } finally {
      composer.dispose();
    }
  });

  it('C1 examples play the host: the conversation and its composer, a message, the activity line', async () => {
    await import('../src/conversation/conversation.define.js');
    await import('../src/prompt-input/prompt-input.define.js');
    await import('../src/message/message.define.js');
    await import('../src/activity/activity.define.js');
    const until = async (check: () => boolean, what: string) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 25));
      expect(check(), what).toBe(true);
    };
    const send = async (composer: HTMLElementTagNameMap['odd-prompt-input'], value: string) => {
      const input = $(composer, '[part="input"]') as HTMLTextAreaElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await settle(composer);
      $(composer, '[part="form"]')!.dispatchEvent(new Event('submit', { cancelable: true }));
    };

    // Conversation: the composer in the composer slot sends; the answer streams in; Load
    // earlier messages brings back the exchange before.
    const conversationSet = (await import('../src/conversation/conversation.examples.js')).default;
    const chat = await mountExample(conversationSet, 'default', container);
    try {
      const el = chat.element;
      const composer = el.querySelector('odd-prompt-input')!;
      expect(composer.slot).toBe('composer');
      const texts = () =>
        el
          .store!.getSnapshot()
          .messages.map((m) => m.parts.map((p) => (p.type === 'text' ? p.text : '')).join(''));
      expect(texts()).toEqual([
        'Summarize the release notes.',
        'Builds are faster and the side navigation gained project kinds.',
      ]);
      await send(composer, 'What else changed?');
      await until(() => composer.loading, 'answering');
      await until(() => !composer.loading, 'answered');
      expect(texts().slice(2)).toEqual([
        'What else changed?',
        'A simulated answer, streamed in small pieces like a real one.',
      ]);
      expect(($(composer, '[part="input"]') as HTMLTextAreaElement).value).toBe('');
      await settle(el);
      $(el, '.history button:not([hidden])')!.click();
      await until(() => texts().length === 6, 'the earlier exchange');
      expect(texts().slice(0, 2)).toEqual([
        'What shipped this week?',
        'Version 2.4, with its release notes.',
      ]);
    } finally {
      chat.dispose();
    }

    // Empty: the same host; the first message starts the conversation.
    const empty = await mountExample(conversationSet, 'empty', container);
    try {
      const el = empty.element;
      await send(el.querySelector('odd-prompt-input')!, 'Hello');
      await until(() => el.store!.getSnapshot().messages.length === 2, 'the first answer');
    } finally {
      empty.dispose();
    }

    // Message: Regenerate streams a new answer, then replaces the message; feedback is recorded.
    const messageSet = (await import('../src/message/message.examples.js')).default;
    const answer = await mountExample(messageSet, 'default', container);
    try {
      const el = answer.element;
      const regenerate = () => $$(el, 'button').find((b) => text(b) === 'Regenerate');
      regenerate()!.click();
      await settle(el);
      expect(el.attempt).toMatchObject({ attemptId: 'at2', status: 'streaming' });
      expect(regenerate()).toBeUndefined();
      await until(() => el.attempt?.status === 'completed', 'the new answer');
      await settle(el);
      expect(el.text).toContain('@container');
      const feedback = $(
        el,
        'odd-response-feedback',
      ) as HTMLElementTagNameMap['odd-response-feedback'];
      $(feedback, '[data-rating="positive"]')!.click();
      await settle(feedback);
      $(feedback, 'form odd-button[type="submit"]')!.click();
      await settle(el);
      expect(el.feedback).toMatchObject({ messageId: 'm2', rating: 'positive', status: 'pending' });
      await until(() => el.feedback?.status === 'submitted', 'submitted');
    } finally {
      answer.dispose();
    }

    // User message: Edit sends the new text, and the host replaces the message with it.
    const question = await mountExample(messageSet, 'user', container);
    try {
      const el = question.element;
      $(el, '[data-action="edit"]')!.click();
      await settle(el);
      const field = $(el, '.edit textarea') as HTMLTextAreaElement;
      field.value = 'How do I make the card responsive without media queries?';
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await settle(el);
      $(el, 'form.edit')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(el);
      expect(el.text).toBe('How do I make the card responsive without media queries?');
    } finally {
      question.dispose();
    }

    // Activity: Stop is confirmed a moment later; Retry starts a new attempt; Resume reconnects.
    const activitySet = (await import('../src/activity/activity.examples.js')).default;
    const action = (el: Element, name: string) => $(el, `[data-action="${name}"]`);
    const run = await mountExample(activitySet, 'default', container);
    try {
      const el = run.element;
      action(el, 'stop')!.click();
      await settle(el);
      expect(el.attempt?.stop).toBe('requested');
      await until(() => el.attempt?.status === 'cancelled', 'stopped');
      await settle(el);
      action(el, 'retry')!.click();
      await settle(el);
      expect(el.attempt).toMatchObject({
        attemptId: 'at2',
        relation: 'retry',
        status: 'submitted',
      });
      await until(() => el.attempt?.status === 'streaming', 'streaming again');
    } finally {
      run.dispose();
    }
    const lost = await mountExample(activitySet, 'interrupted', container);
    try {
      const el = lost.element;
      action(el, 'resume')!.click();
      await settle(el);
      expect(el.attempt?.connection).toBe('reconnecting');
      await until(() => el.attempt?.connection === 'open', 'reconnected');
    } finally {
      lost.dispose();
    }
  });

  it('odd-inline-assist: toolbar keyboard, stale selections, and request detail with revision', async () => {
    const el = await mount(
      'odd-inline-assist',
      () => import('../src/inline-assist/inline-assist.define.js'),
      (e) => {
        e.selection = { revision: 'r1', start: 0, end: 5, text: 'Hello' };
        e.documentRevision = 'r1';
        e.languages = [{ id: 'fr', label: 'French' }];
      },
    );
    const buttons = $$(el, '[role="toolbar"] button');
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true, cancelable: true }),
    );
    await settle(el);
    expect(el.shadowRoot!.activeElement?.textContent?.trim()).toBe('Expand');
    const requests: unknown[] = [];
    el.addEventListener('odd-assist-request', (e) => requests.push((e as CustomEvent).detail));
    ($(el, '[data-action="translate"]') as HTMLElement).click();
    expect(requests).toEqual([
      {
        action: 'translate',
        selection: { revision: 'r1', start: 0, end: 5, text: 'Hello' },
        options: { language: 'fr' },
      },
    ]);
    el.documentRevision = 'r2';
    await settle(el);
    ($(el, '[data-action="rewrite"]') as HTMLElement).click();
    expect(requests).toHaveLength(1);
    expect(text($(el, '#message'))).toBe(
      'The text changed after you selected it. Select it again.',
    );
  });

  it('odd-context-picker: validates links before requesting them and names remove buttons', async () => {
    const el = await mount(
      'odd-context-picker',
      () => import('../src/context-picker/context-picker.define.js'),
      (e) => {
        e.allowUrls = true;
        e.items = [
          { id: 'c1', kind: 'file', label: 'notes.md', status: 'ready', preview: '# Notes' },
        ];
      },
    );
    const added: unknown[] = [];
    el.addEventListener('odd-context-add', (e) => added.push((e as CustomEvent).detail));
    const input = $(el, 'input[type="url"]') as HTMLInputElement;
    input.value = 'javascript:alert(1)';
    $(el, 'form.url')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(el);
    expect(added).toEqual([]);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = 'https://example.com/paper';
    $(el, 'form.url')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(added).toEqual([{ kind: 'url', url: 'https://example.com/paper' }]);
    expect($$(el, '[aria-label^="Remove"]').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove notes.md',
    ]);
  });

  it('odd-artifact: keeps identity across revisions, renders previews, and cleans up renderers', async () => {
    let live = 0;
    const el = await mount(
      'odd-artifact',
      () => import('../src/artifact/artifact.define.js'),
      (e) => {
        e.artifact = {
          artifactId: 'a1',
          title: 'Report',
          kind: 'chart',
          currentRevisionId: 'r2',
          revisions: [
            { revisionId: 'r1', number: 1, content: 'v1' },
            { revisionId: 'r2', number: 2, content: 'v2' },
          ],
        };
        e.renderers = {
          chart: (revision, _artifact, target) => {
            live++;
            const node = document.createElement('p');
            node.textContent = `chart:${revision.content}`;
            target.append(node);
            return () => live--;
          },
        };
      },
    );
    expect(text($(el, '[part="preview"]'))).toBe('chart:v2');
    const select = $(el, 'select') as HTMLSelectElement;
    select.value = 'r1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(el);
    expect(text($(el, '[part="preview"]'))).toBe('chart:v1');
    expect(live).toBe(1);
    el.view = 'source';
    await settle(el);
    expect($(el, '[part="source"]')!.textContent).toBe('v1');
    expect(live).toBe(0);
    el.remove();
    flush();
    expect(live).toBe(0);
  });
});

describe('voice and transcript', () => {
  it('A19: denial and cleanup; an owned session never outlives the element', async () => {
    const denied = createScriptedVoiceAdapter([], { denyPermission: true });
    const el = await mount(
      'odd-voice-input',
      () => import('../src/voice-input/voice-input.define.js'),
      (e) => {
        e.adapter = denied;
      },
    );
    ($(el, '.record') as HTMLElement).click();
    // Scripted adapters run on timers; poll so a loaded engine cannot outrun a fixed sleep.
    const status = () => {
      flush();
      return text($(el, '[part="status"]'));
    };
    await expect.poll(status, { timeout: 2000, interval: 10 }).toContain('permission was denied');
    const adapter = createScriptedVoiceAdapter([
      { after: 5, interim: 'hel' },
      { after: 5, final: 'hello there' },
      { after: 500, final: 'later' },
    ]);
    el.adapter = adapter;
    await settle(el);
    const baseline = { ...scopeStats() };
    ($(el, '.record') as HTMLElement).click();
    const transcript = () => {
      flush();
      return text($(el, 'odd-transcript')?.shadowRoot?.querySelector('[part="list"]'));
    };
    await expect.poll(transcript, { timeout: 2000, interval: 10 }).toBe('hello there');
    await settle(el);
    expect($(el, '.record')!.getAttribute('aria-pressed')).toBe('true');
    el.remove();
    flush();
    expect(adapter.openResources).toBe(0);
    container.append(el);
    await settle(el);
    el.remove();
    flush();
    expect(scopeStats().listeners).toBeLessThanOrEqual(baseline.listeners);
  });
});

describe('odd-message fallbacks and provenance', () => {
  it('A15: unknown parts, missing records, and invalid data render explicit fallbacks', async () => {
    const el = await mount(
      'odd-message',
      () => import('../src/message/message.define.js'),
      (e) => {
        e.message = {
          id: 'm',
          role: 'assistant',
          provenance: { kind: 'generated', model: 'Example 1', notes: 'Drafted by the assistant.' },
          parts: [
            { type: 'unsupported', id: 'u', originalType: 'hologram' },
            { type: 'tool-call', id: 't', toolCallId: 'missing' },
            { type: 'data', id: 'd', name: 'chart', data: { bad: true } },
            { type: 'data', id: 'd2', name: 'unknown', data: 1 },
          ],
        };
        e.renderers = {
          chart: {
            validate: (d) => Array.isArray(d),
            render: () => document.createElement('canvas'),
          },
        };
      },
    );
    expect($$(el, '.fallback').map(text)).toEqual([
      'This message contains content (hologram) that can’t be shown here.',
      'A tool call is referenced but its record is missing.',
      'Structured content “chart” was not shown because it did not pass validation.',
      'Structured content “unknown” was not shown because it did not pass validation.',
    ]);
    const label = $(el, 'odd-ai-label')!;
    expect(text(label.shadowRoot!.querySelector('summary'))).toBe('AI generated');
    expect(text(label.shadowRoot!.querySelector('details'))).toContain(
      'not independently verified',
    );
  });

  it('odd-task-plan: steps, parallel tasks, blockers, progress, and input requests', async () => {
    const el = await mount(
      'odd-task-plan',
      () => import('../src/task-plan/task-plan.define.js'),
      (e) => {
        e.plan = {
          planId: 'p',
          title: 'Migrate',
          steps: [
            { id: '1', title: 'Analyze', status: 'done' },
            {
              id: '2',
              title: 'Update',
              status: 'active',
              tasks: [
                { id: 'a', title: 'API', status: 'active' },
                { id: 'b', title: 'UI', status: 'pending' },
              ],
            },
            { id: '3', title: 'Deploy', status: 'blocked', blocker: 'Needs credentials' },
            { id: '4', title: 'Notify', status: 'needs-input', inputRequest: 'Which channel?' },
          ],
        };
      },
    );
    expect(text($(el, '[part="progress"] span'))).toBe('1 of 4 steps done');
    expect(text($(el, '[part="steps"]'))).toContain('Blocked: Needs credentials');
    expect(text($(el, '[part="steps"]'))).toContain('Running in parallel');
    const requests: unknown[] = [];
    el.addEventListener('odd-plan-input-request', (e) => requests.push((e as CustomEvent).detail));
    ($(el, '[data-step="4"]') as HTMLElement).click();
    expect(requests).toEqual([{ planId: 'p', stepId: '4' }]);
  });
});

describe('odd-question and odd-task-plan examples', () => {
  it("odd-question's default example plays the host: an answer or a skip comes back recorded", async () => {
    await import('../src/question/question.define.js');
    const { default: set } = await import('../src/question/question.examples.js');
    const answered = await mountExample(set, 'default', container);
    try {
      const el = answered.element;
      $$(el, 'input[name="choice"]')[1]!.click();
      $(el, 'odd-button[type="submit"]')!.click();
      await settle(el);
      expect(el.question).toMatchObject({ status: 'submitted', answer: { choice: 'eng' } });
      expect(text($(el, '.state'))).toBe('Answered.');
    } finally {
      answered.dispose();
    }
    const skipped = await mountExample(set, 'default', container);
    try {
      const el = skipped.element;
      $(el, '[part="actions"] odd-button[appearance="ghost"]')!.click();
      await settle(el);
      expect(el.question?.status).toBe('skipped');
      expect(text($(el, '.state'))).toBe('Skipped.');
    } finally {
      skipped.dispose();
    }
  });

  it("odd-task-plan's default example plays the host: Respond asks the step's question, and the answer completes the step", async () => {
    await import('../src/task-plan/task-plan.define.js');
    await import('../src/question/question.define.js');
    const { default: set } = await import('../src/task-plan/task-plan.examples.js');
    const mounted = await mountExample(set, 'default', container);
    try {
      const el = mounted.element;
      expect(mounted.root.querySelector('odd-question')).toBeNull();
      $(el, '[data-step="c"]')!.click();
      const question = mounted.root.querySelector('odd-question')!;
      await settle(question);
      expect(document.activeElement).toBe(question);
      expect(text($(question, 'legend'))).toBe('Major or minor?');
      // Respond again keeps the one question.
      $(el, '[data-step="c"]')!.click();
      await settle(question);
      expect(mounted.root.querySelectorAll('odd-question')).toHaveLength(1);
      $$(question, 'input[name="choice"]')[1]!.click();
      $(question, 'odd-button[type="submit"]')!.click();
      await settle(question);
      await settle(el);
      expect(text($(question, '.state'))).toBe('Answered.');
      expect(el.plan?.steps.map((step) => step.status)).toEqual([
        'done',
        'active',
        'done',
        'pending',
      ]);
      expect(text($(el, '[part="steps"] > li:nth-child(3) .detail'))).toBe('Minor version');
      expect(text($(el, '[part="progress"] span'))).toBe('2 of 4 steps done');
      expect($(el, '[data-step]')).toBeNull();
    } finally {
      mounted.dispose();
    }
  });
});
