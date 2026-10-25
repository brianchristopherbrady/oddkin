import { describe, expect, it } from 'vitest';
import {
  compare,
  expectNone,
  mount,
  settle,
  useParity,
  useRecipeStyles,
  type Target,
} from './parity.js';

// Figma parity for Agent 4's display families (page 158:22; snapshot design/figma/components.json):
// the description list, timeline, and stepper recipes, and the relative time, copy button, and stat
// elements.
useParity();

describe('Figma parity: description list recipe (descriptionList)', () => {
  useRecipeStyles(['base', 'description-list']);

  const list = (region: string) =>
    mount(`<div style="inline-size: 640px"><dl class="odd-description-list">
      <div><dt>Owner</dt><dd>Alex Morgan</dd></div>
      <div><dt>Workspace</dt><dd>Field notes</dd></div>
      <div><dt>Region</dt><dd>${region}</dd></div>
      <div><dt>Workspace ID</dt><dd><code>ws_83f2a9</code></dd></div>
    </dl></div>`).firstElementChild as HTMLElement;
  const targets = (dl: HTMLElement, region: string): Target[] => {
    const row = (i: number) => dl.children[i] as HTMLElement;
    const term = (i: number) => row(i).querySelector('dt')!;
    const value = (i: number) => row(i).querySelector('dd')!;
    return [
      { layer: [], el: dl, kind: 'frame', gap: 'row-gap' },
      // Rows are subgrids: the term-to-value gap is the list's column gap.
      { layer: ['Owner'], el: dl, kind: 'frame', gap: 'column-gap' },
      { layer: ['Owner', 'Owner'], el: term(0), kind: 'text' },
      { layer: ['Owner', 'Alex Morgan'], el: value(0), kind: 'text' },
      { layer: ['Workspace', 'Workspace'], el: term(1), kind: 'text' },
      { layer: ['Workspace', 'Field notes'], el: value(1), kind: 'text' },
      { layer: ['Region', 'Region'], el: term(2), kind: 'text' },
      { layer: ['Region', region], el: value(2), kind: 'text' },
      { layer: ['Workspace ID', 'Workspace ID'], el: term(3), kind: 'text' },
    ];
  };

  for (const [state, region] of [
    ['Horizontal', 'Pacific Northwest'],
    [
      'Long content',
      'North America / Pacific Northwest / Regional operations / Environmental planning and shared services',
    ],
    ['Missing value', 'Not provided'],
  ] as const)
    it(state, () => {
      const dl = list(region);
      expectNone(compare('Oddkin/Common/descriptionList', { State: state }, targets(dl, region)));
      // Figma's dividers are rules in the border colour between rows.
      const divider = getComputedStyle(dl.children[1]!).borderBlockStartColor;
      const probe = document.createElement('div');
      probe.style.color = 'var(--odd-color-border-default)';
      dl.append(probe);
      expect(divider).toBe(getComputedStyle(probe).color);
    });

  it('Stacked', () => {
    const dl = mount(`<div style="inline-size: 320px"><dl class="odd-description-list">
      <div><dt>Owner</dt><dd>Alex Morgan</dd></div>
      <div><dt>Workspace</dt><dd>Field notes</dd></div>
      <div><dt>Region</dt><dd>Pacific Northwest</dd></div>
      <div><dt>Workspace ID</dt><dd><code>ws_83f2a9</code></dd></div>
    </dl></div>`).firstElementChild as HTMLElement;
    const row = dl.children[0] as HTMLElement;
    expectNone(
      compare('Oddkin/Common/descriptionList', { State: 'Stacked' }, [
        { layer: [], el: dl, kind: 'frame', gap: 'row-gap' },
        { layer: ['Owner'], el: row, kind: 'frame', gap: 'row-gap' },
      ]),
    );
  });
});

describe('Figma parity: timeline recipe and odd-status-marker (timeline)', () => {
  useRecipeStyles(['base', 'timeline']);

  const EVENT_1: Record<string, [string, string, string, string]> = {
    Default: [
      'complete',
      'Update published',
      'Alex Morgan · Workspace settings',
      'Oddkin/Icon/check',
    ],
    Narrow: [
      'complete',
      'Update published',
      'Alex Morgan · Workspace settings',
      'Oddkin/Icon/check',
    ],
    Error: [
      'failed',
      'Update could not publish',
      'Your draft is safe. Try again.',
      'Oddkin/Icon/warning',
    ],
    Pending: [
      'pending',
      'Publishing update…',
      'Alex Morgan · Workspace settings',
      'Oddkin/Icon/spinner',
    ],
  };
  for (const [state, [status, title, detail]] of Object.entries(EVENT_1))
    it(state, async () => {
      const ol =
        mount(`<div style="inline-size: ${state === 'Narrow' ? 240 : 480}px"><ol class="odd-timeline">
        <li><odd-status-marker status="${status}"></odd-status-marker><div><p>${title}</p><p>Today · 9:30 AM</p><p>${detail}</p></div></li>
        <li><odd-status-marker></odd-status-marker><div><p>Review approved</p><p>Yesterday · 4:15 PM</p><p>Jamie Chen reviewed the changes.</p></div></li>
        <li><odd-status-marker></odd-status-marker><div><p>Draft created</p><p>October 22 · 10:00 AM</p><p>Alex Morgan started this update.</p></div></li>
      </ol></div>`).firstElementChild as HTMLElement;
      for (const m of ol.querySelectorAll('odd-status-marker')) await settle(m);
      const li = [...ol.children] as HTMLElement[];
      const marker = (i: number) =>
        li[i]!.querySelector('odd-status-marker')!.shadowRoot!.querySelector<HTMLElement>(
          '[part~="base"]',
        )!;
      const text = (i: number, n: number) => li[i]!.querySelector('div')!.children[n]!;
      const event = (i: number) => `Event ${i + 1}`;
      const targets: Target[] = [
        { layer: [event(0)], el: li[0]!, kind: 'frame', gap: 'column-gap' },
        {
          layer: [event(0), 'Event content'],
          el: li[0]!.querySelector('div')!,
          kind: 'frame',
          gap: 'row-gap',
        },
        { layer: [event(0), 'Event content', title], el: text(0, 0), kind: 'text' },
        { layer: [event(0), 'Event content', 'Today · 9:30 AM'], el: text(0, 1), kind: 'text' },
        { layer: [event(0), 'Event content', detail], el: text(0, 2), kind: 'text' },
        {
          layer: [event(0), 'Event rail', 'Connector'],
          el: li[0]!,
          pseudo: '::after',
          kind: 'frame',
        },
        { layer: [event(0), 'Event rail', 'Event marker'], el: marker(0), kind: 'frame' },
        { layer: [event(1), 'Event rail', 'Event marker'], el: marker(1), kind: 'frame' },
        {
          layer: [event(1), 'Event rail', 'Event marker', 'Past event'],
          el: marker(1),
          pseudo: '::after',
          kind: 'frame',
        },
        { layer: [event(1), 'Event content', 'Review approved'], el: text(1, 0), kind: 'text' },
        { layer: [event(2), 'Event rail', 'Event marker'], el: marker(2), kind: 'frame' },
      ];
      expectNone(compare('Oddkin/Common/timeline', { State: state }, targets));
    });
});

describe('Figma parity: odd-relative-time (relativeTime)', () => {
  const ago = new Date(Date.now() - 3 * 3600_000).toISOString();
  const CASES: [string, string, string][] = [
    ['Past', `datetime="${ago}"`, '3 hours ago'],
    ['Recent', `datetime="${new Date().toISOString()}"`, 'Just now'],
    [
      'Future',
      `datetime="${new Date(Date.now() + 2 * 86400_000 + 3600_000).toISOString()}"`,
      'In 2 days',
    ],
    ['Unavailable', '', 'Time unavailable'],
    ['Absolute detail', `datetime="${ago}" detail`, '3 hours ago'],
  ];
  for (const [state, attributes, text] of CASES)
    it(state, async () => {
      const el = mount(`<odd-relative-time ${attributes}></odd-relative-time>`);
      await settle(el);
      const part = (name: string) =>
        el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
      const targets: Target[] = [
        { layer: [], el: part('base'), kind: 'frame', gap: 'row-gap' },
        {
          layer: ['Relative timestamp'],
          el: el.shadowRoot!.querySelector('.relative')!,
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['Relative timestamp', text], el: part('time'), kind: 'text' },
      ];
      if (state === 'Absolute detail')
        targets.push({
          layer: ['October 24, 2026 at 9:30 AM PDT'],
          el: part('detail'),
          kind: 'text',
        });
      expectNone(compare('Oddkin/Common/relativeTime', { State: state }, targets));
    });
});

describe('Figma parity: odd-copy-button (copyButton)', () => {
  const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const clipboard = (refuse: boolean) =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          if (refuse) throw new DOMException('Denied.', 'NotAllowedError');
        },
      },
    });
  const restore = () => {
    if (own) Object.defineProperty(navigator, 'clipboard', own);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  };

  for (const [state, refuse, text] of [
    ['Copied', false, 'Copied to clipboard.'],
    ['Error', true, 'Could not copy. Select the text.'],
  ] as const)
    it(state, async () => {
      clipboard(refuse);
      try {
        const el = mount('<odd-copy-button value="ws_83f2a9"></odd-copy-button>') as HTMLElement & {
          copy(): Promise<boolean>;
        };
        await settle(el);
        await el.copy();
        await settle(el);
        const part = (name: string) =>
          el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
        expectNone(
          compare('Oddkin/Common/copyButton', { State: state }, [
            { layer: [], el: part('base'), kind: 'frame', gap: 'column-gap' },
            { layer: [text], el: part('status'), kind: 'text' },
          ]),
        );
      } finally {
        restore();
      }
    });

  it('Default, Disabled: the button is the small secondary odd-button, property for property', async () => {
    const root = mount(`<div>
      <odd-copy-button value="x"></odd-copy-button><odd-button size="sm">Copy</odd-button>
      <odd-copy-button value="x" disabled></odd-copy-button><odd-button size="sm" disabled>Copy</odd-button>
    </div>`);
    const [copy, button, disabledCopy, disabledButton] = [...root.children] as HTMLElement[];
    for (const el of [copy, button, disabledCopy, disabledButton]) await settle(el!);
    const inner = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>('button')!;
    const PROPS = [
      'min-block-size',
      'padding-inline-start',
      'border-top-width',
      'border-top-color',
      'border-top-left-radius',
      'background-color',
      'color',
      'font-size',
      'font-weight',
      'line-height',
      'column-gap',
      'cursor',
      'opacity',
    ];
    for (const [a, b] of [
      [copy!, button!],
      [disabledCopy!, disabledButton!],
    ] as const) {
      const x = getComputedStyle(inner(a)),
        y = getComputedStyle(inner(b));
      expect(PROPS.map((p) => `${p}: ${x.getPropertyValue(p)}`)).toEqual(
        PROPS.map((p) => `${p}: ${y.getPropertyValue(p)}`),
      );
    }
  });
});

describe('Figma parity: odd-stat (stat)', () => {
  const CASES: [string, string, string, string | null][] = [
    ['Increase', 'value="1,284" trend="increase"', '+8.2% this month', '1,284'],
    ['Decrease', 'value="1,284" trend="decrease"', '−3.4% this month', '1,284'],
    ['Neutral', 'value="1,284"', 'Across 12 teams', '1,284'],
    ['Unavailable', '', 'Data not available', '—'],
    ['Loading', 'loading', 'Loading…', null],
  ];
  for (const [state, attributes, context, value] of CASES)
    it(state, async () => {
      const el = mount(`<odd-stat label="Active members" ${attributes}>${context}</odd-stat>`);
      await settle(el);
      const part = (name: string) =>
        el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
      const targets: Target[] = [
        { layer: [], el: part('base'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Active members'], el: part('label'), kind: 'text' },
      ];
      if (value) {
        targets.push({ layer: [value], el: part('value'), kind: 'text' });
        targets.push({ layer: ['Context'], el: part('context'), kind: 'frame', gap: 'column-gap' });
        targets.push({
          layer: ['Context', context],
          el: part('context'),
          kind: 'text',
        });
      } else {
        const placeholder = part('placeholder');
        await settle(placeholder);
        targets.push({
          layer: ['Loading value'],
          el: placeholder.shadowRoot!.querySelector('.block')!,
          kind: 'frame',
        });
        targets.push({ layer: [context], el: part('context'), kind: 'text' });
      }
      expectNone(compare('Oddkin/Common/stat', { State: state }, targets));
    });
});
