import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@oddkin/core/reactive';

// The arrangements of the AI elements' layout recipes (layout-recipes.md §14), measured from the
// rendered boxes with the default theme: direction and gap, alignment, justification, wrapping.

let theme: HTMLLinkElement;
beforeAll(async () => {
  theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  await new Promise((resolve, reject) => {
    theme.onload = resolve;
    theme.onerror = reject;
    document.head.append(theme);
  });
});
afterAll(() => theme.remove());

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  container.style.inlineSize = '40rem';
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const frames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

type Updating = HTMLElement & { updateComplete: Promise<void> };
async function mount<E extends Updating>(
  tag: string,
  define: () => Promise<unknown>,
  setup: (el: E) => void,
  children = '',
): Promise<E> {
  await define();
  const el = document.createElement(tag) as E;
  setup(el);
  el.innerHTML = children;
  container.append(el);
  await el.updateComplete;
  flush();
  await frames();
  return el;
}
const $ = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;

/** A space token in pixels. */
function space(name: string): number {
  const probe = container.appendChild(document.createElement('div'));
  probe.style.blockSize = `var(--odd-space-${name})`;
  const size = probe.getBoundingClientRect().height;
  probe.remove();
  return size;
}

/** The in-flow boxes a region arranges; a slot stands for what it shows. */
function items(region: Element): DOMRect[] {
  const elements = [...region.children].flatMap((child) => {
    if (!(child instanceof HTMLSlotElement)) return [child];
    const assigned = child.assignedElements({ flatten: true });
    return assigned.length ? assigned : [...child.children];
  });
  return elements
    .filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== 'none' && !/absolute|fixed/.test(style.position);
    })
    .map((el) => el.getBoundingClientRect())
    .filter((box) => box.width > 0 || box.height > 0);
}
const round = (n: number) => Math.round(n * 2) / 2;
const middle = (box: DOMRect) => round(box.top + box.height / 2);

/** Each item under the previous one, `gap` apart. */
function expectColumn(region: Element, gap: number) {
  const boxes = items(region);
  expect(boxes.length, 'items').toBeGreaterThan(1);
  expect(boxes.slice(1).map((box, i) => round(box.top - boxes[i]!.bottom))).toEqual(
    boxes.slice(1).map(() => round(gap)),
  );
}

/** The first items side by side on one line, `gap` apart and aligned as asked. */
function expectRow(
  region: Element,
  gap: number,
  { align = 'center', justify }: { align?: 'center' | 'stretch'; justify?: 'center' } = {},
) {
  const boxes = items(region);
  expect(boxes.length, 'items').toBeGreaterThan(1);
  const line = boxes.filter((box) => box.top < boxes[0]!.bottom);
  expect(line.length, 'items on the first line').toBeGreaterThan(1);
  expect(line.slice(1).map((box, i) => round(box.left - line[i]!.right))).toEqual(
    line.slice(1).map(() => round(gap)),
  );
  // Items of different natural heights, so the alignment shows.
  if (align === 'center') {
    expect(new Set(line.map((box) => Math.round(box.height))).size, 'heights').toBeGreaterThan(1);
    expect(line.map(middle)).toEqual(line.map(() => middle(line[0]!)));
  } else
    expect(line.map((box) => round(box.height))).toEqual(line.map(() => round(line[0]!.height)));
  if (justify === 'center') {
    const box = region.getBoundingClientRect();
    const style = getComputedStyle(region);
    const start = line[0]!.left - box.left - parseFloat(style.paddingLeft);
    const end = box.right - parseFloat(style.paddingRight) - line.at(-1)!.right;
    expect(start, 'centred').toBeGreaterThan(1);
    expect(round(start)).toBe(round(end));
  }
}

/** In a narrow container the row breaks onto a new line and stays inside the region. */
async function expectWraps(region: Element, inlineSize: string) {
  container.style.inlineSize = inlineSize;
  await frames();
  const boxes = items(region);
  const right = region.getBoundingClientRect().right;
  expect(boxes.at(-1)!.top, 'last item on a new line').toBeGreaterThanOrEqual(boxes[0]!.bottom);
  expect(boxes.every((box) => box.right <= right + 0.5)).toBe(true);
}

const conversation = (messages: unknown[], more: Record<string, unknown> = {}) => ({
  conversationId: 'c1',
  revision: 1,
  messages,
  tools: {},
  approvals: {},
  artifacts: {},
  attempts: {},
  branches: {},
  capabilities: {},
  history: 'complete',
  hasMoreHistory: false,
  feedback: {},
  ...more,
});
const text = (id: string, role: string, value: string) => ({
  id,
  role,
  parts: [{ type: 'text', id: `${id}-t`, text: value }],
});

describe('odd-conversation', () => {
  const define = () => import('../src/conversation/conversation.define.js');

  it('stacks the scroller, status, and composer; the feed stacks its messages', async () => {
    const el = await mount<Updating & { state: unknown }>(
      'odd-conversation',
      define,
      (e) => {
        e.state = conversation([
          text('m1', 'user', 'Summarize the release notes.'),
          text('m2', 'assistant', 'Builds are faster.'),
        ]);
      },
      '<div slot="status">Connected</div><textarea slot="composer"></textarea>',
    );
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.feed'), space('lg'));
  });

  it('centres the history row, which wraps', async () => {
    const el = await mount<Updating & { state: unknown }>('odd-conversation', define, (e) => {
      e.state = conversation([text('m1', 'user', 'Hello')], {
        history: 'error',
        hasMoreHistory: true,
        capabilities: { history: { available: true } },
      });
    });
    const history = $(el, '.history');
    expectRow(history, space('xs'), { align: 'stretch', justify: 'center' });
    await expectWraps(history, '9rem');
  });

  it('centres the empty row, which wraps', async () => {
    const el = await mount<Updating & { state: unknown }>(
      'odd-conversation',
      define,
      (e) => {
        e.state = conversation([]);
      },
      '<span slot="empty">Ask a question to start.</span><button slot="empty">Start</button>',
    );
    const empty = $(el, '.empty');
    expectRow(empty, space('xs'), { align: 'stretch', justify: 'center' });
    await expectWraps(empty, '9rem');
  });
});

describe('odd-message', () => {
  const define = () => import('../src/message/message.define.js');
  type Message = Updating & { message: unknown; capabilities: unknown };

  it('stacks header, content, and footer; the header is a centred row that wraps', async () => {
    const el = await mount<Message>('odd-message', define, (e) => {
      e.message = {
        id: 'm2',
        role: 'assistant',
        parts: [
          { type: 'text', id: 't1', text: 'Use a container query.' },
          { type: 'text', id: 't2', text: 'Then size the card by its container.' },
        ],
        provenance: { kind: 'generated', model: 'Example model' },
      };
    });
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.content'), space('sm'));
    const header = $(el, '.header');
    expectRow(header, space('xs'));
    await expectWraps(header, '5rem');
  });

  it('keeps a user message to its text, at the start', async () => {
    const el = await mount<Message>('odd-message', define, (e) => {
      e.message = text('m1', 'user', 'Hi');
    });
    const base = $(el, '.base').getBoundingClientRect();
    const content = $(el, '.content').getBoundingClientRect();
    expect([content.left, content.width < base.width / 2]).toEqual([base.left, true]);
  });

  it('stacks the edit form', async () => {
    const el = await mount<Message>('odd-message', define, (e) => {
      e.message = text('m1', 'user', 'Hi');
      e.capabilities = { edit: { available: true } };
    });
    $(el, '[data-action="edit"]').click();
    await el.updateComplete;
    flush();
    await frames();
    expectColumn($(el, '.edit'), space('xs'));
  });
});

describe('odd-transcript', () => {
  it('stacks the final segments', async () => {
    const el = await mount<Updating & { segments: unknown }>(
      'odd-transcript',
      () => import('../src/transcript/transcript.define.js'),
      (e) => {
        e.segments = [
          { id: 'a', text: 'Schedule a review for Thursday.', final: true },
          { id: 'b', text: 'Invite the design team.', final: true },
        ];
      },
    );
    expectColumn($(el, '.list'), space('2xs'));
  });
});

describe('odd-activity', () => {
  it('lines up the indicator, text, and actions in a centred row that wraps', async () => {
    const el = await mount<Updating & { attempt: unknown; capabilities: unknown }>(
      'odd-activity',
      () => import('../src/activity/activity.define.js'),
      (e) => {
        e.attempt = {
          attemptId: 'at1',
          runId: 'run1',
          conversationId: 'c1',
          messageId: 'm2',
          promptId: 'm1',
          relation: 'new',
          connection: 'open',
          stop: 'none',
          status: 'streaming',
        };
        e.capabilities = { stop: { available: true } };
      },
    );
    const base = $(el, '.base');
    expectRow(base, space('xs'));
    await expectWraps(base, '6rem');
  });
});

describe('odd-sources', () => {
  it('stacks the items, and each item’s title, host, and excerpt', async () => {
    const source = (id: string) => ({
      type: 'source',
      id,
      sourceId: id,
      title: `Source ${id}`,
      url: `https://example.com/${id}`,
      excerpt: 'An excerpt of the source.',
    });
    const el = await mount<Updating & { sources: unknown }>(
      'odd-sources',
      () => import('../src/sources/sources.define.js'),
      (e) => {
        e.sources = [source('a'), source('b')];
      },
    );
    expectColumn($(el, '.list'), space('xs'));
    expectColumn($(el, '.item'), 2);
  });
});

describe('odd-citation', () => {
  it('stacks the preview', async () => {
    const el = await mount<Updating & { sourceId: string; index: number; source: unknown }>(
      'odd-citation',
      () => import('../src/citation/citation.define.js'),
      (e) => {
        e.sourceId = 'wcag';
        e.index = 1;
        e.source = {
          type: 'source',
          id: 's1',
          sourceId: 'wcag',
          title: 'Web Content Accessibility Guidelines 2.2',
          url: 'https://www.w3.org/TR/WCAG22/',
          excerpt: 'Content can be presented without loss of information at 320 CSS pixels.',
        };
      },
    );
    $(el, '.trigger').click();
    await el.updateComplete;
    flush();
    await frames();
    expectColumn($(el, '.preview'), space('2xs'));
  });
});

describe('odd-suggestions', () => {
  it('lines up the suggestions in a row that wraps', async () => {
    const el = await mount<Updating & { suggestions: unknown }>(
      'odd-suggestions',
      () => import('../src/suggestions/suggestions.define.js'),
      (e) => {
        e.suggestions = [
          { id: 'summarize', label: 'Summarize', prompt: 'Summarize this page.' },
          { id: 'risks', label: 'List risks', prompt: 'What are the risks?' },
        ];
      },
    );
    const list = $(el, '.list');
    expectRow(list, space('xs'), { align: 'stretch' });
    await expectWraps(list, '10rem');
  });
});

describe('odd-artifact', () => {
  it('stacks header, summary, and view; the header is a centred row that wraps', async () => {
    const el = await mount<Updating & { artifact: unknown; view: string }>(
      'odd-artifact',
      () => import('../src/artifact/artifact.define.js'),
      (e) => {
        e.artifact = {
          artifactId: 'a1',
          title: 'Release notes',
          kind: 'markdown',
          currentRevisionId: 'r2',
          revisions: [
            { revisionId: 'r1', number: 1, content: '# Release notes' },
            { revisionId: 'r2', number: 2, summary: 'Highlights', content: '- Faster builds' },
          ],
        };
        e.view = 'source';
      },
    );
    expectColumn($(el, '.base'), space('xs'));
    const header = $(el, '.header');
    expectRow(header, space('xs'));
    await expectWraps(header, '12rem');
  });
});
