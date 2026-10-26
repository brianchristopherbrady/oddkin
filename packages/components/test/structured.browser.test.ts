import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, page, server, userEvent } from 'vitest/browser';
import { setErrorHandler } from '@oddkin/core/diagnostics';
import { flush } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import { statusMarkerDefinition } from '../src/status-marker/status-marker.definition.js';
import type { OddkinStatusMarker } from '../src/status-marker/status-marker.js';
import './register.js';
import { loadTheme, probeTag, semantics, settle, themeValue } from './probe.js';

// Agent 4's structured-content recipes (component-contracts.md §4), loaded as a page would load them
// from the built package (`dist/css/<name>.css`), with the shipped theme.
const RECIPES = ['typography', 'description-list', 'timeline', 'stepper'];
let links: HTMLLinkElement[] = [];
let unload: () => void;
beforeAll(async () => {
  unload = await loadTheme();
  links = await Promise.all(
    RECIPES.map(
      (name) =>
        new Promise<HTMLLinkElement>((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = new URL(`../dist/css/${name}.css`, import.meta.url).href;
          link.onload = () => resolve(link);
          link.onerror = reject;
          document.head.append(link);
        }),
    ),
  );
});
afterAll(() => {
  for (const link of links) link.remove();
  unload();
});

let container: HTMLElement;
afterEach(async () => {
  await userEvent.unhover(document.body);
  container?.remove();
});
const mount = (markup: string, width = 640) => {
  container = document.createElement('div');
  container.style.inlineSize = `${width}px`;
  container.innerHTML = markup;
  document.body.append(container);
  return container.firstElementChild as HTMLElement;
};
const style = (el: Element) => getComputedStyle(el);
const box = (el: Element) => el.getBoundingClientRect();
const px = (property: string, variable: string) => parseFloat(themeValue(property, variable));

const rows = (pairs: [string, string][]) =>
  `<dl class="odd-description-list">${pairs
    .map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
    .join('')}</dl>`;
const PAIRS: [string, string][] = [
  ['Owner', 'Alex Morgan'],
  ['Workspace', 'Field notes'],
  ['Region', 'Pacific Northwest'],
  ['Workspace ID', 'ws_83f2a9'],
];

describe('description list recipe', () => {
  it('keeps the term and definition semantics of native <dl> markup', async () => {
    mount(rows(PAIRS));
    expect(page.getByRole('term').elements()).toHaveLength(4);
    expect(page.getByRole('definition').elements()).toHaveLength(4);
    await expect.element(page.getByRole('term').filter({ hasText: 'Owner' })).toBeVisible();
  });

  it('lines every value up on one term column as wide as the longest term', () => {
    const dl = mount(rows(PAIRS));
    const values = [...dl.querySelectorAll('dd')].map((dd) => box(dd).left);
    expect(new Set(values).size).toBe(1);
    const terms = [...dl.querySelectorAll('dt')];
    const widest = Math.max(...terms.map((dt) => box(dt).width));
    // Each pair sits on one line, the term column `space.xs` from the values.
    for (const dt of terms) expect(box(dt).top).toBe(box(dt.nextElementSibling!).top);
    expect(values[0]! - box(dl).left).toBeCloseTo(widest + px('gap', '--odd-space-xs'), 0);
  });

  it('caps the term column at --odd-description-list-term-width (33% by default); long terms wrap', () => {
    const long = 'Primary regional operations contact for environmental planning';
    let dl = mount(rows([[long, 'Alex Morgan'], ...PAIRS]));
    expect(box(dl.querySelector('dt')!).width).toBeCloseTo(640 * 0.33, 0);
    expect(box(dl.querySelector('dt')!).height).toBeGreaterThan(
      box(dl.querySelectorAll('dt')[1]!).height,
    );
    container.remove();
    dl = mount(rows(PAIRS));
    dl.style.setProperty('--odd-description-list-term-width', '40px');
    // Narrower than its longest word, the column stops at that word: \Workspace ID\ wraps.
    const [owner, , , id] = [...dl.querySelectorAll('dt')];
    expect(box(id!).height).toBeGreaterThan(box(owner!).height);
    expect(box(id!).width).toBeLessThan(box(dl).width * 0.2);
  });

  it('divides rows with a rule, `space.md` from each row', () => {
    const dl = mount(rows(PAIRS));
    const [first, second] = [...dl.children] as HTMLElement[];
    expect(style(first!).borderBlockStartStyle).toBe('none');
    expect(style(second!).borderBlockStartStyle).toBe('solid');
    expect(style(second!).borderBlockStartColor).toBe(
      themeValue('color', '--odd-color-border-default'),
    );
    expect(style(second!).borderBlockStartWidth).toBe(
      themeValue('inline-size', '--odd-border-width-default'),
    );
    const md = px('gap', '--odd-space-md');
    expect(parseFloat(style(second!).paddingBlockStart)).toBe(md);
    expect(box(second!).top - box(first!).bottom).toBe(md);
  });

  it('stacks each term above its value below 36rem of its own width, not of the viewport', () => {
    for (const [width, stacked] of [
      [800, false],
      [577, false],
      [576, true],
      [320, true],
    ] as const) {
      const dl = mount(rows(PAIRS), width);
      const dt = dl.querySelector('dt')!;
      const dd = dl.querySelector('dd')!;
      if (stacked) {
        expect(box(dd).top - box(dt).bottom, `${width}px`).toBe(px('gap', '--odd-space-xs'));
        expect(box(dd).left, `${width}px`).toBe(box(dl).left);
        expect(box(dd).width, `${width}px`).toBe(box(dl).width);
      } else expect(box(dd).top, `${width}px`).toBe(box(dt).top);
      container.remove();
    }
  });

  it('wraps long values inside the list, unbroken words included', () => {
    const dl = mount(
      rows([
        [
          'Region',
          'North America / Pacific Northwest / Regional operations / Environmental planning',
        ],
        ['Token', 'x'.repeat(200)],
      ]),
      400,
    );
    for (const dd of dl.querySelectorAll('dd'))
      expect(box(dd).right).toBeLessThanOrEqual(box(dl).right);
    expect(dl.scrollWidth).toBe(dl.clientWidth);
  });

  it('shows terms in the secondary UI role and values in the primary body role', () => {
    const dl = mount(rows(PAIRS));
    const dt = dl.querySelector('dt')!;
    const dd = dl.querySelector('dd')!;
    expect(style(dt).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(style(dt).fontSize).toBe(themeValue('font-size', '--odd-type-ui-size'));
    expect(style(dd).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(style(dd).fontSize).toBe(themeValue('font-size', '--odd-type-body-size'));
    expect(style(dd).marginInlineStart).toBe('0px');
    expect(style(dl).marginBlockStart).toBe('0px');
  });

  it('still pairs bare <dt> and <dd> children in the two columns', () => {
    const dl = mount(
      '<dl class="odd-description-list"><dt>Owner</dt><dd>Alex Morgan</dd><dt>Region</dt><dd>Pacific Northwest</dd></dl>',
    );
    const [dt1, dt2] = dl.querySelectorAll('dt');
    const [dd1, dd2] = dl.querySelectorAll('dd');
    expect(box(dd1!).top).toBe(box(dt1!).top);
    expect(box(dd2!).top).toBe(box(dt2!).top);
    expect(box(dd1!).left).toBe(box(dd2!).left);
  });
});

describe('typography recipe: balanced headings', () => {
  it('balances the heading roles, and nothing else', () => {
    const root = mount(
      ['display', 'title', 'section', 'body']
        .map((r) => `<p class="odd-type-${r}">${r}</p>`)
        .join(''),
    ).parentElement!;
    // At the floor (Baseline 2024, ADR 0046 D1) in every engine, so ungated.
    for (const role of ['display', 'title', 'section'])
      expect(style(root.querySelector(`.odd-type-${role}`)!).textWrap, role).toBe('balance');
    expect(style(root.querySelector('.odd-type-body')!).textWrap).not.toBe('balance');
  });
});

const part = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const settleAll = async (root: Element) => {
  for (const el of root.querySelectorAll('odd-status-marker')) await settle(el);
};

describe('odd-status-marker', () => {
  it('is hidden from assistive technology, whatever it shows', async () => {
    const tag = probeTag(statusMarkerDefinition);
    const el = mount(`<${tag} status="complete"></${tag}>`);
    await settle(el);
    expect(semantics(el)).toEqual({ role: null, label: null, hidden: 'true' });
    expect(el.getAttribute('aria-hidden')).toBeNull();
  });

  it('draws the check, warning, or busy ring for its status, and its content or a dot while idle', async () => {
    const root = mount(
      '<div><odd-status-marker status="complete"></odd-status-marker><odd-status-marker status="failed"></odd-status-marker><odd-status-marker status="pending"></odd-status-marker><odd-status-marker>2</odd-status-marker><odd-status-marker></odd-status-marker></div>',
    );
    await settleAll(root);
    const [complete, failed, pending, step, dot] = [
      ...root.querySelectorAll<OddkinStatusMarker>('odd-status-marker'),
    ];
    expect(part(complete!).querySelector('svg.glyph path')!.getAttribute('d')).toBe(
      'M5 10.5l3.5 3.5L15 7',
    );
    expect(part(failed!).querySelector('svg.glyph circle.dot')).not.toBeNull();
    expect(part(pending!).querySelector('.spinner')).not.toBeNull();
    expect(part(step!).querySelector('slot')!.assignedNodes()[0]!.textContent).toBe('2');
    expect(getComputedStyle(part(dot!), '::after').content).toBe('""');
    expect(getComputedStyle(part(step!), '::after').content).toBe('none');
    // The glyph sits in the middle of the circle.
    const glyph = box(part(complete!).querySelector('svg')!);
    const circle = box(part(complete!));
    expect(glyph.left - circle.left).toBeCloseTo(circle.right - glyph.right, 0);
    expect(glyph.top - circle.top).toBeCloseTo(circle.bottom - glyph.bottom, 0);
    step!.status = 'complete';
    await settle(step!);
    expect(part(step!).querySelector('slot')).toBeNull();
  });

  it('has its own look alone: control.height.sm circles in the status colours', async () => {
    const root = mount(
      '<div><odd-status-marker></odd-status-marker><odd-status-marker status="complete"></odd-status-marker><odd-status-marker status="failed"></odd-status-marker></div>',
    );
    await settleAll(root);
    const [idle, complete, failed] = [...root.querySelectorAll('odd-status-marker')].map(part);
    expect(box(idle!).width).toBe(px('inline-size', '--odd-control-height-sm'));
    expect(style(idle!).backgroundColor).toBe(themeValue('color', '--odd-color-surface-sunken'));
    expect(style(complete!).backgroundColor).toBe(
      themeValue('color', '--odd-color-action-default'),
    );
    expect(style(complete!).color).toBe(themeValue('color', '--odd-color-text-on-action'));
    expect(style(failed!).color).toBe(themeValue('color', '--odd-color-danger-foreground'));
    expect(style(failed!).borderTopColor).toBe(
      themeValue('color', '--odd-color-danger-foreground'),
    );
  });

  it('reports an unknown status and stays idle', async () => {
    const codes: string[] = [];
    const previous = setErrorHandler((_error, context) => codes.push(context.code ?? ''));
    try {
      const el = mount(
        '<odd-status-marker status="error"></odd-status-marker>',
      ) as OddkinStatusMarker;
      await settle(el);
      expect(codes).toEqual(['element.attribute.invalid']);
      expect(el.status).toBe('idle');
    } finally {
      setErrorHandler(previous);
    }
  });

  it.runIf(server.browser === 'chromium')('keeps its ring in forced colours', async () => {
    const session = cdp();
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    });
    try {
      const el = mount('<odd-status-marker status="complete"></odd-status-marker>');
      await settle(el);
      expect(style(part(el)).borderTopStyle).toBe('solid');
      expect(parseFloat(style(part(el)).borderTopWidth)).toBeGreaterThan(0);
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
    }
  });

  it('releases everything when removed', async () => {
    const before = scopeStats();
    const el = mount('<odd-status-marker status="pending"></odd-status-marker>');
    await settle(el);
    container.remove();
    flush();
    expect(scopeStats()).toEqual(before);
  });
});

const EVENTS = `<ol class="odd-timeline">
  <li><odd-status-marker status="complete"></odd-status-marker><div><p>Update published</p><p><time datetime="2026-10-25T09:30">Today · 9:30 AM</time></p><p>Alex Morgan · Workspace settings</p></div></li>
  <li><odd-status-marker></odd-status-marker><div><p>Review approved</p><p>Yesterday · 4:15 PM</p><p>Jamie Chen reviewed the changes.</p></div></li>
  <li><odd-status-marker></odd-status-marker><div><p>Draft created</p><p>October 22 · 10:00 AM</p><p>Alex Morgan started this update.</p></div></li>
</ol>`;

describe('timeline recipe', () => {
  it('keeps the ordered list semantics, with the markers hidden', async () => {
    const ol = mount(EVENTS);
    await settleAll(ol);
    expect(page.getByRole('list').elements()).toEqual([ol]);
    expect(page.getByRole('listitem').elements()).toHaveLength(3);
    expect(style(ol.firstElementChild!).listStyleType).toBe('none');
    expect(style(ol).paddingInlineStart).toBe('0px');
  });

  it('puts each marker on a rail joined by a connector to the next event', async () => {
    const ol = mount(EVENTS);
    await settleAll(ol);
    const items = [...ol.children] as HTMLElement[];
    const marker = items[0]!.querySelector('odd-status-marker')!;
    const size = px('inline-size', '--odd-icon-size-lg');
    expect(box(part(marker)).width).toBe(size);
    const content = items[0]!.lastElementChild!;
    expect(box(content).left - box(marker).right).toBe(px('gap', '--odd-space-sm'));
    const connector = getComputedStyle(items[0]!, '::after');
    expect(connector.backgroundColor).toBe(themeValue('color', '--odd-color-border-default'));
    expect(connector.width).toBe(themeValue('inline-size', '--odd-border-width-default'));
    // From `space.2xs` under the marker to the next event's marker.
    expect(parseFloat(connector.top)).toBe(size + px('gap', '--odd-space-2xs'));
    expect(parseFloat(connector.height)).toBeCloseTo(
      box(items[1]!).top - box(items[0]!).top - size - px('gap', '--odd-space-2xs'),
      0,
    );
    expect(getComputedStyle(items[2]!, '::after').content).toBe('none');
  });

  it('shows the title in the UI role and the time and detail in the small secondary role', async () => {
    const ol = mount(EVENTS);
    await settleAll(ol);
    const [title, time, detail] = [...ol.querySelector('li > div')!.children];
    expect(style(title!).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(style(title!).fontSize).toBe(themeValue('font-size', '--odd-type-ui-size'));
    for (const el of [time!, detail!]) {
      expect(style(el).color).toBe(themeValue('color', '--odd-color-text-secondary'));
      expect(style(el).fontSize).toBe(themeValue('font-size', '--odd-type-small-size'));
    }
    expect(box(time!).top - box(title!).bottom).toBe(px('gap', '--odd-space-2xs'));
  });

  it('colours markers by status and a failed event’s title as danger', async () => {
    const ol = mount(`<ol class="odd-timeline">
      <li><odd-status-marker status="failed"></odd-status-marker><div><p>Update could not publish</p><p>Your draft is safe. Try again.</p></div></li>
      <li><odd-status-marker status="pending"></odd-status-marker><div><p>Publishing update…</p></div></li>
      <li><odd-status-marker></odd-status-marker><div><p>Draft created</p></div></li>
    </ol>`);
    await settleAll(ol);
    const [failed, pending, past] = [...ol.querySelectorAll('odd-status-marker')].map(part);
    expect(style(failed!).backgroundColor).toBe(themeValue('color', '--odd-color-danger-surface'));
    expect(style(failed!).color).toBe(themeValue('color', '--odd-color-danger-foreground'));
    expect(style(pending!).backgroundColor).toBe(
      themeValue('color', '--odd-color-selection-surface'),
    );
    expect(style(past!).backgroundColor).toBe(themeValue('color', '--odd-color-surface-sunken'));
    expect(style(past!).borderTopWidth).toBe('0px');
    const titles = [...ol.querySelectorAll('li > div > :first-child')];
    expect(style(titles[0]!).color).toBe(themeValue('color', '--odd-color-danger-foreground'));
    expect(style(titles[1]!).color).toBe(themeValue('color', '--odd-color-text-primary'));
  });

  it('wraps long content in a narrow container without overflowing', async () => {
    const ol = mount(
      `<ol class="odd-timeline"><li><odd-status-marker></odd-status-marker><div><p>${'Unbroken'.repeat(30)}</p><p>A long detail that wraps over several lines in a narrow column of the page.</p></div></li></ol>`,
      200,
    );
    await settleAll(ol);
    expect(ol.scrollWidth).toBe(ol.clientWidth);
    expect(box(ol.querySelector('li > div')!).right).toBeLessThanOrEqual(box(ol).right);
  });

  it.runIf(server.browser === 'chromium')(
    'keeps the connector and the marker rings in forced colours',
    async () => {
      const session = cdp();
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      try {
        const ol = mount(EVENTS);
        await settleAll(ol);
        const connector = getComputedStyle(ol.firstElementChild!, '::after');
        const text = document.createElement('span');
        text.style.color = 'CanvasText';
        ol.append(text);
        expect(connector.backgroundColor).toBe(style(text).color);
        expect(
          parseFloat(style(part(ol.querySelector('odd-status-marker')!)).borderTopWidth),
        ).toBeGreaterThan(0);
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] });
      }
    },
  );
});

const STEPS = `<ol class="odd-stepper" aria-label="Setup progress">
  <li><odd-status-marker status="complete"></odd-status-marker><div><a href="#details">Details</a><span>Complete</span></div></li>
  <li aria-current="step"><odd-status-marker>2</odd-status-marker><div><span>Members</span><span>Current step</span></div></li>
  <li><odd-status-marker>3</odd-status-marker><div><span>Review</span><span>Not started</span></div></li>
</ol>`;

describe('stepper recipe', () => {
  it('keeps the ordered list semantics and marks the current step', async () => {
    const ol = mount(STEPS);
    await settleAll(ol);
    await expect.element(page.getByRole('list', { name: 'Setup progress' })).toBeVisible();
    expect(page.getByRole('listitem').elements()).toHaveLength(3);
    expect(ol.children[1]!.getAttribute('aria-current')).toBe('step');
    expect(style(ol.firstElementChild!).listStyleType).toBe('none');
  });

  it('puts the steps in a row, space.sm apart, each marker space.xs from its words', async () => {
    const ol = mount(STEPS, 800);
    await settleAll(ol);
    const steps = [...ol.children] as HTMLElement[];
    expect(new Set(steps.map((li) => box(li).top)).size).toBe(1);
    expect(box(steps[1]!).left - box(steps[0]!).right).toBe(px('gap', '--odd-space-sm'));
    // The steps share the row equally.
    const widths = steps.map((li) => Math.round(box(li).width));
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]! * 3 + 2 * px('gap', '--odd-space-sm')).toBeCloseTo(box(ol).width, -1);
    const marker = steps[0]!.querySelector('odd-status-marker')!;
    expect(box(steps[0]!.lastElementChild!).left - box(marker).right).toBe(
      px('gap', '--odd-space-xs'),
    );
  });

  it('stacks the steps at 36rem of its own width, not of the viewport', async () => {
    for (const [width, stacked] of [
      [577, false],
      [576, true],
      [320, true],
    ] as const) {
      const ol = mount(STEPS, width);
      await settleAll(ol);
      const steps = [...ol.children] as HTMLElement[];
      const tops = steps.map((li) => box(li).top);
      if (stacked) {
        expect(tops[1]! - box(steps[0]!).bottom, `${width}px`).toBe(px('gap', '--odd-space-sm'));
        expect(box(steps[2]!).width, `${width}px`).toBe(box(ol).width);
      } else expect(new Set(tops).size, `${width}px`).toBe(1);
      container.remove();
    }
  });

  it('shows each step’s name in the UI role and its status small and secondary', async () => {
    const ol = mount(STEPS);
    await settleAll(ol);
    const [name, status] = [...ol.querySelector('li > div')!.children];
    expect(style(name!).color).toBe(themeValue('color', '--odd-color-text-primary'));
    expect(style(name!).fontSize).toBe(themeValue('font-size', '--odd-type-ui-size'));
    expect(style(status!).color).toBe(themeValue('color', '--odd-color-text-secondary'));
    expect(style(status!).fontSize).toBe(themeValue('font-size', '--odd-type-small-size'));
    expect(box(status!).top - box(name!).bottom).toBe(px('gap', '--odd-space-2xs'));
    // A step link keeps the text colour and its underline.
    expect(style(name!).textDecorationLine).toBe('underline');
  });

  it('gives the current step the action colours, complete steps the action fill, upcoming ones the sunken ring', async () => {
    const ol = mount(STEPS);
    await settleAll(ol);
    const [complete, current, upcoming] = [...ol.querySelectorAll('odd-status-marker')].map(part);
    expect(style(current!).backgroundColor).toBe(themeValue('color', '--odd-color-action-default'));
    expect(style(current!).color).toBe(themeValue('color', '--odd-color-text-on-action'));
    expect(style(current!).borderTopColor).toBe(themeValue('color', '--odd-color-action-default'));
    expect(style(complete!).backgroundColor).toBe(
      themeValue('color', '--odd-color-action-default'),
    );
    expect(style(upcoming!).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-sunken'),
    );
    expect(style(upcoming!).borderTopColor).toBe(themeValue('color', '--odd-color-border-strong'));
    expect(box(upcoming!).width).toBe(px('inline-size', '--odd-control-height-sm'));
  });

  it('marks the current step from aria-current on its link too', async () => {
    const ol = mount(
      STEPS.replace(' aria-current="step"', '').replace(
        '<a href="#details">',
        '<a href="#details" aria-current="step">',
      ),
    );
    await settleAll(ol);
    const marker = part(ol.querySelector('odd-status-marker')!);
    // The complete marker is in the action colours either way; the second is not current now.
    expect(style(part(ol.querySelectorAll('odd-status-marker')[1]!)).backgroundColor).toBe(
      themeValue('color', '--odd-color-surface-sunken'),
    );
    expect(style(marker).borderTopColor).toBe(themeValue('color', '--odd-color-action-default'));
    const idle = mount(
      STEPS.replace('status="complete"', '')
        .replace(' aria-current="step"', '')
        .replace('<a href="#details">', '<a href="#details" aria-current="step">'),
    );
    await settleAll(idle);
    expect(style(part(idle.querySelector('odd-status-marker')!)).backgroundColor).toBe(
      themeValue('color', '--odd-color-action-default'),
    );
  });

  it('says a failed step needs attention in the danger colour', async () => {
    const ol = mount(
      STEPS.replace(
        '<odd-status-marker>2</odd-status-marker>',
        '<odd-status-marker status="failed"></odd-status-marker>',
      ).replace('Current step', 'Needs attention'),
    );
    await settleAll(ol);
    const failed = ol.children[1]!;
    const status = failed.querySelector('div > :last-child')!;
    expect(style(status).color).toBe(themeValue('color', '--odd-color-danger-foreground'));
    expect(style(failed.querySelector('div > :first-child')!).color).toBe(
      themeValue('color', '--odd-color-text-primary'),
    );
    expect(style(ol.children[2]!.querySelector('div > :last-child')!).color).toBe(
      themeValue('color', '--odd-color-text-secondary'),
    );
  });
});
