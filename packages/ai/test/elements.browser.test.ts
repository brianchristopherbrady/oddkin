import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { mountExample } from '@oddkin/workbench/testing';
import { createScriptedVoiceAdapter } from '../src/controllers/voice.js';
import { DocumentSession } from '../src/controllers/document.js';
import { highlight } from '../src/highlight/index.js';
import type {
  ApprovalRecord,
  AttemptRecord,
  CheckpointRecord,
  ToolCallRecord,
} from '../src/contracts/types.js';
import type { ArtifactRenderer } from '../src/artifact/artifact.js';

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
/** Loads the default theme's tokens; the returned function removes them. */
const loadTheme = async () => {
  const theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  await new Promise((resolve, reject) => {
    theme.onload = resolve;
    theme.onerror = reject;
    document.head.append(theme);
  });
  return () => theme.remove();
};

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

  it('copies with odd-copy-buttons in its strings: the action copies the source, a code block its code', async () => {
    const el = await mount('odd-response', define, (e) => {
      e.copyable = true;
      e.text = 'Run this:\n\n```sh\nnpm install\nnpm test\n```';
      e.strings = { copy: 'Copier la réponse', copyCode: 'Copier le code', copied: 'Copié.' };
    });
    const written: string[] = [];
    const clipboard = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockImplementation(async (t) => void written.push(t));
    try {
      const action = $(el, '[part="actions"] > odd-copy-button')!;
      const code = $(el, '[part="content"] .code-block odd-copy-button')!;
      expect([text($(action, 'button')), text($(code, 'button'))]).toEqual([
        'Copier la réponse',
        'Copier le code',
      ]);
      $(action, 'button')!.click();
      $(code, 'button')!.click();
      await expect.poll(() => written).toEqual([el.text, 'npm install\nnpm test']);
      await expect.poll(() => text($(action, '[part="confirmation"]'))).toBe('Copié.');
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
    // The summary shows a disclosure marker that turns with the open state;
    // its empty alternative keeps it out of the summary's accessible name.
    const marker = () => getComputedStyle($(el, '.name')!, '::before').content;
    expect(marker()).toBe('"\u25B8" / ""');
    ($(el, 'details') as HTMLDetailsElement).open = true;
    expect(marker()).toBe('"\u25BE" / ""');
    ($(el, 'details') as HTMLDetailsElement).open = false;
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

  it('words the gate from the approval until the call runs (ADR 0049)', async () => {
    const approval = (status: ApprovalRecord['status']): ApprovalRecord => ({
      approvalId: 'ap',
      toolCallId: 't1',
      revision: 1,
      title: 'Search the web',
      status,
    });
    const el = await mount(
      'odd-tool-call',
      () => import('../src/tool-call/tool-call.define.js'),
      (e) => {
        e.tool = tool('input-available', { approvalId: 'ap' });
        e.approval = approval('requested');
      },
    );
    const status = () => [text($(el, '.status')), $(el, '.status')!.dataset['tone']];
    const show = async (call: ToolCallRecord['status'], gate: ApprovalRecord['status']) => {
      el.tool = tool(call, { approvalId: 'ap' });
      el.approval = approval(gate);
      await settle(el);
      return status();
    };
    expect(status()).toEqual(['Waiting for approval', 'active']);
    expect(await show('input-available', 'submitting')).toEqual(['Waiting for approval', 'active']);
    expect(await show('input-available', 'failed')).toEqual(['Waiting for approval', 'active']);
    for (const gate of ['rejected', 'expired', 'superseded', 'cancelled'] as const)
      expect(await show('input-available', gate)).toEqual(['Not run', '']);
    // Approval is not execution: an approved call is ready until it runs.
    expect(await show('input-available', 'approved')).toEqual(['Arguments ready; not run yet', '']);
    // Once the call runs or settles, it speaks for itself.
    expect(await show('executing', 'approved')).toEqual(['Running…', 'active']);
    expect(await show('denied', 'rejected')).toEqual(['Not run: denied', 'danger']);
  });

  it('a withdrawn approval says so and offers no decision (ADR 0049 §5)', async () => {
    const el = await mount(
      'odd-action-approval',
      () => import('../src/action-approval/action-approval.define.js'),
      (e) => {
        e.approval = { approvalId: 'ap', revision: 1, title: 'Deploy', status: 'cancelled' };
        e.capabilities = { respondToApproval: { available: true } };
      },
    );
    expect(text($(el, '.state'))).toBe('This request was withdrawn; there is nothing to decide.');
    expect(($(el, '[part="actions"]') as HTMLElement).hidden).toBe(true);
  });

  describe('scopes (ADR 0049 §6 item 3)', () => {
    const scopes = [
      { id: 'once', label: 'This change only' },
      { id: 'session', label: 'Writes to /docs this session', description: 'Until you sign out.' },
    ];
    const both = { respondToApproval: { available: true }, approvalScopes: { available: true } };
    const approval = (extra: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
      approvalId: 'ap',
      revision: 1,
      title: 'Write',
      status: 'requested',
      scopes,
      ...extra,
    });
    const scoped = (record: ApprovalRecord) =>
      mount(
        'odd-action-approval',
        () => import('../src/action-approval/action-approval.define.js'),
        (e) => {
          e.approval = record;
          e.capabilities = both;
        },
      );
    const approve = (el: Element) => $(el, 'odd-button[appearance="primary"]') as HTMLButtonElement;
    const reject = (el: Element) => $$(el, '[part="actions"] odd-button')[1] as HTMLButtonElement;
    const note = (el: Element) => text($(el, '.actions + .muted'));
    const radios = (el: Element) => $$(el, 'input[name="scope"]') as HTMLInputElement[];

    it('two or more: the person chooses, and Approve sends the choice; a new revision resets it', async () => {
      const el = await scoped(approval());
      expect(text($(el, 'legend'))).toBe('Approval covers');
      // Nothing is chosen because it comes first.
      expect(radios(el).map((r) => r.checked)).toEqual([false, false]);
      expect(approve(el).disabled).toBe(true);
      expect(note(el)).toBe('Choose what your approval covers.');
      radios(el)[1]!.click();
      await settle(el);
      expect(approve(el).disabled).toBe(false);
      expect(note(el)).toBe('');
      const seen: unknown[] = [];
      el.addEventListener('odd-approval-decide', (e) => seen.push((e as CustomEvent).detail));
      approve(el).click();
      expect(seen).toEqual([
        { approvalId: 'ap', revision: 1, decision: 'approve', reason: undefined, scope: 'session' },
      ]);
      // A new revision drops the choice; a valid default stands until the person picks another.
      el.approval = approval({ revision: 2, defaultScopeId: 'once' });
      await settle(el);
      expect(radios(el).map((r) => r.checked)).toEqual([true, false]);
      expect(approve(el).disabled).toBe(false);
      // A rejection never carries a scope.
      reject(el).click();
      expect(seen.at(-1)).toEqual({
        approvalId: 'ap',
        revision: 2,
        decision: 'reject',
        reason: undefined,
        scope: undefined,
      });
    });

    it('one scope is explained without a choice, and goes with Approve', async () => {
      const el = await scoped(approval({ scopes: [scopes[1]!] }));
      expect(radios(el)).toHaveLength(0);
      expect(text($(el, '[part="scope"]'))).toBe(
        'Approval covers: Writes to /docs this session — Until you sign out.',
      );
      const seen: unknown[] = [];
      el.addEventListener('odd-approval-decide', (e) => seen.push((e as CustomEvent).detail));
      approve(el).click();
      expect(seen).toEqual([expect.objectContaining({ decision: 'approve', scope: 'session' })]);
    });

    it('invalid scopes, or a host that cannot carry one, refuse Approve with the reason; Reject stays', async () => {
      const el = await scoped(approval({ scopes: [scopes[0]!, { id: 'once', label: 'Again' }] }));
      const refused = async (reason: string) => {
        await settle(el);
        expect(approve(el).disabled).toBe(true);
        expect(reject(el).disabled).toBe(false);
        expect(note(el)).toBe(reason);
      };
      await refused('Its choices are not valid; it cannot be approved.');
      el.approval = approval({ revision: 2, defaultScopeId: 'forever' });
      await refused('Its choices are not valid; it cannot be approved.');
      el.approval = approval({ revision: 3, defaultScopeId: 'once' });
      el.capabilities = {
        respondToApproval: { available: true },
        approvalScopes: { available: false, reason: 'This service records no scopes.' },
      };
      await refused('This service records no scopes.');
      el.capabilities = { respondToApproval: { available: true } };
      await refused('Approving with these choices is not available here.');
    });
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
      // Neutral (no tone) as the Figma specimen draws it, the same as active; success and danger
      // (filled, with a currentColor border).
      expect(await look('input-available')).toEqual(
        colours('text-primary', 'none', 'border-strong'),
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
    // A failed decision releases the guard: the same revision can be decided again.
    el.approval = approval('failed', 2);
    await settle(el);
    approve().click();
    expect(decisions).toHaveLength(3);
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
      // The reason goes with either decision.
      const reason = $(el, '.reason textarea') as HTMLTextAreaElement;
      reason.value = 'Ship before noon.';
      reason.dispatchEvent(new Event('input', { bubbles: true }));
      $(el, 'odd-button[appearance="primary"]')!.click();
      await settle(el);
      expect(el.approval).toMatchObject({
        status: 'approved',
        decision: 'approve',
        reason: 'Ship before noon.',
      });
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

  it('their examples play the host: an approved call runs, a rejected one is denied; Edit brings the next revision', async () => {
    await import('../src/tool-call/tool-call.define.js');
    const { default: tools } = await import('../src/tool-call/tool-call.examples.js');
    const status = (el: Element) => {
      flush();
      return text($(el, '.status'));
    };
    const decide = async (button: number) => {
      const mounted = await mountExample(tools, 'approval', container);
      const approval = $(mounted.element, 'odd-action-approval')!;
      await settle(approval as unknown as { updateComplete: Promise<void> });
      $$(approval, '[part="actions"] odd-button')[button]!.click();
      // Read at once: the approved run ends after 600 ms, which settle can outlast under load.
      const first = status(mounted.element);
      await settle(mounted.element);
      return { mounted, first };
    };
    const approved = await decide(0);
    try {
      expect(approved.first).toBe('Running…');
      expect(approved.mounted.element.approval?.status).toBe('approved');
      await expect
        .poll(() => status(approved.mounted.element), { timeout: 3000, interval: 20 })
        .toBe('Finished');
    } finally {
      approved.mounted.dispose();
    }
    const denied = await decide(1);
    try {
      expect(denied.first).toBe('Not run: denied');
      expect(status(denied.mounted.element)).toBe('Not run: denied');
      expect(denied.mounted.element.approval?.status).toBe('rejected');
    } finally {
      denied.mounted.dispose();
    }
    const { default: approvals } =
      await import('../src/action-approval/action-approval.examples.js');
    const edited = await mountExample(approvals, 'edit', container);
    try {
      const el = edited.element;
      $$(el, '[part="actions"] odd-button')[2]!.click();
      await settle(el);
      expect(el.approval).toMatchObject({ revision: 2, status: 'requested' });
      expect(text($(el, '[part="changes"]'))).toContain('Release 2.0 notes');
      $(el, 'odd-button[appearance="primary"]')!.click();
      await settle(el);
      expect(el.approval).toMatchObject({ revision: 2, status: 'approved' });
    } finally {
      edited.dispose();
    }
  });
});

describe('odd-checkpoint', () => {
  it('approval and checkpoint statuses take their tones from one map (ADR 0049 §4)', async () => {
    const approval = await mount(
      'odd-action-approval',
      () => import('../src/action-approval/action-approval.define.js'),
      () => {},
    );
    const checkpoint = await mount(
      'odd-checkpoint',
      () => import('../src/checkpoint/checkpoint.define.js'),
      () => {},
    );
    const tones = async <S extends string>(
      el: HTMLElement & { updateComplete: Promise<void> },
      statuses: readonly S[],
      set: (status: S) => void,
    ) => {
      const out: Record<string, string | undefined> = {};
      for (const status of statuses) {
        set(status);
        await settle(el);
        out[status] = $(el, '.state')!.dataset['tone'];
      }
      return out;
    };
    expect(
      await tones(
        approval,
        ['approved', 'rejected', 'failed', 'submitting', 'requested', 'expired'] as const,
        (status) => (approval.approval = { approvalId: 'ap', revision: 1, title: 'Send', status }),
      ),
    ).toEqual({
      approved: 'success',
      rejected: 'danger',
      failed: 'danger',
      submitting: 'active',
      requested: '',
      expired: '',
    });
    expect(
      await tones(
        checkpoint,
        ['restored', 'restore-failed', 'restore-pending', 'available'] as const,
        (status) =>
          (checkpoint.checkpoint = {
            checkpointId: 'cp',
            label: 'Before',
            description: 'Files as of step 3.',
            restores: ['src/'],
            status,
          }),
      ),
    ).toEqual({
      restored: 'success',
      'restore-failed': 'danger',
      'restore-pending': 'active',
      available: '',
    });
  });

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
    // No status while it can be restored; Keep current state hands focus back to Restore….
    expect($(el, '.state')!.hidden).toBe(true);
    $(el, '[part="actions"] odd-button')!.click();
    await settle(el);
    ($(el, '.confirm odd-button[appearance="ghost"]') as HTMLElement).focus();
    $(el, '.confirm odd-button[appearance="ghost"]')!.click();
    await settle(el);
    await frames(2);
    expect(el.shadowRoot!.activeElement).toBe($(el, '[part="actions"] odd-button'));
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
          { id: 'audio', label: 'Audio', available: false },
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
      ['Vision (unavailable: Not in your plan)', true],
      ['Audio (unavailable)', true],
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
        status: 'requested',
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
    // The diff keeps the proposal's own spaces and line breaks.
    expect(getComputedStyle(item(0).querySelector('.segments')!).whiteSpace).toBe('pre-wrap');
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
      // The fixture gives the adapter; the element takes it on its next update.
      await settle(el);
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

  it("the contract review's examples play the host: a rewrite to review, a translation, a failed send, uploads, recorded feedback, voice failures", async () => {
    await import('../src/inline-assist/inline-assist.define.js');
    await import('../src/change-review/change-review.define.js');
    await import('../src/prompt-input/prompt-input.define.js');
    await import('../src/response-feedback/response-feedback.define.js');
    await import('../src/voice-input/voice-input.define.js');
    const until = async (check: () => boolean, what: string) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 25));
      expect(check(), what).toBe(true);
    };

    // Inline assist: Rewrite becomes a proposal under the sentence; Accept replaces the word,
    // and the selection is then out of date.
    const assistSet = (await import('../src/inline-assist/inline-assist.examples.js')).default;
    const assist = await mountExample(assistSet, 'default', container);
    try {
      const el = assist.element;
      const review = assist.root.querySelector('odd-change-review')!;
      expect(assist.root.querySelector('mark')!.textContent).toBe('build');
      $(el, '[data-action="rewrite"]')!.click();
      await settle(el);
      expect(el.status).toBe('pending');
      await until(() => review.proposals.length === 1, 'the proposal');
      expect(review.proposals[0]).toMatchObject({
        original: 'build',
        replacement: 'compile step',
        status: 'requested',
      });
      await settle(review);
      $(review, 'odd-button[data-action="accept"]')!.click();
      await settle(review);
      await settle(el);
      expect(assist.root.querySelector('p')!.textContent).toBe(
        'The compile step takes twelve minutes on every pull request.',
      );
      expect(text($(el, '#message'))).toBe(
        'The text changed after you selected it. Select it again.',
      );
    } finally {
      assist.dispose();
    }
    const translate = await mountExample(assistSet, 'translate', container);
    try {
      const el = translate.element;
      const select = $(el, 'select') as HTMLSelectElement;
      select.value = 'de';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      $(el, '[data-action="translate"]')!.click();
      await until(() => el.status === 'complete', 'the translation');
      expect(el.result).toContain('(German)');
    } finally {
      translate.dispose();
    }

    // Composer: the first send fails and the draft stays; the second is taken.
    const composerSet = (await import('../src/prompt-input/prompt-input.examples.js')).default;
    const failing = await mountExample(composerSet, 'failedSend', container);
    try {
      const el = failing.element;
      const input = () => $(el, '[part="input"]') as HTMLTextAreaElement;
      el.submit();
      await until(() => !el.loading, 'the failure');
      await settle(el);
      expect(text($(el, '[part="status"]'))).toBe(
        'The message was not sent: you are offline. Your message was kept; you can edit it and send again.',
      );
      expect(input().value).toBe('Draft the release notes.');
      el.submit();
      await until(() => !el.loading, 'acknowledged');
      await settle(el);
      expect(failing.root.querySelector('p')!.textContent).toBe('Sent: Draft the release notes.');
      expect(input().value).toBe('');
    } finally {
      failing.dispose();
    }
    // Attachments: the host uploads one and fails the other; sending then asks to remove it.
    const uploads = await mountExample(composerSet, 'attachments', container);
    try {
      const el = uploads.element;
      const statuses = () => $$(el, '.attachment').map((li) => li.dataset['status']);
      await until(() => statuses().join() === 'uploaded,failed', 'the uploads');
      expect(text($$(el, '.attachment')[1]!.querySelector('.error'))).toBe('The upload failed.');
      el.value = 'Here are the notes.';
      el.submit();
      await settle(el);
      expect(text($(el, '[part="status"]'))).toBe('Remove or replace attachments that failed.');
    } finally {
      uploads.dispose();
    }
    // Enter adds a line; Ctrl+Enter sends.
    const newline = await mountExample(composerSet, 'newline', container);
    try {
      const el = newline.element;
      const input = $(el, '[part="input"]') as HTMLTextAreaElement;
      el.value = 'First line';
      await settle(el);
      const enter = (init: KeyboardEventInit) =>
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }),
        );
      expect(enter({})).toBe(true);
      expect(el.loading).toBe(false);
      expect(enter({ ctrlKey: true })).toBe(false);
      expect(el.loading).toBe(true);
      await until(() => !el.loading, 'acknowledged');
      expect(newline.root.querySelector('p')!.textContent).toBe('Sent: First line');
    } finally {
      newline.dispose();
    }

    // Feedback: a recorded negative rating is pressed with the thanks; after a failure the
    // user rates again, and the second attempt is recorded.
    const feedbackSet = (await import('../src/response-feedback/response-feedback.examples.js'))
      .default;
    const recorded = await mountExample(feedbackSet, 'negative', container);
    try {
      const el = recorded.element;
      await settle(el);
      expect($(el, '[data-rating="negative"]')!.getAttribute('aria-pressed')).toBe('true');
      expect(text($(el, '.outcome'))).toBe('Thanks. Your feedback was recorded.');
    } finally {
      recorded.dispose();
    }
    const failed = await mountExample(feedbackSet, 'failed', container);
    try {
      const el = failed.element;
      expect(text($(el, '.outcome'))).toBe('Feedback was not sent: The server did not answer.');
      $(el, '[data-rating="negative"]')!.click();
      await settle(el);
      const send = $(el, 'form odd-button[type="submit"]')!;
      expect(text(send)).toBe('Try again');
      send.click();
      await settle(el);
      await until(() => el.feedback?.status === 'submitted', 'recorded');
    } finally {
      failed.dispose();
    }

    // Voice input: each failure says what happened.
    const voiceSet = (await import('../src/voice-input/voice-input.examples.js')).default;
    const said = async (name: string, expected: string, start = true) => {
      const mounted = await mountExample(voiceSet, name, container);
      try {
        const el = mounted.element;
        await settle(el);
        if (start) $(el, 'button.record')!.click();
        await until(() => text($(el, '[part="status"]')) === expected, `${name}: ${expected}`);
      } finally {
        mounted.dispose();
      }
    };
    await said(
      'denied',
      'Microphone permission was denied. Allow it in your browser settings to use voice input.',
    );
    await said('noDevice', 'No microphone is available.');
    await said('interrupted', 'Recording was interrupted.');
    await said('unsupported', 'Voice input is not available in this browser or app.', false);
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

  it('odd-artifact: its exports example plays the host, which writes the revision as JSON', async () => {
    await import('../src/artifact/artifact.define.js');
    const artifactSet = (await import('../src/artifact/artifact.examples.js')).default;
    const output = await mountExample(artifactSet, 'exports', container);
    try {
      const el = output.element;
      $(el, '[data-format="json"]')!.click();
      await settle(el);
      const line = output.root.querySelector('p')!;
      const link = line.querySelector('a')!;
      expect([line.textContent, link.download, link.href.startsWith('blob:')]).toEqual([
        'Revision 2 as JSON: release-notes.json',
        'release-notes.json',
        true,
      ]);
      expect(await (await fetch(link.href)).json()).toEqual({
        title: 'Release notes',
        revision: 2,
        content: '# Release notes\n\n- Faster builds',
      });
    } finally {
      output.dispose();
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
          artifact: {
            chart: (revision, _artifact, target) => {
              live++;
              const node = document.createElement('p');
              node.textContent = `chart:${revision.content}`;
              target.append(node);
              return () => live--;
            },
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
          data: {
            chart: {
              validate: (d) => Array.isArray(d),
              render: () => document.createElement('canvas'),
            },
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
    const disclosure = $(label, 'odd-disclosure')!;
    expect(text($(disclosure, '[part="summary"]'))).toBe('AI generated');
    expect(text(disclosure)).toContain('not independently verified');
  });

  it('shows reasoning in a closed disclosure, as secondary text in the prose weight', async () => {
    const removeTheme = await loadTheme();
    try {
      const el = await mount(
        'odd-message',
        () => import('../src/message/message.define.js'),
        (e) => {
          e.message = {
            id: 'm',
            role: 'assistant',
            parts: [
              { type: 'reasoning', id: 'r', text: 'Checking two sources.' },
              { type: 'text', id: 't', text: 'The answer.' },
            ],
          };
        },
      );
      const reasoning = $(el, '.reasoning') as HTMLElementTagNameMap['odd-disclosure'];
      expect(reasoning.localName).toBe('odd-disclosure');
      expect(reasoning.label).toBe('Reasoning');
      const response = reasoning.querySelector('odd-response')!;
      expect(response.checkVisibility()).toBe(false);
      reasoning.open = true;
      await settle(reasoning);
      expect(response.checkVisibility()).toBe(true);
      const style = getComputedStyle(response);
      expect(style.fontWeight).toBe('400');
      expect(style.color).toBe(getComputedStyle($(el, '.role')!).color);
    } finally {
      removeTheme();
    }
  });

  it('takes one renderers object by extension point; the old names and shape work for one beta', async () => {
    const node = (content: string) =>
      Object.assign(document.createElement('p'), { textContent: content });
    const chart = { validate: (d: unknown) => Array.isArray(d), render: () => node('data:chart') };
    const preview: ArtifactRenderer = (revision, _artifact, target) => {
      target.append(node(`artifact:${revision.content}`));
    };
    const output = (tool: ToolCallRecord) => node(`tool:${tool.toolName}`);
    const records = (e: HTMLElementTagNameMap['odd-message']) => {
      e.message = {
        id: 'm',
        role: 'assistant',
        parts: [
          { type: 'data', id: 'd', name: 'chart', data: [1] },
          { type: 'tool-call', id: 't', toolCallId: 't1' },
          { type: 'artifact', id: 'a', artifactId: 'a1' },
        ],
      };
      e.tools = {
        t1: {
          toolCallId: 't1',
          toolName: 'search',
          status: 'output-available',
          output: { hits: 1 },
        },
      };
      e.artifacts = {
        a1: {
          artifactId: 'a1',
          title: 'Report',
          kind: 'chart',
          currentRevisionId: 'r1',
          revisions: [{ revisionId: 'r1', number: 1, content: 'v1' }],
        },
      };
    };
    const shown = async (el: HTMLElementTagNameMap['odd-message']) => {
      const tool = $(el, 'odd-tool-call') as HTMLElementTagNameMap['odd-tool-call'];
      const artifact = $(el, 'odd-artifact') as HTMLElementTagNameMap['odd-artifact'];
      await settle(tool);
      await settle(artifact);
      return [
        text($(el, '[part="content"]')),
        text($(tool, '[part="result"]')),
        text($(artifact, '[part="preview"]')),
      ];
    };
    const define = () => import('../src/message/message.define.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const current = await mount('odd-message', define, (e) => {
        records(e);
        e.renderers = { data: { chart }, artifact: { chart: preview }, toolOutput: output };
      });
      const expected = ['data:chart', 'Result tool:search', 'artifact:v1'];
      expect(await shown(current)).toEqual(expected);
      expect(warn).not.toHaveBeenCalled();
      // Until the next beta: renderers as a map of data renderers, artifactRenderers, renderTool.
      const legacy = await mount('odd-message', define, (e) => {
        records(e);
        e.renderers = { chart } as never;
        e.artifactRenderers = { chart: preview };
        e.renderTool = { render: output };
      });
      expect(await shown(legacy)).toEqual(expected);
      expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
        expect.stringMatching(/^\[ai\.renderers\.legacy\] /),
      ]);
      // A point given in renderers wins over its old property.
      legacy.renderers = { toolOutput: () => node('tool:new') };
      await settle(legacy);
      expect((await shown(legacy))[1]).toBe('Result tool:new');
      // A tool call on its own still reads renderOutput.
      const tool = await mount(
        'odd-tool-call',
        () => import('../src/tool-call/tool-call.define.js'),
        (e) => {
          e.tool = legacy.tools!['t1']!;
          e.renderOutput = { render: output };
        },
      );
      expect(text($(tool, '[part="result"]'))).toBe('Result tool:search');
      // An artifact on its own still reads renderers as a map by kind.
      const artifact = await mount(
        'odd-artifact',
        () => import('../src/artifact/artifact.define.js'),
        (e) => {
          e.artifact = legacy.artifacts!['a1']!;
          e.renderers = { chart: preview } as never;
        },
      );
      expect(text($(artifact, '[part="preview"]'))).toBe('artifact:v1');
    } finally {
      warn.mockRestore();
    }
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
    // A step that asks for input says so once: its request, with Respond.
    expect(text($(el, '[data-status="needs-input"] .body'))).toBe(
      'Notify Needs your input: Which channel? Respond',
    );
    const requests: unknown[] = [];
    el.addEventListener('odd-plan-input-request', (e) => requests.push((e as CustomEvent).detail));
    ($(el, '[data-step="4"]') as HTMLElement).click();
    expect(requests).toEqual([{ planId: 'p', stepId: '4' }]);
  });
});

describe('odd-question and odd-task-plan examples', () => {
  it('odd-question takes answers only where the capabilities given allow them; alone, its host answers', async () => {
    const el = await mount(
      'odd-question',
      () => import('../src/question/question.define.js'),
      (e) => {
        e.question = {
          questionId: 'q',
          revision: 1,
          prompt: 'Which audience?',
          kind: 'text',
          status: 'requested',
        };
        e.capabilities = {
          respondToQuestion: { available: false, reason: 'This service asks nothing.' },
        };
      },
    );
    const submit = () => $(el, 'odd-button[type="submit"]') as HTMLButtonElement;
    expect(text($(el, '.state'))).toBe('This service asks nothing.');
    expect(($(el, 'fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect(submit().disabled).toBe(true);
    el.capabilities = {};
    await settle(el);
    expect(text($(el, '.state'))).toBe('Answers are not available here.');
    // Without capabilities the question stays usable on its own.
    el.capabilities = undefined;
    await settle(el);
    expect(($(el, 'fieldset') as HTMLFieldSetElement).disabled).toBe(false);
    expect(submit().disabled).toBe(false);
    expect($(el, '.state')!.hidden).toBe(true);
  });

  it("odd-question's default example plays the host: an answer or a skip comes back recorded", async () => {
    await import('../src/question/question.define.js');
    const { default: set } = await import('../src/question/question.examples.js');
    const answered = await mountExample(set, 'default', container);
    try {
      const el = answered.element;
      $$(el, 'input[name="choice"]')[1]!.click();
      $(el, 'odd-button[type="submit"]')!.click();
      await settle(el);
      expect(el.question).toMatchObject({ status: 'answered', answer: { choice: 'eng' } });
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
    // An answer of one's own, under a visible label: typing it chooses Other.
    const own = await mountExample(set, 'default', container);
    try {
      const el = own.element;
      const field = $(el, 'input[name="custom"]') as HTMLInputElement;
      expect(field.labels?.[0]?.querySelector('.visually-hidden')).toBeNull();
      expect(text(field.labels?.[0])).toBe('Your answer');
      $$(el, 'input[name="choice"]')[0]!.click();
      field.value = 'Designers';
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      expect(($(el, 'input[value="__other"]') as HTMLInputElement).checked).toBe(true);
      $(el, 'odd-button[type="submit"]')!.click();
      await settle(el);
      expect(el.question).toMatchObject({ status: 'answered', answer: { custom: 'Designers' } });
    } finally {
      own.dispose();
    }
    // A newer revision replaced the question: it says so and takes no answer (ADR 0049 §5).
    const replaced = await mountExample(set, 'default', container);
    try {
      const el = replaced.element;
      el.question = { ...el.question!, status: 'superseded' };
      await settle(el);
      expect(text($(el, '.state'))).toBe('This question changed. Answer the new version.');
      expect(($(el, 'fieldset') as HTMLFieldSetElement).disabled).toBe(true);
      // Withdrawn when its run ended: nothing to answer.
      el.question = { ...el.question!, status: 'cancelled' };
      await settle(el);
      expect(text($(el, '.state'))).toBe('This question was withdrawn; no answer is needed.');
      expect(($(el, 'fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    } finally {
      replaced.dispose();
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

describe('odd-activity', () => {
  it("reads the attempt's wait: the person's turn, a response on its way, then the work (ADR 0049)", async () => {
    const attempt = (extra: Partial<AttemptRecord>): AttemptRecord => ({
      attemptId: 'at',
      runId: 'r',
      conversationId: 'c',
      messageId: 'm',
      promptId: 'p',
      relation: 'new',
      status: 'streaming',
      connection: 'open',
      stop: 'none',
      ...extra,
    });
    const el = await mount(
      'odd-activity',
      () => import('../src/activity/activity.define.js'),
      (e) => {
        e.attempt = attempt({});
      },
    );
    const line = async (extra: Partial<AttemptRecord>) => {
      el.attempt = attempt(extra);
      await settle(el);
      return text($(el, '.text'));
    };
    const ap = { kind: 'approval', id: 'ap' } as const;
    expect(await line({ status: 'awaiting-input', wait: { action: [ap], submitting: [] } })).toBe(
      'Waiting for your input',
    );
    expect(await line({ wait: { action: [], submitting: [ap] } })).toBe('Sending your response…');
    expect(await line({ status: 'awaiting-input', wait: { action: [], submitting: [] } })).toBe(
      'Waiting for the assistant to continue…',
    );
    // A host's attempt without a descriptor reads from its status alone.
    expect(await line({ status: 'awaiting-input' })).toBe('Waiting for your input');
    expect(await line({})).toBe('Responding…');
  });
});

describe('the elements that act on their own or only show (contract review, 2026-11-05)', () => {
  const example = async (folder: string, name = 'default') => {
    await import(`../src/${folder}/${folder}.define.ts`);
    const { default: set } = (await import(`../src/${folder}/${folder}.examples.ts`)) as {
      default: Parameters<typeof mountExample>[0];
    };
    const mounted = await mountExample(set, name, container);
    await settle(mounted.element as unknown as { updateComplete: Promise<void> });
    return mounted;
  };

  it('the AI label shows a disclosure marker; sources show their numbers to sighted readers only', async () => {
    const removeTheme = await loadTheme();
    const label = await example('ai-label');
    try {
      // The disclosure's marker stands before the label, as Figma draws it, and turns when open.
      const disclosure = $(
        label.element,
        'odd-disclosure',
      ) as HTMLElementTagNameMap['odd-disclosure'];
      const summary = $(disclosure, '[part="summary"]')!;
      const marker = $(disclosure, '[part="marker"]')!;
      const box = (el: Element) => el.getBoundingClientRect();
      expect(box(marker).right).toBeLessThanOrEqual(box($(disclosure, '[part="label"]')!).left);
      // Closed, the label is only its summary: the disclosure draws no surface around it.
      expect(box(label.element).width).toBeCloseTo(box(summary).width, 1);
      // Figma's regular weight, even inside bold text.
      const host = label.element as HTMLElement;
      host.style.fontWeight = '700';
      expect(getComputedStyle(summary).fontWeight).toBe('400');
      host.style.removeProperty('font-weight');
      expect(marker.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      const closed = marker.innerHTML;
      disclosure.open = true;
      await settle(disclosure);
      expect(marker.innerHTML).not.toBe(closed);
      expect(disclosure.querySelector('.details')?.checkVisibility()).toBe(true);
      // The summary stays the element's `label` part for the page's styles.
      const style = document.createElement('style');
      style.textContent = 'odd-ai-label::part(label) { text-decoration-line: underline; }';
      document.head.append(style);
      try {
        expect(getComputedStyle(summary).textDecorationLine).toBe('underline');
      } finally {
        style.remove();
      }
    } finally {
      label.dispose();
      removeTheme();
    }
    const sources = await example('sources');
    try {
      const numbers = $$(sources.element, '.item > .number');
      expect(numbers.map(text)).toEqual(['1.', '2.']);
      expect(numbers.every((n) => n.getAttribute('aria-hidden') === 'true')).toBe(true);
      // Each number stands before its title, on the title's first line, on one line itself.
      const [first] = $$(sources.element, '.item');
      const box = (selector: string) => first!.querySelector(selector)!.getBoundingClientRect();
      expect(Math.round(box('.number').top)).toBe(Math.round(box('.title').top));
      expect(box('.number').right).toBeLessThanOrEqual(box('.title').left);
      expect(box('.number').height).toBeLessThanOrEqual(box('.muted').height + 1);
    } finally {
      sources.dispose();
    }
  });

  it("says what it shows: a revision's summary, an unavailable model's reason, interim text Listening", async () => {
    const artifact = await example('artifact');
    try {
      expect(text($(artifact.element, '.summary'))).toBe('Revision 2: Added highlights');
    } finally {
      artifact.dispose();
    }
    const select = await example('model-select');
    try {
      expect(
        [...$(select.element, 'select')!.querySelectorAll('option')].map((o) => text(o)),
      ).toEqual(['Fast', 'Thorough', 'Vision (unavailable: Not enabled for this workspace.)']);
    } finally {
      select.dispose();
    }
    const transcript = await example('transcript');
    try {
      expect(text($(transcript.element, '[part="interim"]'))).toBe('Listening: and add the');
    } finally {
      transcript.dispose();
    }
  });

  it("the editable transcript's host keeps each correction", async () => {
    const mounted = await example('transcript', 'editable');
    try {
      const el = mounted.element as HTMLElementTagNameMap['odd-transcript'];
      const area = $$(el, 'textarea')[1] as HTMLTextAreaElement;
      area.value = 'Invite the design team.';
      area.dispatchEvent(new Event('change', { bubbles: true }));
      await settle(el);
      expect(el.segments.map((s) => s.text)).toEqual([
        'Schedule a review for Thursday.',
        'Invite the design team.',
      ]);
    } finally {
      mounted.dispose();
    }
  });
});
