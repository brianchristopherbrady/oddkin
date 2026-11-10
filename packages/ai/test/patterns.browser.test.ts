import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import { flush } from '@oddkin/core/reactive';
import { renderComposition, validateComposition } from '@oddkin/components/composition';
import { ConversationController } from '../src/controllers/conversation.js';
import type { ConversationTransport } from '../src/contracts/types.js';

// The composition patterns (packages/ai/patterns; component-architecture-audit.md §7): each
// pattern's example renders and behaves as its page says. An example is markup and one module
// script; the test registers the elements, mounts the markup, and runs the script without its
// imports.

let container: HTMLElement | undefined;
afterEach(() => {
  container?.remove();
  container = undefined;
  flush();
});

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });

/** Waits for every Oddkin element under `root`, in shadow roots too, to render. */
async function settle(root: ParentNode): Promise<void> {
  for (let pass = 0; pass < 3; pass++) {
    flush();
    const all: Element[] = [];
    const walk = (node: ParentNode) => {
      for (const el of node.querySelectorAll('*')) {
        all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    await Promise.all(
      all.map((el) => (el as Partial<{ updateComplete: Promise<unknown> }>).updateComplete),
    );
    await frames(1);
  }
}

/** Mounts a pattern's example; `edit` may change its script first. */
async function example(id: string, edit: (script: string) => string = (s) => s) {
  const html = await commands.readFile(`packages/ai/patterns/${id}/example.html`);
  const [markup = '', rest = ''] = html.split('<script type="module">');
  container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  // Registration imports are the test's; named imports come from the modules the test loaded.
  const script = edit(
    rest
      .replace(/<\/script>\s*$/, '')
      .replace(/^\s*import '[^']+';$/gm, '')
      .replace(
        /^\s*import \{([^}]+)\} from '([^']+)';$/gm,
        (_, names: string, from: string) =>
          `const {${names}} = globalThis.__patternImports[${JSON.stringify(from)}];`,
      ),
  );
  (globalThis as { __patternImports?: unknown }).__patternImports = {
    '@oddkin/ai/announce': await import('../src/announce.js'),
    '@oddkin/ai/controllers': await import('../src/controllers/index.js'),
  };
  const url = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
  try {
    await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
  await settle(container);
  return container;
}

const $ = <T extends Element = HTMLElement>(root: ParentNode, selector: string) =>
  root.querySelector<T & Element>(selector)!;
const inner = (el: Element, selector: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const text = (el: Element | null | undefined) =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
/** The element focus is on, through shadow roots. */
const focused = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};

describe('the pattern list', () => {
  it('names a page and an example for each pattern', async () => {
    const { patterns } = JSON.parse(await commands.readFile('packages/ai/patterns/index.json')) as {
      patterns: { id: string; title: string; elements: string[] }[];
    };
    expect(patterns.map((p) => p.id)).toEqual([
      'suggested-prompts',
      'branch-navigation',
      'reasoning-disclosure',
      'copy-action',
      'empty-conversation',
      'chat-layout',
      'citations-with-sources',
      'approval-outside-a-tool-call',
      'agent-asks-then-acts',
    ]);
    for (const { id, title, elements } of patterns) {
      const page = await commands.readFile(`packages/ai/patterns/${id}/README.md`);
      expect(page.startsWith(`# ${title}\n`), id).toBe(true);
      const html = await commands.readFile(`packages/ai/patterns/${id}/example.html`);
      for (const tag of elements) expect(page + html, `${id} ${tag}`).toContain(tag);
    }
  });
});

describe('Suggested prompts', () => {
  it('fills and focuses the composer from a labelled group, and sends nothing', async () => {
    await import('@oddkin/components/define/button');
    await import('../src/prompt-input/prompt-input.define.js');
    const root = await example('suggested-prompts');
    const group = $(root, '[role="group"]');
    expect(group.getAttribute('aria-label')).toBe('Suggested prompts');
    const buttons = [...group.querySelectorAll('odd-button')];
    expect(buttons.map(text)).toEqual([
      'Summarize this document',
      'List the decisions',
      'Find open questions',
    ]);
    const input = $<HTMLElementTagNameMap['odd-prompt-input']>(root, 'odd-prompt-input');
    const sent = vi.fn();
    input.addEventListener('odd-prompt-submit', sent);
    await userEvent.click(buttons[1]!);
    await settle(root);
    expect(input.value).toBe('List the decisions this document records.');
    expect(focused()?.localName).toBe('textarea');
    expect(sent).not.toHaveBeenCalled();
  });
});

describe('Branch navigation', () => {
  it('names its group and buttons, shows the position, and asks the host to switch', async () => {
    await import('@oddkin/components/define/button');
    const root = await example('branch-navigation');
    const group = $(root, '[role="group"]');
    expect(group.getAttribute('aria-label')).toBe('Versions');
    expect(text($(group, '.position'))).toBe('Version 2 of 3');
    const [previous, next] = [...group.querySelectorAll('odd-button')];
    expect(inner(previous!, 'button').getAttribute('aria-label')).toBe('Previous version');
    expect(inner(next!, 'button').getAttribute('aria-label')).toBe('Next version');
    const switches: unknown[] = [];
    root.addEventListener('odd-branch-switch', (e) => switches.push((e as CustomEvent).detail));
    await userEvent.click(next!);
    expect(switches).toEqual([{ messageId: 'm2', targetMessageId: 'm2c' }]);
  });

  it('disables the button at an end', async () => {
    await import('@oddkin/components/define/button');
    const root = await example('branch-navigation', (script) =>
      script.replace("index: 2, count: 3, previousId: 'm2a'", 'index: 1, count: 3'),
    );
    const [previous, next] = [
      ...root.querySelectorAll<HTMLElement & { disabled: boolean }>('odd-button'),
    ];
    expect(text($(root, '.position'))).toBe('Version 1 of 3');
    expect([previous!.disabled, next!.disabled]).toEqual([true, false]);
  });
});

describe('Reasoning disclosure', () => {
  it('starts closed under its name and opens to the rendered reasoning', async () => {
    await import('@oddkin/components/define/disclosure');
    await import('../src/response/response.define.js');
    const root = await example('reasoning-disclosure');
    const disclosure = $<HTMLElementTagNameMap['odd-disclosure']>(root, 'odd-disclosure');
    const response = $(disclosure, 'odd-response');
    expect(text(inner(disclosure, '[part="summary"]'))).toBe('Reasoning');
    expect(disclosure.open).toBe(false);
    expect(response.checkVisibility()).toBe(false);
    await userEvent.click(inner(disclosure, '[part="summary"]'));
    await settle(root);
    expect(disclosure.open).toBe(true);
    expect(response.checkVisibility()).toBe(true);
    expect(text(inner(response, 'strong'))).toBe('two');
  });
});

describe('Copy action', () => {
  const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const copied: string[] = [];
  const stub = () =>
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (value: string) => void copied.push(value) },
      configurable: true,
    });
  afterEach(() => {
    copied.length = 0;
    if (own) Object.defineProperty(navigator, 'clipboard', own);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it('copies the canonical answer, and text shown on the page', async () => {
    await import('@oddkin/components/define/copy-button');
    stub();
    const root = await example('copy-action');
    const [answer, command] = [...root.querySelectorAll('odd-copy-button')];
    expect(text(inner(answer!, 'button'))).toBe('Copy answer');
    await userEvent.click(inner(answer!, 'button'));
    await userEvent.click(inner(command!, 'button'));
    expect(copied).toEqual([
      'Use **one** `renderers` object for every element.',
      'npm install @oddkin/ai',
    ]);
  });

  it('renders the same command button from its composition document', async () => {
    await import('@oddkin/components/define/copy-button');
    stub();
    const doc = JSON.parse(
      await commands.readFile('packages/ai/patterns/copy-action/composition.json'),
    );
    expect(validateComposition(doc).diagnostics).toEqual([]);
    container = document.createElement('div');
    document.body.append(container);
    const actions: string[] = [];
    const result = renderComposition(doc, container, {
      allow: ['div', 'span', 'odd-copy-button'],
      onAction: ({ action }) => actions.push(action),
    });
    expect(result.ok).toBe(true);
    await settle(container);
    const button = $(container, 'odd-copy-button');
    expect(text(inner(button, 'button'))).toBe('Copy command');
    await userEvent.click(inner(button, 'button'));
    await settle(container);
    expect(copied).toEqual(['npm install @oddkin/ai']);
    expect(actions).toEqual(['command.copied']);
    result.dispose();
  });
});

describe('Empty conversation', () => {
  it('shows the empty state until the first message, and its prompts fill the composer', async () => {
    await import('@oddkin/components/define/button');
    await import('@oddkin/components/define/empty-state');
    await import('../src/conversation/conversation.define.js');
    await import('../src/prompt-input/prompt-input.define.js');
    const root = await example('empty-conversation');
    const conversation = $<HTMLElementTagNameMap['odd-conversation']>(root, 'odd-conversation');
    const empty = $(root, 'odd-empty-state');
    expect(empty.checkVisibility()).toBe(true);
    expect(text(inner(empty, '[part="label"]'))).toBe('Ask about your documents');
    expect($(empty, '[role="group"]').getAttribute('aria-label')).toBe('Suggested prompts');
    await userEvent.click($(empty, 'odd-button'));
    await settle(root);
    expect($<HTMLElementTagNameMap['odd-prompt-input']>(root, 'odd-prompt-input').value).toBe(
      'Summarize this document in five points.',
    );
    const transport: ConversationTransport = {
      capabilities: {},
      send: async () => undefined,
      stop: async () => 'cancelled',
      decide: async () => 'accepted',
    };
    const controller = new ConversationController({ transport, conversationId: 'c' });
    controller.load({
      conversationId: 'c',
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', id: 't1', text: 'Hello' }] }],
    });
    conversation.store = controller;
    await settle(root);
    expect(empty.checkVisibility()).toBe(false);
  });
});

describe('Chat layout', () => {
  it('orders the panes, names the separator and the side region, and stacks when narrow', async () => {
    await import('@oddkin/components/define/split-panel');
    await import('../src/conversation/conversation.define.js');
    await import('../src/prompt-input/prompt-input.define.js');
    await import('../src/sources/sources.define.js');
    const root = await example('chat-layout');
    const layout = $<HTMLElementTagNameMap['odd-split-panel']>(root, 'odd-split-panel');
    expect([...layout.children].map((child) => child.getAttribute('slot'))).toEqual([
      'start',
      'end',
    ]);
    expect($(layout, '[slot="end"]').getAttribute('aria-label')).toBe('Sources');
    const separator = inner(layout, '[part="separator"]');
    expect(separator.getAttribute('aria-label')).toBe('Resize conversation');
    // Wide: side by side, and the arrow keys move the separator.
    root.style.inlineSize = '60rem';
    await frames(3);
    expect(layout.orientation).toBe('horizontal');
    separator.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await settle(root);
    expect(separator.getAttribute('aria-valuenow')).toBe('64');
    // Narrow: stacked, the conversation on top.
    root.style.inlineSize = '30rem';
    await frames(3);
    expect(layout.orientation).toBe('vertical');
  });
});

describe('Citations with sources', () => {
  it('names its markers, opens and closes their previews, and reveals a source in the list', async () => {
    await import('../src/response/response.define.js');
    await import('../src/sources/sources.define.js');
    const root = await example('citations-with-sources');
    const response = $(root, 'odd-response');
    const markers = [...response.shadowRoot!.querySelectorAll('odd-citation')];
    const triggers = markers.map((marker) => inner(marker, '[part="trigger"]'));
    expect(triggers.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Source 1: Annual report',
      'Source 2: Customer survey',
    ]);
    // From the keyboard (WebKit does not focus a button that is clicked).
    triggers[1]!.focus();
    await userEvent.keyboard('{Enter}');
    await settle(root);
    expect(triggers[1]!.getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{Escape}');
    await settle(root);
    expect(triggers[1]!.getAttribute('aria-expanded')).toBe('false');
    expect(focused()).toBe(triggers[1]);
    await userEvent.click(triggers[0]!);
    await settle(root);
    const show = [...markers[0]!.shadowRoot!.querySelectorAll('button')].find(
      (b) => text(b) === 'Show in sources',
    )!;
    await userEvent.click(show);
    await settle(root);
    expect(text(focused())).toContain('Annual report');
  });
});

describe('Approval outside a tool call', () => {
  it('asks once for the shown revision and the chosen scope, then shows what the host accepted and moves focus to it', async () => {
    await import('../src/action-approval/action-approval.define.js');
    const root = await example('approval-outside-a-tool-call');
    const approval = $<HTMLElementTagNameMap['odd-action-approval']>(root, 'odd-action-approval');
    expect(inner(approval, '[part="base"]').getAttribute('role')).toBe('group');
    // The surface's announcer owns one polite and one assertive region.
    expect($(root, '.approval-panel').querySelectorAll('[aria-live]')).toHaveLength(2);
    const decisions: unknown[] = [];
    approval.addEventListener('odd-approval-decide', (e) =>
      decisions.push((e as CustomEvent).detail),
    );
    // The host's default is the narrower scope; the person chooses the wider one.
    const scopes = [...approval.shadowRoot!.querySelectorAll<HTMLInputElement>('[name="scope"]')];
    expect(scopes.map((input) => [input.value, input.checked])).toEqual([
      ['once', true],
      ['release', false],
    ]);
    await userEvent.click(scopes[1]!);
    await settle(root);
    const approve = [...approval.shadowRoot!.querySelectorAll('odd-button')].find(
      (b) => text(b) === 'Approve',
    )!;
    // From the keyboard: WebKit does not focus a button that is clicked, and focus follows only
    // a control that had it.
    inner(approve, 'button').focus();
    await userEvent.keyboard('{Enter}');
    await settle(root);
    expect(decisions).toEqual([
      expect.objectContaining({ decision: 'approve', revision: 1, scope: 'release' }),
    ]);
    expect(approval.approval?.status).toBe('approved');
    const shown = [...approval.shadowRoot!.querySelectorAll('odd-button')].filter((b) =>
      b.checkVisibility(),
    );
    expect(shown.map(text)).not.toContain('Approve');
    expect(text(focused())).toContain('Approved');
    expect(text(inner(approval, '[part="scope"]'))).toContain(
      'Approved scope: Release emails today',
    );
  });
});

describe('Agent asks, then acts', () => {
  it('asks first, then proposes the action the answer shaped after the question; each response is bound to its revision', async () => {
    await import('../src/conversation/conversation.define.js');
    const root = await example('agent-asks-then-acts');
    const conversation = $(root, 'odd-conversation');
    const message = () =>
      [...conversation.shadowRoot!.querySelectorAll('[part="feed"] > odd-message')].at(-1)!;
    const question = inner(message(), 'odd-question');
    expect(text(question.shadowRoot!.querySelector('legend'))).toBe('Where should I post it?');
    expect(message().shadowRoot!.querySelector('odd-action-approval')).toBeNull();
    const sent: [string, unknown][] = [];
    for (const type of ['odd-question-answer', 'odd-approval-decide'])
      root.addEventListener(type, (e) => sent.push([type, (e as CustomEvent).detail]));
    question.shadowRoot!.querySelectorAll<HTMLInputElement>('input[name="choice"]')[0]!.click();
    (question.shadowRoot!.querySelector('odd-button[type="submit"]') as HTMLElement).click();
    await settle(root);
    expect(text(question.shadowRoot!.querySelector('.outcome'))).toBe('Answered.');
    const approval = inner(message(), 'odd-action-approval');
    expect(question.compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(text(approval.shadowRoot!.querySelector('.title'))).toBe(
      'Post the release summary to #releases',
    );
    (approval.shadowRoot!.querySelector('odd-button[appearance="primary"]') as HTMLElement).click();
    await settle(root);
    expect(sent).toEqual([
      [
        'odd-question-answer',
        { questionId: 'channel', revision: 1, answer: { choice: 'releases' } },
      ],
      ['odd-approval-decide', expect.objectContaining({ approvalId: 'post', revision: 1 })],
    ]);
    expect(text(approval.shadowRoot!.querySelector('.outcome'))).toContain('Approved');
  });
});
