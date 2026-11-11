import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
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
    const heights = new Set(line.map((box) => Math.round(box.height)));
    // Some fonts give every item one height (Linux CI, DejaVu Sans): then read the alignment.
    if (heights.size === 1)
      expect(getComputedStyle(region).alignItems, 'alignment').toContain(align);
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

// Linux CI's DejaVu Sans is much wider than Segoe UI, so a narrow system font can hide a row that
// overflows (2026-10-28: odd-inline-assist's language row). Wrapping is measured in a wide font.
const wide = new CSSStyleSheet();
wide.replaceSync(':root { --odd-font-family-sans: Verdana, "DejaVu Sans", sans-serif; }');

/** In a narrow container, in a wide font, the row breaks onto a new line and stays inside the region. */
async function expectWraps(region: Element, inlineSize: string) {
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, wide];
  try {
    container.style.inlineSize = inlineSize;
    await frames();
    const boxes = items(region);
    const right = region.getBoundingClientRect().right;
    expect(boxes.at(-1)!.top, 'last item on a new line').toBeGreaterThanOrEqual(boxes[0]!.bottom);
    expect(
      boxes.map((box) => Math.max(0, Math.round(box.right - right))),
      'overflow',
    ).toEqual(boxes.map(() => 0));
    // A form control does not shrink with the item that holds it unless its styles let it.
    const controls = [...region.querySelectorAll('select, input, textarea, button')]
      .filter((control) => control.getClientRects().length)
      .map((control) => Math.max(0, Math.round(control.getBoundingClientRect().right - right)));
    expect(controls, 'control overflow').toEqual(controls.map(() => 0));
  } finally {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== wide);
  }
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
  // The largest module graph here (every element a message can show): load it before the
  // tests, outside their time limit, so a busy machine cannot time out the first one.
  beforeAll(define, 60_000);

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
    // space.md between the messages, as the Figma specimen spaces them.
    expectColumn($(el, '.feed'), space('md'));
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
    // space.sm between the status and its actions, as the Figma specimen spaces them.
    expectRow(base, space('sm'));
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
    // As the Figma specimen: the number before the source, whose title and host share a line
    // (the host is smaller text, so its baseline alignment shows in the computed style only).
    expectRow($(el, '.item'), space('sm'), { align: 'unseen' });
    expect(getComputedStyle($(el, '.item')).alignItems).toContain('start');
    expectColumn($(el, '.source'), space('xs'));
    expectRow($(el, '.line'), space('sm'), { align: 'unseen' });
    expect(getComputedStyle($(el, '.line')).alignItems).toContain('baseline');
  });
});

describe('odd-citation', () => {
  it('stacks the allocated inline preview', async () => {
    const el = await mount<
      Updating & { sourceId: string; index: number; source: unknown; presentation: string }
    >(
      'odd-citation',
      () => import('../src/citation/citation.define.js'),
      (e) => {
        e.presentation = 'inline';
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
    // As the Figma specimen: the identity, excerpt, and actions space.sm apart; title over host.
    expectColumn($(el, '.preview'), space('sm'));
    expectColumn($(el, '.identity'), space('2xs'));
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
    // As the Figma specimen: the title and revision space.sm apart; the actions, then the view
    // choice at the end of the next row.
    const header = $(el, '.header');
    expectRow(header, space('sm'));
    expect(getComputedStyle($(el, '.toolbar')).justifyContent).toBe('space-between');
    expectRow($(el, '.toolbar > .actions'), space('xs'));
    expectRow($(el, '.view'), space('sm'));
    // Last: the container stays narrow after it, where the toolbar's rows wrap in a wide font.
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
  it("stacks the card, its changes, and each change's label and lines", async () => {
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
    // space.xs, as the Figma specimen spaces the card's parts and the before and after lines.
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.changes'), space('xs'));
    expectColumn($(el, '.change'), space('xs'));
    // The reason sits above the decision row (Figma page 08), whose buttons share a line.
    const reason = $(el, '.reason')!.getBoundingClientRect();
    const buttons = items($(el, '.actions'));
    expect(buttons.every((box) => box.top >= reason.bottom)).toBe(true);
    expect(new Set(buttons.map((box) => box.top)).size).toBe(1);
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
    // As the Figma specimen: side by side, the two sides are cards space.xs apart, each label
    // space.xs above its text, and a proposal's parts space.sm apart; proposals space.lg apart.
    expectColumn($(el, '.list'), space('lg'));
    expectColumn($(el, '.proposal .body'), space('sm'));
    expectColumn($(el, '.side'), space('xs'));
    const split = $(el, '.split');
    expectRow(split, space('xs'), { align: 'stretch' });
    container.style.inlineSize = '20rem';
    await frames();
    expectColumn(split, space('xs'));
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
    // space.sm between the parts and inside an item's row, as the Figma specimen spaces them.
    expectColumn($(el, '.base'), space('sm'));
    expectColumn($(el, '.list'), space('2xs'));
    const row = $(el, '.row');
    expectRow(row, space('sm'));
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
    // space.xs between the actions, as the Figma specimen spaces them.
    expectRow(toolbar, space('xs'), { align: 'stretch' });
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
    // Narrower than the select's own width in any font (CI's DejaVu Sans failed at 5rem).
    await expectWraps(language, '4rem');
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
    // space.xs between the options, as the Figma specimen spaces them.
    expectColumn($(el, '.options'), space('xs'));
    expectRow($(el, '.option'), space('xs'));
  });

  it('stacks each field', async () => {
    const el = await example('question', 'form');
    expectColumn($(el, '.field'), space('2xs'));
  });

  it.each(['default', 'form', 'text'])(
    'keeps the %s answer draft and native selection while its bounded parent shrinks',
    async (key) => {
      Object.assign(container.style, {
        boxSizing: 'border-box',
        padding: '10px',
        blockSize: '20rem',
        overflow: 'auto',
        scrollbarGutter: 'stable',
      });
      const el = await example('question', key);
      const selector =
        key === 'default'
          ? 'input[name="custom"]'
          : key === 'form'
            ? 'input[name="title"]'
            : 'textarea[name="text"]';
      const field = $(el, selector) as HTMLInputElement | HTMLTextAreaElement;
      // Other's field shows once Other is chosen.
      if (key === 'default') $(el, 'input[value="__other"]').click();
      await userEvent.fill(field, 'Draft response');
      field.setSelectionRange(5, 5);

      // On platforms with a 15px scrollbar these grant 207px and 187px to the same
      // component. The test measures the real grant rather than assuming scrollbar size.
      for (const width of [242, 222, 440, 222]) {
        container.style.inlineSize = `${width}px`;
        await settle(el);
        expect($(el, selector)).toBe(field);
        expect(field.value).toBe('Draft response');
        expect(el.shadowRoot!.activeElement).toBe(field);
        expect([field.selectionStart, field.selectionEnd]).toEqual([5, 5]);
        expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
        const form = $(el, '[part="form"]');
        expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth + 1);
        const edge = form.getBoundingClientRect().right;
        for (const control of form.querySelectorAll('input, textarea, select'))
          expect(control.getBoundingClientRect().right).toBeLessThanOrEqual(edge + 1);
      }

      await userEvent.keyboard('!');
      expect(field.value).toBe('Draft! response');
      expect([field.selectionStart, field.selectionEnd]).toEqual([6, 6]);
    },
  );
});

describe('odd-response-feedback', () => {
  it('lines up the rating actions', async () => {
    const el = await example('response-feedback');
    expectRow($(el, '.actions'), space('xs'), { align: 'unseen' });
  });

  it('centres the outcome beside the rating actions', async () => {
    const el = await example('response-feedback', 'negative');
    expectRow($(el, '.actions'), space('xs'));
  });

  it('stacks the reasons form; a reason is a centred row', async () => {
    const el = await example('response-feedback');
    $(el, '[data-rating="negative"]').click();
    await settle(el);
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.form'), space('xs'));
    expectRow($(el, '.check'), space('xs'), { text: true });
    // space.xs from the comment's label to its field, as the Figma specimen spaces them.
    expectColumn($(el, '.field'), space('xs'));
  });
});

describe('odd-task-plan', () => {
  it('stacks the plan, its steps and tasks; a step and a task sit on the baseline', async () => {
    const el = await example('task-plan');
    // As the Figma specimen: space.xs between title, progress, and steps; a step's status at the
    // end of its title's line.
    expectColumn($(el, '.base'), space('xs'));
    expectColumn($(el, '.steps'), space('xs'));
    expectColumn($(el, '.tasks'), space('xs'));
    expectRow($(el, '.step'), space('xs'), { align: 'baseline' });
    // A task's symbol, title, and status are one line each.
    expectRow($(el, '.task'), space('xs'), { align: 'unseen' });
    const body = $(el, '.body');
    const [title, status] = [...body.children].filter(
      (child) => !child.classList.contains('visually-hidden'),
    );
    expect(Math.round(status!.getBoundingClientRect().right)).toBe(
      Math.round(body.getBoundingClientRect().right),
    );
    expect(title!.getBoundingClientRect().right).toBeLessThanOrEqual(
      status!.getBoundingClientRect().left,
    );
  });
});

describe('odd-tool-call', () => {
  it('stacks its card space.md apart, the failure’s message over Retry (Figma page 10)', async () => {
    const el = await example('tool-call', 'failed');
    // The name, status, and purpose; then Details, the failure, and any approval.
    expectColumn($(el, '.summary'), space('md'));
    expectColumn($(el, '[part="base"]'), space('md'));
    expectColumn($(el, '.failure'), space('md'));
    // Retry keeps its own width under the message.
    const retry = $(el, '.failure button')!.getBoundingClientRect();
    expect(retry.width).toBeLessThan($(el, '.failure')!.getBoundingClientRect().width);
  });

  it('stacks the arguments and the result in Details', async () => {
    const el = await example('tool-call');
    (
      el.shadowRoot!.querySelector('odd-disclosure') as HTMLElementTagNameMap['odd-disclosure']
    ).open = true;
    await settle(el);
    expectColumn($(el, '.body'), space('md'));
    expectColumn($(el, '[part="arguments"]'), space('xs'));
  });
});

describe('odd-usage-meter', () => {
  it('stacks the entries', async () => {
    const el = await example('usage-meter');
    // space.sm between the entries, as the Figma specimen spaces them.
    expectColumn($(el, '.list'), space('sm'));
  });
});

describe('odd-voice-input', () => {
  it('stacks the record button and its status', async () => {
    // Without an adapter it says that voice input is unsupported.
    const el = await example('voice-input', 'default', () => ({}));
    expectColumn($(el, '.base'), space('xs'));
  });
});

describe('buttons', () => {
  it('keep the target width, however short their label', async () => {
    const probe = container.appendChild(document.createElement('div'));
    probe.style.inlineSize = 'var(--odd-target-min)';
    const target = probe.getBoundingClientRect().width;
    probe.remove();
    // A message's previous and next versions are one glyph each.
    const el = await example('message', 'versions');
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.versions .odd-button')];
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons)
      expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(target);
  });
});

// Continuity (responsiveness.md; component-contracts.md §2.11): a change of width keeps the
// person's work. A bounded parent, set as the question's probe above sets one, narrows and widens
// across the 30rem narrow arrangement while a decision is pending, a reason is drafted, a scope is
// chosen, or Details is open: the same nodes keep their value, focus, selection, and open state,
// nothing overflows sideways, and the density (padding, control sizes) does not follow the width.
// Each probe runs in the default and the compact density, and right to left.
describe('continuity', () => {
  const WIDTHS = [680, 242, 222, 680, 222];
  const SETUPS = ['default density', 'compact density', 'right to left'] as const;
  const bound = (setup: (typeof SETUPS)[number]) => {
    Object.assign(container.style, {
      boxSizing: 'border-box',
      padding: '10px',
      blockSize: '20rem',
      overflow: 'auto',
      scrollbarGutter: 'stable',
    });
    if (setup === 'compact density') container.dataset['oddDensity'] = 'compact';
    if (setup === 'right to left') container.dir = 'rtl';
  };
  const resize = async (width: number, ...els: Updating[]) => {
    container.style.inlineSize = `${width}px`;
    for (const el of els) await settle(el);
  };
  /** Neither the parent nor the element's base overflows sideways. */
  const expectInside = (base: HTMLElement) => {
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
    expect(base.scrollWidth).toBeLessThanOrEqual(base.clientWidth + 1);
  };
  /**
   * The density no width changes: the base's padding, and each control's padding, minimum block
   * size, and font size. A label may still wrap and make its button taller: that is the content.
   */
  const density = (base: HTMLElement, controls: Iterable<Element>) => [
    getComputedStyle(base).paddingInlineStart,
    getComputedStyle(base).paddingBlockStart,
    [...controls].map((control) => {
      const box = control.shadowRoot?.querySelector('[part="control"]') ?? control;
      const style = getComputedStyle(box);
      return [
        style.paddingInlineStart,
        style.paddingBlockStart,
        style.minBlockSize,
        style.fontSize,
      ];
    }),
  ];
  type Disclosure = HTMLElement & { open: boolean };
  /** Opens a disclosure as the person does, once it reports the toggle. */
  const toggle = async (host: Updating, disclosure: HTMLElement) => {
    const toggled = new Promise((resolve) =>
      disclosure.addEventListener('toggle', resolve, { once: true }),
    );
    disclosure.shadowRoot!.querySelector('summary')!.click();
    await toggled;
    await settle(host);
    return disclosure as Disclosure;
  };
  type Field = HTMLTextAreaElement;

  it.each(SETUPS)(
    'odd-action-approval keeps a drafted reason and a chosen scope, then a pending decision (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('action-approval', 'scopes');
      const base = $(el, '.base');
      const disclosure = await toggle(el, $(el, 'odd-disclosure.reason'));
      const radios = [...el.shadowRoot!.querySelectorAll<HTMLInputElement>('input[name="scope"]')];
      await userEvent.click(radios[1]!);
      await settle(el);
      const reason = $(el, '.reason textarea') as Field;
      await userEvent.fill(reason, 'Ship before noon.');
      reason.setSelectionRange(4, 4);
      const buttons = () => el.shadowRoot!.querySelectorAll('.actions odd-button');
      const first = density(base, buttons());
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(disclosure.open).toBe(true);
        expect($(el, '.reason textarea')).toBe(reason);
        expect(reason.value).toBe('Ship before noon.');
        expect(el.shadowRoot!.activeElement).toBe(reason);
        expect([reason.selectionStart, reason.selectionEnd]).toEqual([4, 4]);
        expect(radios.map((radio) => radio.checked)).toEqual([false, true]);
        expect(density(base, buttons())).toEqual(first);
        expectInside(base);
      }
      await userEvent.keyboard('!');
      expect(reason.value).toBe('Ship! before noon.');
      // Approve from the keyboard (WebKit does not focus a clicked button), and the host has not
      // answered yet: the decision stays in flight at every width.
      const approve = $(el, '.actions odd-button[data-action="approve"]');
      approve.focus();
      await userEvent.keyboard('{Enter}');
      await settle(el);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect($(el, '.actions odd-button[data-action="approve"]')).toBe(approve);
        expect(approve.hasAttribute('loading')).toBe(true);
        expect(el.shadowRoot!.activeElement).toBe(approve);
        expect($(el, '.pending').hidden).toBe(false);
        expect(radios.map((radio) => radio.checked)).toEqual([false, true]);
        expect(density(base, buttons())).toEqual(first);
        expectInside(base);
      }
    },
  );

  it.each(SETUPS)(
    'odd-change-review keeps an open context, its sides, and an accept in flight; the sides stack when narrow (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('change-review', 'split', (props) => {
        const [first, ...rest] = props['proposals'] as Record<string, unknown>[];
        const context = { before: 'Release notes: ', after: ' Contact the team.' };
        return { ...props, proposals: [{ ...first, context }, ...rest] };
      });
      const base = $(el, '.base');
      const disclosure = await toggle(el, $(el, '.context-toggle'));
      const accept = $(el, '.proposal odd-button[data-action="accept"]');
      accept.focus();
      await userEvent.keyboard('{Enter}');
      await settle(el);
      const sides = [...el.shadowRoot!.querySelectorAll('.side')];
      const buttons = () => el.shadowRoot!.querySelectorAll('.actions odd-button');
      const first = density(base, buttons());
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(disclosure.open).toBe(true);
        expect([...el.shadowRoot!.querySelectorAll('.side')]).toEqual(sides);
        const [before, after] = sides.slice(0, 2).map((side) => side.getBoundingClientRect());
        // Side by side when wide; stacked, the same nodes, below 30rem.
        if (width > 600) expect(after!.top).toBe(before!.top);
        else expect(after!.top).toBeGreaterThanOrEqual(before!.bottom);
        expect(accept.hasAttribute('loading')).toBe(true);
        expect(el.shadowRoot!.activeElement).toBe(accept);
        expect(density(base, buttons())).toEqual(first);
        expectInside(base);
      }
    },
  );

  it.each(SETUPS)(
    'odd-tool-call keeps Details open and its approval’s drafted reason (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('tool-call', 'approval');
      const base = $(el, '.base');
      const details = await toggle(el, $(el, 'odd-disclosure.details'));
      const approval = $(el, 'odd-action-approval') as Updating;
      await settle(approval);
      await toggle(approval, $(approval, 'odd-disclosure.reason'));
      const reason = $(approval, '.reason textarea') as Field;
      await userEvent.fill(reason, 'Only the release list.');
      reason.setSelectionRange(4, 4);
      const buttons = () => approval.shadowRoot!.querySelectorAll('.actions odd-button');
      const first = density(base, buttons());
      for (const width of WIDTHS) {
        await resize(width, el, approval);
        expect(details.open).toBe(true);
        expect($(approval, '.reason textarea')).toBe(reason);
        expect(reason.value).toBe('Only the release list.');
        expect(el.shadowRoot!.activeElement).toBe(approval);
        expect(approval.shadowRoot!.activeElement).toBe(reason);
        expect([reason.selectionStart, reason.selectionEnd]).toEqual([4, 4]);
        expect(density(base, buttons())).toEqual(first);
        expectInside(base);
      }
    },
  );

  it.each(SETUPS)('odd-tool-call keeps its failure and a focused Retry (%s)', async (setup) => {
    bound(setup);
    const el = await example('tool-call', 'failed');
    const base = $(el, '.base');
    const retry = $(el, '.failure button');
    retry.focus();
    const first = density(base, [retry]);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, '.failure button')).toBe(retry);
      expect(el.shadowRoot!.activeElement).toBe(retry);
      expect(density(base, [retry])).toEqual(first);
      expectInside(base);
    }
  });

  it.each(SETUPS)(
    'odd-activity keeps the wait, its counts, and a focused Stop (%s)',
    async (setup) => {
      bound(setup);
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
            status: 'awaiting-input',
            wait: {
              action: [
                { kind: 'question', id: 'q1' },
                { kind: 'question', id: 'q2' },
              ],
              submitting: [{ kind: 'approval', id: 'a1' }],
            },
          };
          e.capabilities = { stop: { available: true } };
        },
      );
      const base = $(el, '.base');
      const badge = $(el, '.waiting odd-badge');
      const stop = $(el, '[data-action="stop"]');
      stop.focus();
      const first = density(base, [stop]);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect($(el, '.waiting odd-badge')).toBe(badge);
        expect($(el, '.waiting .detail').textContent).toBe(
          '1 response is being recorded. 2 requests still need your input.',
        );
        expect(el.shadowRoot!.activeElement).toBe(stop);
        expect(density(base, [stop])).toEqual(first);
        expectInside(base);
      }
    },
  );

  it.each(SETUPS)(
    'odd-checkpoint keeps its restore confirmation and the focus in it (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('checkpoint');
      await userEvent.click($(el, '.actions odd-button[data-action="restore"]'));
      await settle(el);
      const base = $(el, '.base');
      const confirm = $(el, '.confirm');
      const cancel = $(el, '.confirm odd-button[data-action="cancel"]');
      cancel.focus();
      const buttons = () => el.shadowRoot!.querySelectorAll('.confirm odd-button');
      const first = density(base, buttons());
      for (const width of WIDTHS) {
        await resize(width, el);
        expect($(el, '.confirm')).toBe(confirm);
        expect(el.shadowRoot!.activeElement).toBe(cancel);
        expect(density(base, buttons())).toEqual(first);
        expectInside(base);
      }
    },
  );

  // The chat surface: the composer, the conversation, and a response (row 29).

  it.each(SETUPS)('odd-prompt-input keeps a draft, then a send in flight (%s)', async (setup) => {
    bound(setup);
    const el = await example('prompt-input');
    const base = $(el, '.form');
    const input = $(el, '#input') as Field;
    const draft = 'Summarize the release notes for the design team';
    await userEvent.fill(input, draft);
    input.setSelectionRange(9, 9);
    const send = $(el, 'odd-button.send');
    const controls = () => el.shadowRoot!.querySelectorAll('.toolbar :is(button, odd-button)');
    const first = density(base, controls());
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, '#input')).toBe(input);
      expect(input.value).toBe(draft);
      expect(el.shadowRoot!.activeElement).toBe(input);
      expect([input.selectionStart, input.selectionEnd]).toEqual([9, 9]);
      expect($(el, 'odd-button.send')).toBe(send);
      expect(send.hasAttribute('disabled')).toBe(false);
      expect(density(base, controls())).toEqual(first);
      expectInside(base);
    }
    // Send from the keyboard; the host has not taken the message yet.
    send.focus();
    await userEvent.keyboard('{Enter}');
    await settle(el);
    expect(send.hasAttribute('loading')).toBe(true);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, 'odd-button.send')).toBe(send);
      expect(send.hasAttribute('loading')).toBe(true);
      expect(el.shadowRoot!.activeElement).toBe(send);
      expectInside(base);
    }
  });

  it.each(SETUPS)(
    'odd-prompt-input keeps a focused Stop while its work runs (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('prompt-input', 'loading');
      const base = $(el, '.form');
      const stop = $(el, 'odd-button.stop');
      stop.focus();
      const first = density(base, [stop]);
      for (const width of WIDTHS) {
        await resize(width, el);
        expect($(el, 'odd-button.stop')).toBe(stop);
        expect(el.shadowRoot!.activeElement).toBe(stop);
        expect(density(base, [stop])).toEqual(first);
        expectInside(base);
      }
    },
  );

  it.each(SETUPS)(
    'odd-conversation stays at the end while a reply streams, and keeps the message being read in place (%s)',
    async (setup) => {
      bound(setup);
      const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
      const messages = Array.from({ length: 10 }, (_, i) =>
        text(`m${i}`, i % 2 ? 'assistant' : 'user', `Message ${i}: ${words(24)}`),
      );
      const el = await mount<Updating & { state: unknown }>(
        'odd-conversation',
        () => import('../src/conversation/conversation.define.js'),
        (e) => {
          e.state = conversation(messages);
        },
      );
      const scroller = $(el, '.scroller');
      const atEnd = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= 2;
      await settle(el);
      expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
      expect(atEnd()).toBe(true);
      // A reply streams while the width changes: the end stays in view.
      let reply = 'The answer begins';
      for (const width of WIDTHS) {
        reply += ` ${words(6)}`;
        el.state = conversation([...messages, text('m10', 'assistant', reply)]);
        await resize(width, el);
        expect(atEnd()).toBe(true);
        expectInside(scroller);
      }
      // Reading earlier content: the message at the top stays there while the width changes. The
      // element keeps the place itself, as an engine without native scroll anchoring needs.
      scroller.style.overflowAnchor = 'none';
      const read = el.shadowRoot!.querySelector<HTMLElement>('[data-id="m4"]')!;
      const offset = () => read.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTop += offset();
      await frames();
      await frames();
      for (const width of WIDTHS) {
        await resize(width, el);
        expect(Math.abs(offset())).toBeLessThanOrEqual(2);
        expect(atEnd()).toBe(false);
        expectInside(scroller);
      }
    },
  );

  it.each(SETUPS)(
    'odd-response appends a stream in place and scrolls its code locally; the copy confirmation stays by its button (%s)',
    async (setup) => {
      bound(setup);
      const head =
        'Container queries respond to the **component**, not the viewport.\n\n' +
        '```css\n@container sidebar (min-inline-size: 40rem) { .content { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); } }\n```\n\nThen';
      const el = await example<Updating & { text: string; status: string }>(
        'response',
        'streaming',
        (props) => ({ ...props, text: head }),
      );
      const content = $(el, '.content');
      const [paragraph, code] = [content.querySelector('p'), content.querySelector('pre')];
      expect(paragraph && code).toBeTruthy();
      let streamed = head;
      for (const width of WIDTHS) {
        streamed += ' the layout follows its container';
        el.text = streamed;
        await resize(width, el);
        // Earlier blocks keep their nodes; the code scrolls on its own, never the page.
        expect(content.querySelector('p')).toBe(paragraph);
        expect(content.querySelector('pre')).toBe(code);
        expect(content.textContent).toContain('follows its container');
        expectInside(content);
      }
      el.status = 'complete';
      await settle(el);
      const copy = $(el, 'odd-copy-button') as Updating;
      await settle(copy);
      const button = copy.shadowRoot!.querySelector('button')!;
      const popup = copy.shadowRoot!.querySelector<HTMLElement>('.confirmation')!;
      const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      try {
        button.focus();
        await userEvent.keyboard('{Enter}');
        await expect.poll(() => popup.matches(':popover-open')).toBe(true);
        // Above or below the button, across from it.
        const beside = () => {
          const [a, b] = [button.getBoundingClientRect(), popup.getBoundingClientRect()];
          const gap = Math.min(Math.abs(a.top - b.bottom), Math.abs(b.top - a.bottom));
          return gap <= 12 && b.left < a.right && a.left < b.right;
        };
        expect(beside()).toBe(true);
        // Within the viewport, which the confirmation keeps to.
        for (const width of [400, 260, 222, 400, 222]) {
          await resize(width, el, copy);
          expect(popup.matches(':popover-open')).toBe(true);
          expect(beside()).toBe(true);
          expect(copy.shadowRoot!.activeElement).toBe(button);
        }
      } finally {
        write.mockRestore();
      }
    },
  );

  it.each(SETUPS)('odd-message keeps its reasoning open (%s)', async (setup) => {
    bound(setup);
    const el = await mount<Updating & { message: unknown }>(
      'odd-message',
      () => import('../src/message/message.define.js'),
      (e) => {
        e.message = {
          id: 'm2',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              id: 'r1',
              text: 'The question is about layout, so container queries apply here.',
            },
            { type: 'text', id: 't1', text: 'Use a container query, sized by the card.' },
          ],
        };
      },
    );
    const reasoning = await toggle(el, $(el, 'odd-disclosure.reasoning'));
    const base = $(el, '.base');
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, 'odd-disclosure.reasoning')).toBe(reasoning);
      expect(reasoning.open).toBe(true);
      expectInside(base);
    }
  });

  // The rest of the AI elements (row 29).

  it.each(SETUPS)('odd-citation keeps its open preview by its marker (%s)', async (setup) => {
    bound(setup);
    const el = await mount<Updating & Record<string, unknown>>(
      'odd-citation',
      () => import('../src/citation/citation.define.js'),
      (e) => {
        Object.assign(e, {
          sourceId: 'first',
          index: 1,
          source: {
            type: 'source',
            id: 's1',
            sourceId: 'first',
            title: 'First source',
            url: 'https://example.com/source',
            excerpt: 'Supporting information for this claim.',
          },
        });
      },
    );
    // In a sentence, so the marker moves as the text around it wraps.
    const paragraph = document.createElement('p');
    paragraph.append('Container queries respond to the component, not the viewport, so a card ');
    paragraph.append(el, ' rearranges itself wherever it is placed.');
    container.append(paragraph);
    await settle(el);
    const trigger = $(el, '[part="trigger"]');
    const popover = el.shadowRoot!.querySelector<HTMLElement>('odd-popover')!;
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => popover.matches(':popover-open')).toBe(true);
    const beside = () => {
      const [a, b] = [trigger.getBoundingClientRect(), popover.getBoundingClientRect()];
      const gap = Math.min(Math.abs(a.top - b.bottom), Math.abs(b.top - a.bottom));
      return gap <= 12 && b.left < a.right && a.left < b.right;
    };
    await expect.poll(beside).toBe(true);
    for (const width of [400, 260, 222, 400, 222]) {
      await resize(width, el);
      await frames();
      expect(popover.matches(':popover-open')).toBe(true);
      expect(beside()).toBe(true);
    }
  });

  it.each(SETUPS)('odd-sources keeps a focused source and wraps its titles (%s)', async (setup) => {
    bound(setup);
    const el = await example('sources');
    const list = $(el, '.list');
    const link = $(el, '.item a.title');
    link.focus();
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, '.item a.title')).toBe(link);
      expect(el.shadowRoot!.activeElement).toBe(link);
      expectInside(list);
    }
  });

  it.each(SETUPS)('odd-usage-meter keeps its readings and wraps them (%s)', async (setup) => {
    bound(setup);
    const el = await example('usage-meter');
    const list = $(el, '.list');
    const readings = [...el.shadowRoot!.querySelectorAll('dt, dd, meter')];
    for (const width of WIDTHS) {
      await resize(width, el);
      const now = [...el.shadowRoot!.querySelectorAll('dt, dd, meter')];
      expect(now.length === readings.length && now.every((node, i) => node === readings[i])).toBe(
        true,
      );
      expectInside(list);
    }
  });

  it.each(SETUPS)(
    'odd-voice-input keeps recording, the focus, and what it heard (%s)',
    async (setup) => {
      bound(setup);
      const { createScriptedVoiceAdapter } = await import('../src/controllers/voice.js');
      const el = await example('voice-input', 'default', (props) => ({
        ...props,
        adapter: createScriptedVoiceAdapter([
          { after: 20, interim: 'Summarize the release notes' },
          { after: 60_000, final: 'Summarize the release notes.' },
        ]),
      }));
      const base = $(el, '.base');
      const record = $(el, 'button.record');
      record.focus();
      await userEvent.keyboard('{Enter}');
      const transcript = $(el, 'odd-transcript') as Updating;
      const heard = () => transcript.shadowRoot?.querySelector('.interim')?.textContent ?? '';
      await expect.poll(heard).toContain('Summarize the release notes');
      const buttons = () => el.shadowRoot!.querySelectorAll('.actions button:not([hidden])');
      const first = density(base, buttons());
      for (const width of WIDTHS) {
        await resize(width, el, transcript);
        expect($(el, 'button.record')).toBe(record);
        expect(record.getAttribute('aria-pressed')).toBe('true');
        expect(el.shadowRoot!.activeElement).toBe(record);
        expect(heard()).toContain('Summarize the release notes');
        expect(density(base, buttons())).toEqual(first);
        expectInside(base);
      }
    },
  );

  it.each(SETUPS)('odd-transcript keeps a correction being typed (%s)', async (setup) => {
    bound(setup);
    const el = await example('transcript', 'editable');
    const field = $(el, '.segment textarea[data-id="b"]') as Field;
    await userEvent.fill(field, 'Invite the design team before Thursday.');
    field.setSelectionRange(6, 6);
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, '.segment textarea[data-id="b"]')).toBe(field);
      expect(field.value).toBe('Invite the design team before Thursday.');
      expect(el.shadowRoot!.activeElement).toBe(field);
      expect([field.selectionStart, field.selectionEnd]).toEqual([6, 6]);
      expectInside($(el, '.base'));
    }
  });

  it.each(SETUPS)('odd-ai-label keeps its details open (%s)', async (setup) => {
    bound(setup);
    const el = await example('ai-label');
    const disclosure = await toggle(el, $(el, 'odd-disclosure.base'));
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, 'odd-disclosure.base')).toBe(disclosure);
      expect(disclosure.open).toBe(true);
      expectInside($(el, '.details'));
    }
  });

  it.each(SETUPS)('odd-model-select keeps the chosen model and the focus (%s)', async (setup) => {
    bound(setup);
    const el = await example('model-select');
    const select = $(el, '#select') as HTMLSelectElement;
    const choice = [...select.options].find((o) => !o.disabled && o.value !== select.value)!.value;
    await userEvent.selectOptions(select, choice);
    select.focus();
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, '#select')).toBe(select);
      expect(select.value).toBe(choice);
      expect(el.shadowRoot!.activeElement).toBe(select);
      expectInside($(el, '.field'));
    }
  });

  it.each(SETUPS)(
    'odd-task-plan keeps a focused Respond and wraps its steps (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('task-plan');
      const respond = $(el, 'button[data-step]');
      respond.focus();
      for (const width of WIDTHS) {
        await resize(width, el);
        expect($(el, 'button[data-step]')).toBe(respond);
        expect(el.shadowRoot!.activeElement).toBe(respond);
        expectInside($(el, '.steps'));
      }
    },
  );

  it.each(SETUPS)('odd-inline-assist keeps the action in focus (%s)', async (setup) => {
    bound(setup);
    const el = await example('inline-assist');
    const actions = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.toolbar button')];
    actions[1]!.focus();
    for (const width of WIDTHS) {
      await resize(width, el);
      const now = [...el.shadowRoot!.querySelectorAll('.toolbar button')];
      expect(now.length === actions.length && now.every((b, i) => b === actions[i])).toBe(true);
      expect(el.shadowRoot!.activeElement).toBe(actions[1]);
      expectInside($(el, '.toolbar'));
    }
  });

  it.each(SETUPS)('odd-inline-assist keeps the chosen language (%s)', async (setup) => {
    bound(setup);
    const el = await example('inline-assist', 'translate');
    const select = $(el, 'select') as HTMLSelectElement;
    const choice = [...select.options].find((o) => o.value && o.value !== select.value)!.value;
    await userEvent.selectOptions(select, choice);
    select.focus();
    for (const width of WIDTHS) {
      await resize(width, el);
      expect(select.value).toBe(choice);
      expect(el.shadowRoot!.activeElement).toBe(select);
      expectInside($(el, '.toolbar'));
    }
  });

  it.each(SETUPS)('odd-artifact keeps its source view and the focus in it (%s)', async (setup) => {
    bound(setup);
    const el = await example('artifact');
    $(el, 'button[data-view="source"]').click();
    await settle(el);
    const source = $(el, 'pre.source');
    source.focus();
    for (const width of WIDTHS) {
      await resize(width, el);
      expect($(el, 'pre.source')).toBe(source);
      expect(source.hidden).toBe(false);
      expect($(el, 'button[data-view="source"]').getAttribute('aria-pressed')).toBe('true');
      expect(el.shadowRoot!.activeElement).toBe(source);
      expectInside($(el, '.base'));
    }
  });

  it.each(SETUPS)(
    'odd-response-feedback keeps a reason and a comment being written (%s)',
    async (setup) => {
      bound(setup);
      const el = await example('response-feedback');
      $(el, 'button[data-rating="negative"]').click();
      await settle(el);
      const reason = $(el, '.form input[type="checkbox"]') as HTMLInputElement;
      await userEvent.click(reason);
      const comment = $(el, '.form textarea') as Field;
      await userEvent.fill(comment, 'The figures are from last year.');
      comment.setSelectionRange(4, 4);
      const form = $(el, '.form');
      for (const width of WIDTHS) {
        await resize(width, el);
        expect($(el, '.form textarea')).toBe(comment);
        expect(comment.value).toBe('The figures are from last year.');
        expect(el.shadowRoot!.activeElement).toBe(comment);
        expect([comment.selectionStart, comment.selectionEnd]).toEqual([4, 4]);
        expect(reason.checked).toBe(true);
        expect(form.hidden).toBe(false);
        expectInside(form);
      }
    },
  );
});
