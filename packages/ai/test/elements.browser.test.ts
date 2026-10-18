import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
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
    el.addEventListener('tool-retry', (e) => retries.push((e as CustomEvent).detail));
    $(el, '.failure button')!.click();
    expect(retries).toEqual([{ toolCallId: 't1' }]);
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
    el.addEventListener('approval-decide', (e) => decisions.push((e as CustomEvent).detail));
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
    el.addEventListener('checkpoint-restore', (e) => requests.push((e as CustomEvent).detail));
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
    el.addEventListener('model-change', (e) => changes.push((e as CustomEvent).detail));
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
    el.addEventListener('model-change', (e) => e.preventDefault(), { once: true });
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
    el.addEventListener('suggestion-select', () => events.push('select'));
    el.addEventListener('suggestion-submit', () => events.push('submit'));
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
    el.addEventListener('change-accept', (e) => doc.accept((e as CustomEvent).detail.proposalId));
    el.addEventListener('change-undo', (e) => doc.undo((e as CustomEvent).detail.proposalId));
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
    ($(el, 'odd-button[data-action="accept"]') as HTMLElement).click();
    await sync();
    expect(doc.getSnapshot().text).toBe('The swift fox.');
    expect($$(el, '.state').map(text)).toEqual(['Applied', expect.stringContaining('Out of date')]);
    ($(el, 'odd-button[data-action="undo"]') as HTMLElement).click();
    await sync();
    expect(doc.getSnapshot().text).toBe('The quick fox.');
    expect($$(el, '.state').map(text)[0]).toBe('Undone');
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
    el.addEventListener('assist-request', (e) => requests.push((e as CustomEvent).detail));
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
    el.addEventListener('context-add', (e) => added.push((e as CustomEvent).detail));
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
    el.mode = 'source';
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
    await new Promise((r) => setTimeout(r, 20));
    await settle(el);
    expect(text($(el, '[part="status"]'))).toContain('permission was denied');
    const adapter = createScriptedVoiceAdapter([
      { after: 5, interim: 'hel' },
      { after: 5, final: 'hello there' },
      { after: 500, final: 'later' },
    ]);
    el.adapter = adapter;
    await settle(el);
    const baseline = { ...scopeStats() };
    ($(el, '.record') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    await settle(el);
    expect($(el, '.record')!.getAttribute('aria-pressed')).toBe('true');
    const transcript = $(el, 'odd-transcript')!;
    expect(text(transcript.shadowRoot!.querySelector('[part="list"]'))).toBe('hello there');
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
    el.addEventListener('plan-input', (e) => requests.push((e as CustomEvent).detail));
    ($(el, '[data-step="4"]') as HTMLElement).click();
    expect(requests).toEqual([{ planId: 'p', stepId: '4' }]);
  });
});
