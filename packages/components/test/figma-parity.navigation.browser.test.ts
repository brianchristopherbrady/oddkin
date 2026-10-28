import { describe, it } from 'vitest';
import {
  compare,
  expectNone,
  interact,
  mount,
  settle,
  shadowPart,
  transitions,
  useParity,
  type Target,
} from './parity.js';

// Figma parity of the disclosure and navigation elements (component-contracts.md §3.4); the
// helpers and their rules are in parity.ts.
useParity();

const settleAll = async (root: Element) => {
  for (const el of root.querySelectorAll('*')) await settle(el);
};

describe('Figma parity: odd-disclosure (Disclosure)', () => {
  for (const state of ['Closed', 'Expanded', 'Focus'])
    it(state, async () => {
      const el = mount(
        `<odd-disclosure label="Advanced settings" ${state === 'Expanded' ? 'open' : ''}
          >Additional options appear in this related region. The trigger retains its label and expanded state.</odd-disclosure
        >`,
      );
      await settle(el);
      const frame = [`Disclosure / ${state}`];
      const surface = [...frame, 'Surface'];
      const base = shadowPart(el, 'base');
      const content = shadowPart(el, 'content');
      const targets: Target[] = [
        { layer: surface, el: base, kind: 'frame' },
        { layer: [...surface, 'Advanced settings'], el: shadowPart(el, 'label'), kind: 'text' },
      ];
      if (state === 'Expanded')
        targets.push(
          { layer: [...surface, 'Surface'], el: content, kind: 'frame', pseudo: '::before' },
          {
            layer: [...surface, 'Additional options appear in this related region.'],
            el: content,
            kind: 'text',
          },
          {
            layer: [...surface, 'The trigger retains its label and expanded state.'],
            el: content,
            kind: 'text',
          },
        );
      if (state === 'Focus')
        targets.push({ layer: [...frame, 'Surface [2]'], el: base, kind: 'ring' });
      await interact(state, shadowPart(el, 'summary'));
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Disclosure', { State: state }, targets));
    });
});

describe('Figma parity: odd-tabs (Tabs)', () => {
  for (const state of ['Selected', 'Keyboard focus'])
    it(state, async () => {
      const el = mount(
        `<odd-tabs label="Project" activation="manual"
          ><odd-tab-panel label="Overview">Project overview</odd-tab-panel
          ><odd-tab-panel label="Activity">Activity</odd-tab-panel
          ><odd-tab-panel label="Settings">Settings</odd-tab-panel></odd-tabs
        >`,
      );
      await settleAll(el.parentElement!);
      const tabs = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="tab"]')];
      const surface = [`Tabs / ${state}`, 'Surface'];
      const focus = state === 'Keyboard focus';
      const targets: Target[] = [
        { layer: surface, el: shadowPart(el, 'base'), kind: 'frame' },
        { layer: [...surface, 'Surface'], el: tabs[0]!, kind: 'frame' },
        ...['Overview', 'Activity', 'Settings'].map((label, i): Target => ({
          layer: [...surface, label],
          el: tabs[i]!,
          kind: 'text',
        })),
        { layer: [...surface, 'Project overview'], el: el.firstElementChild!, kind: 'text' },
        {
          layer: [...surface, focus ? 'Surface [3]' : 'Surface [2]'],
          el: el.shadowRoot!.querySelector('.panels')!,
          kind: 'frame',
          pseudo: '::before',
        },
      ];
      if (focus) targets.push({ layer: [...surface, 'Surface [2]'], el: tabs[1]!, kind: 'ring' });
      await interact(focus ? 'Focus' : state, tabs[1]!);
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Tabs', { State: state }, targets));
    });
});

describe('Figma parity: odd-toolbar (Toolbar)', () => {
  for (const state of ['Default', 'Selection', 'Disabled'])
    it(state, async () => {
      const disabled = state === 'Disabled' ? 'disabled' : '';
      const el = mount(
        state === 'Selection'
          ? `<odd-toolbar label="Selection"><span>3 selected</span><odd-button size="sm" appearance="ghost">Clear</odd-button><odd-button size="sm" appearance="primary">Assign</odd-button></odd-toolbar>`
          : `<odd-toolbar label="Actions"><odd-input type="search" label="Search projects" ${disabled}></odd-input><hr aria-orientation="vertical" /><odd-button size="sm" ${disabled}>Button</odd-button><odd-button size="sm" ${disabled}>Button</odd-button></odd-toolbar>`,
      );
      await settleAll(el.parentElement!);
      const surface = [`Toolbar / ${state}`, 'Surface'];
      const targets: Target[] = [{ layer: surface, el: shadowPart(el, 'base'), kind: 'frame' }];
      if (state === 'Selection')
        targets.push({
          layer: [...surface, '3 selected'],
          el: el.querySelector('span')!,
          kind: 'text',
        });
      else
        targets.push({
          layer: [...surface, 'Surface'],
          el: el.querySelector('hr')!,
          kind: 'frame',
        });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Toolbar', { State: state }, targets));
    });
});

describe('Figma parity: odd-pagination (Pagination)', () => {
  for (const state of ['First page', 'Middle page', 'Keyboard focus'])
    it(state, async () => {
      const current = state === 'First page' ? 1 : 3;
      const el = mount(`<odd-pagination current="${current}" page-count="12"></odd-pagination>`);
      await settle(el);
      const surface = [`Pagination / ${state}`, 'Surface'];
      const page = (n: string) =>
        [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="page"]')].find(
          (p) => p.textContent!.trim() === n,
        )!;
      const next = shadowPart(el, 'next');
      const targets: Target[] = [
        { layer: surface, el: shadowPart(el, 'base'), kind: 'frame' },
        {
          layer: [...surface, `Page ${current} of 12`],
          el: shadowPart(el, 'status'),
          kind: 'text',
        },
        ...['1', '2', '3', '12'].map((n): Target => ({
          layer: [...surface, n],
          el: page(n),
          kind: 'text',
        })),
        { layer: [...surface, 'Surface'], el: shadowPart(el, 'previous'), kind: 'frame' },
        ...['1', '2', '3'].map((n, i): Target => ({
          layer: [...surface, `Surface [${i + 2}]`],
          el: page(n),
          kind: 'frame',
        })),
        { layer: [...surface, 'Surface [5]'], el: next, kind: 'frame' },
      ];
      if (state === 'Keyboard focus')
        targets.push({ layer: [...surface, 'Surface [6]'], el: next, kind: 'ring' });
      await interact(state === 'Keyboard focus' ? 'Focus' : state, next);
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Pagination', { State: state }, targets));
    });
});

describe('Figma parity: odd-breadcrumbs (Breadcrumbs)', () => {
  for (const state of ['Default', 'Truncated'])
    it(state, async () => {
      const el = mount(
        `<odd-breadcrumbs ${state === 'Truncated' ? 'max-items="3"' : ''}
          ><ol>
            <li><a href="#home">Home</a></li>
            <li><a href="#workspace">Workspace</a></li>
            <li><a href="#components">Components</a></li>
            <li><a href="#forms">Forms</a></li>
          </ol></odd-breadcrumbs
        >`,
      );
      await settle(el);
      const surface = [`Breadcrumbs / ${state}`, 'Surface'];
      const link = (label: string) =>
        [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="link"]')].find(
          (a) => a.textContent!.trim() === label,
        )!;
      const targets: Target[] = [
        { layer: surface, el: shadowPart(el, 'base'), kind: 'frame' },
        { layer: [...surface, 'Components'], el: link('Components'), kind: 'text' },
        { layer: [...surface, 'Forms'], el: shadowPart(el, 'current'), kind: 'text' },
      ];
      if (state === 'Default')
        targets.push({ layer: [...surface, 'Workspace'], el: link('Workspace'), kind: 'text' });
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Breadcrumbs', { State: state }, targets));
    });
});

const QUESTIONS = [
  'How do themes work?',
  'Can I use my own components?',
  'Which browsers are supported?',
];
const ANSWER =
  'Semantic tokens adapt each control without changing its behavior or your application data.';

describe('Figma parity: odd-disclosure name (Accordion)', () => {
  for (const state of ['All collapsed', 'One expanded', 'Keyboard focus'])
    it(state, async () => {
      const root = mount(
        `<div>${QUESTIONS.map(
          (q, i) =>
            `<odd-disclosure name="faq" label="${q}" ${i === 0 && state !== 'All collapsed' ? 'open' : ''}>${ANSWER}</odd-disclosure>`,
        ).join('')}</div>`,
      );
      await settleAll(root);
      const items = [...root.children];
      const surface = [`Accordion / ${state}`, 'Surface'];
      const divider = (layer: string, item: Element): Target => ({
        layer: [...surface, layer],
        el: shadowPart(item, 'base'),
        kind: 'frame',
        pseudo: '::before',
      });
      const targets: Target[] = [
        { layer: surface, el: shadowPart(items[0]!, 'base'), kind: 'frame' },
        ...QUESTIONS.map((q, i): Target => ({
          layer: [...surface, q],
          el: shadowPart(items[i]!, 'label'),
          kind: 'text',
        })),
        divider('Surface', items[1]!),
      ];
      if (state === 'All collapsed') targets.push(divider('Surface [2]', items[2]!));
      else
        targets.push(
          ...[
            'Semantic tokens adapt each control without changing',
            'its behavior or your application data.',
          ].map((text): Target => ({
            layer: [...surface, text],
            el: shadowPart(items[0]!, 'content'),
            kind: 'text',
          })),
        );
      if (state === 'One expanded') targets.push(divider('Surface [2]', items[2]!));
      if (state === 'Keyboard focus')
        targets.push(divider('Surface [3]', items[2]!), {
          layer: [...surface, 'Surface [2]'],
          el: shadowPart(items[1]!, 'base'),
          kind: 'ring',
        });
      await interact(
        state === 'Keyboard focus' ? 'Focus' : state,
        shadowPart(items[1]!, 'summary'),
      );
      await transitions(targets);
      expectNone(compare('Oddkin/Common/Accordion', { State: state }, targets));
    });
});

describe('Figma parity: odd-carousel (carousel)', () => {
  // The slide's eyebrow, title, body, and button are the author's markup; the element draws the
  // slide surface, the controls row, the position, and the slide buttons. Previous and next are
  // Figma iconButton instances (compared with odd-button). The heading is the author's.
  const SHOWN: Record<string, number> = {
    'First slide': 1,
    'Middle slide': 2,
    'Last slide': 3,
    'Keyboard focus': 2,
    Narrow: 1,
  };
  for (const [state, current] of Object.entries(SHOWN))
    it(state, async () => {
      const el = mount(
        `<odd-carousel label="Workspace highlights" current="${current}" style="inline-size: ${state === 'Narrow' ? 280 : 520}px"><div>A place for every project</div><div>Keep your team in sync</div><div>Move from idea to delivery</div></odd-carousel>`,
      );
      await settle(el);
      const slide = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="slide"]')].find(
        (s) => !s.hidden,
      )!;
      const picks = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="pick"]')];
      const controls = ['Slide controls'];
      const pick = (n: number) =>
        n === current ? `Go to slide ${n} · current` : `Go to slide ${n}`;
      const targets: Target[] = [
        { layer: [`Slide ${current} of 3`], el: slide, kind: 'frame' },
        { layer: controls, el: shadowPart(el, 'controls'), kind: 'frame', gap: 'column-gap' },
        { layer: [...controls, `${current} of 3`], el: shadowPart(el, 'position'), kind: 'text' },
        ...[1, 2, 3].flatMap((n): Target[] => [
          { layer: [...controls, pick(n)], el: picks[n - 1]!, kind: 'frame' },
          { layer: [...controls, pick(n), String(n)], el: picks[n - 1]!, kind: 'text' },
        ]),
      ];
      if (state === 'Keyboard focus') await interact('Focus', shadowPart(el, 'next'));
      await transitions(targets);
      expectNone(compare('Oddkin/Common/carousel', { State: state }, targets));
    });
});
