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

/** The margin boxes (what flex lays out) of the in-flow boxes a region arranges; a slot stands for what it shows. */
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
    .map((el) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const [top, right, bottom, left] = ['Top', 'Right', 'Bottom', 'Left'].map((side) =>
        parseFloat(style.getPropertyValue(`margin-${side.toLowerCase()}`)),
      ) as [number, number, number, number];
      return new DOMRect(
        box.x - left,
        box.y - top,
        box.width + left + right,
        box.height + top + bottom,
      );
    })
    .filter((box) => box.width > 0 || box.height > 0);
}

/** Rows that lay out text directly: the text's box counts as an item. */
function itemsWithText(region: Element): DOMRect[] {
  const range = document.createRange();
  const text = [...region.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim())
    .map((node) => {
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    });
  return [...items(region), ...text].sort((a, b) => a.left - b.left);
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
  {
    align = 'center',
    justify,
    text,
  }: {
    align?: 'center' | 'stretch' | 'baseline' | 'unseen';
    justify?: 'center';
    text?: boolean;
  } = {},
) {
  const boxes = text ? itemsWithText(region) : items(region);
  expect(boxes.length, 'items').toBeGreaterThan(1);
  const line = boxes.filter((box) => box.top < boxes[0]!.bottom);
  expect(line.length, 'items on the first line').toBeGreaterThan(1);
  expect(line.slice(1).map((box, i) => round(box.left - line[i]!.right))).toEqual(
    line.slice(1).map(() => round(gap)),
  );
  // Items of different natural heights, so the alignment shows ('unseen': the items share one).
  if (align === 'center' || align === 'baseline') {
    expect(new Set(line.map((box) => Math.round(box.height))).size, 'heights').toBeGreaterThan(1);
    const at = align === 'center' ? middle : (box: DOMRect) => round(box.top);
    // Within a pixel: a text item is measured by its glyphs, not its line box.
    for (const box of line) expect(Math.abs(at(box) - at(line[0]!))).toBeLessThanOrEqual(1);
  } else if (align === 'stretch')
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

// The second batch mounts each element with its documented example's props and slots.
type ExampleSet = {
  examples: Record<string, { props?: Record<string, unknown>; slots?: Record<string, string> }>;
};
const exampleSets = import.meta.glob<ExampleSet>('../src/*/*.examples.ts', { import: 'default' });
const definitions = import.meta.glob('../src/*/*.define.ts');
async function example<E extends Updating>(
  name: string,
  key = 'default',
  change: (props: Record<string, unknown>) => Record<string, unknown> = (props) => props,
): Promise<E> {
  const set = await exampleSets[`../src/${name}/${name}.examples.ts`]!();
  const { props = {}, slots = {} } = set.examples[key]!;
  const children = Object.entries(slots)
    .map(([slot, text]) => `<span slot="${slot}">${text}</span>`)
    .join('');
  return mount<E>(
    `odd-${name}`,
    definitions[`../src/${name}/${name}.define.ts`]!,
    (el) => Object.assign(el, change(props)),
    children,
  );
}
const settle = async (el: Updating) => {
  await el.updateComplete;
  flush();
  await frames();
};

describe('odd-action-approval', () => {
  it('stacks the card and its changes; each change is a row that wraps', async () => {
    const el = await example('action-approval', 'default', (props) => ({
      ...props,
      approval: {
        ...(props['approval'] as object),
        changes: [
          { label: 'Subject', before: 'Draft', after: 'Release 2.0' },
          { label: 'To', before: 'Me', after: 'The whole team' },
        ],
      },
    }));
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.changes'), space('2xs'));
    const change = $(el, '.change');
    expectRow(change, space('xs'), { align: 'stretch' });
    expectColumn($(el, '.reason'), space('2xs'));
    // The shared action row wraps: the reason takes a line of its own above the buttons.
    const [reason, ...buttons] = items($(el, '.actions'));
    expect(buttons.every((box) => box.top >= reason!.bottom)).toBe(true);
    await expectWraps(change, '7rem');
  });
});

describe('odd-change-review', () => {
  it('stacks the proposals and their parts; a split diff fits 14rem columns', async () => {
    const el = await example('change-review', 'default', (props) => {
      const [first] = props['proposals'] as Record<string, unknown>[];
      return {
        ...props,
        proposals: [first, { ...first, proposalId: 'p2', label: 'Shorter' }],
        view: 'split',
      };
    });
    expectColumn($(el, '.list'), space('sm'));
    expectColumn($(el, '.proposal'), space('xs'));
    const split = $(el, '.split');
    expectRow(split, space('sm'), { align: 'stretch' });
    container.style.inlineSize = '20rem';
    await frames();
    expectColumn(split, space('sm'));
  });
});

describe('odd-checkpoint', () => {
  it('stacks the card and the restore confirmation', async () => {
    const el = await example('checkpoint');
    expectColumn($(el, '.base'), space('xs'));
    $(el, '.actions odd-button').click();
    await settle(el);
    expectColumn($(el, '.confirm'), space('xs'));
  });
});

describe('odd-context-picker', () => {
  it('stacks the items; an item is a centred row that wraps; the URL form is a row', async () => {
    const el = await example('context-picker');
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.list'), space('2xs'));
    const row = $(el, '.row');
    expectRow(row, space('xs'));
    expectRow($(el, '.url'), space('2xs'), { align: 'stretch' });
    await expectWraps(row, '8rem');
    // The URL field keeps its own width, so the button moves under it.
    await expectWraps($(el, '.url'), '14rem');
  });
});

describe('odd-inline-assist', () => {
  it('stacks toolbar and result; the toolbar is a row that wraps', async () => {
    const el = await example('inline-assist', 'result');
    expectColumn($(el, '.base'), space('xs'));
    const toolbar = $(el, '.toolbar');
    expectRow(toolbar, space('2xs'), { align: 'stretch' });
    await expectWraps(toolbar, '8rem');
  });

  it('lines up the language label and its choice', async () => {
    const el = await example('inline-assist', 'default', (props) => ({
      ...props,
      languages: [
        { id: 'en', label: 'English' },
        { id: 'fr', label: 'French' },
      ],
    }));
    const language = $(el, '.language');
    expectRow(language, space('xs'));
    await expectWraps(language, '5rem');
  });
});

describe('odd-prompt-input', () => {
  it('lines up the toolbar and each attachment in centred rows that wrap; issues stack', async () => {
    const el = await example<Updating & { activeController: { addFiles(files: File[]): void } }>(
      'prompt-input',
      'default',
      (props) => ({ ...props, accept: 'image/*' }),
    );
    el.activeController.addFiles(
      ['a.png', 'b.png'].map((name) => new File(['x'], name, { type: 'image/png' })),
    );
    // Refused files are reported through the file input, as a user picks them.
    const files = new DataTransfer();
    for (const name of ['c.txt', 'd.txt'])
      files.items.add(new File(['x'], name, { type: 'text/plain' }));
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
    input.files = files.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(el);
    const toolbar = $(el, '.toolbar');
    expectRow(toolbar, space('xs'));
    expectRow($(el, '.attachments'), space('xs'), { align: 'stretch' });
    expectRow($(el, '.attachment'), space('2xs'));
    expectColumn($(el, '.issues'), space('xs'));
    await expectWraps(toolbar, '6rem');
    await expectWraps($(el, '.attachments'), '6rem');
    await expectWraps($(el, '.attachment'), '6rem');
  });
});

describe('odd-question', () => {
  it('stacks the form and the options; an option is a centred row', async () => {
    const el = await example('question');
    expectColumn($(el, '.form'), space('xs'));
    expectColumn($(el, '.options'), space('2xs'));
    expectRow($(el, '.option'), space('xs'));
  });

  it('stacks each field', async () => {
    const el = await example('question', 'form');
    expectColumn($(el, '.field'), space('2xs'));
  });
});

describe('odd-response-feedback', () => {
  it('lines up the rating actions', async () => {
    const el = await example('response-feedback');
    expectRow($(el, '.actions'), space('xs'), { align: 'unseen' });
  });

  it('centres the outcome beside the rating actions', async () => {
    const el = await example('response-feedback', 'negative', (props) => ({
      ...props,
      feedback: { messageId: 'm2', rating: 'negative', status: 'submitted' },
    }));
    expectRow($(el, '.actions'), space('xs'));
  });

  it('stacks the reasons form; a reason is a centred row', async () => {
    const el = await example('response-feedback', 'negative');
    $(el, '[data-rating="negative"]').click();
    await settle(el);
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.form'), space('xs'));
    expectRow($(el, '.check'), space('xs'), { text: true });
    expectColumn($(el, '.field'), space('2xs'));
  });
});

describe('odd-task-plan', () => {
  it('stacks the plan, its steps and tasks; a step and a task sit on the baseline', async () => {
    const el = await example('task-plan');
    expectColumn($(el, '.base'), space('sm'));
    const progress = $(el, '.progress');
    expectRow(progress, space('xs'));
    expectColumn($(el, '.steps'), space('xs'));
    expectColumn($(el, '.tasks'), space('xs'));
    expectRow($(el, '.step'), space('xs'), { align: 'baseline' });
    // A task's symbol, title, and status are one line each.
    expectRow($(el, '.task'), space('xs'), { align: 'unseen' });
    expectColumn($(el, '.body'), 2);
    await expectWraps(progress, '10rem');
  });
});

describe('odd-tool-call', () => {
  it('lines up the summary and the failure in centred rows that wrap', async () => {
    const el = await example('tool-call', 'failed');
    const summary = $(el, '.summary');
    expectRow(summary, space('xs'));
    expectRow($(el, '.failure'), space('xs'));
    await expectWraps(summary, '8rem');
    await expectWraps($(el, '.failure'), '8rem');
  });

  it('stacks the arguments and the result', async () => {
    const el = await example('tool-call');
    el.shadowRoot!.querySelector('details')!.open = true;
    await settle(el);
    expectColumn($(el, '.body'), space('xs'));
  });
});

describe('odd-usage-meter', () => {
  it('stacks the entries', async () => {
    const el = await example('usage-meter');
    expectColumn($(el, '.list'), space('xs'));
  });
});

describe('odd-voice-input', () => {
  it('stacks the record button and its status', async () => {
    // Without an adapter it says that voice input is unsupported.
    const el = await example('voice-input', 'default', () => ({}));
    expectColumn($(el, '.base'), space('xs'));
  });
});
