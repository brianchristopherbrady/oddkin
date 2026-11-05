import { afterEach, describe, expect, it } from 'vitest';
import {
  compare,
  expectNone,
  figma,
  mount,
  settle,
  useParity,
  type Target,
} from '../../components/test/parity.js';

// Figma parity for the AI elements (page 0:1, "04 · AI components"; snapshot
// design/figma/components.json): each element's specimen, in light and in dark. A family is
// `odd-<tag>/<state>/<mode>` with one variant; its layers bind tokens that the element's parts
// must resolve to (parity.ts). The AI elements register the components they use from the built
// package, so the components' sources are not registered here.
useParity({ register: false });

const MODES = ['light', 'dark'] as const;
afterEach(() => {
  delete document.documentElement.dataset['oddMode'];
});
const inMode = (mode: string) => {
  document.documentElement.dataset['oddMode'] = mode;
};
const shadow = (el: Element, selector: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(selector)!;
/** A layer's path whose last name starts with `start` (Figma truncates long text layer names). */
const layer = (family: string, start: string) =>
  figma.get(family)!.layers.find((l) => l.path.at(-1)?.startsWith(start))!.path;

describe('Figma parity: odd-activity', () => {
  for (const mode of MODES)
    it(`Interrupted, resume available (${mode})`, async () => {
      await import('../src/activity/activity.define.js');
      inMode(mode);
      const el = mount('<odd-activity></odd-activity>') as HTMLElementTagNameMap['odd-activity'];
      el.attempt = {
        attemptId: 'at1',
        runId: 'run1',
        conversationId: 'c1',
        messageId: 'm2',
        promptId: 'm1',
        relation: 'new',
        status: 'interrupted',
        connection: 'closed',
        stop: 'none',
      };
      el.capabilities = { resume: { available: true } };
      await settle(el);
      const family = `odd-activity/Interrupted · resume available/${mode}`;
      const resume = shadow(el, '[data-action="resume"]');
      const targets: Target[] = [
        { layer: [], el, kind: 'frame' },
        {
          layer: ['Status and recovery'],
          el: shadow(el, '[part="base"]'),
          kind: 'frame',
          gap: 'column-gap',
          fields: [['minHeight', 'min-block-size']],
        },
        {
          layer: ['Status and recovery', 'Actions'],
          el: shadow(el, '[part="actions"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['Status and recovery', 'Actions', 'Resume'], el: resume, kind: 'frame' },
        { layer: ['Status and recovery', 'Actions', 'Resume', 'Resume'], el: resume, kind: 'text' },
        { layer: layer(family, 'Connection ended'), el: shadow(el, '.text'), kind: 'text' },
      ];
      expectNone(compare(family, {}, targets));
    });
});

describe('Figma parity: odd-message-branch', () => {
  for (const mode of MODES)
    it(`Alternative 2 of 3 (${mode})`, async () => {
      await import('../src/message-branch/message-branch.define.js');
      inMode(mode);
      const el = mount(
        '<odd-message-branch></odd-message-branch>',
      ) as HTMLElementTagNameMap['odd-message-branch'];
      el.messageId = 'm2';
      el.branch = { index: 2, count: 3, previousId: 'm1', nextId: 'm3' };
      el.capabilities = { switchBranch: { available: true } };
      await settle(el);
      const [previous, next] = el.shadowRoot!.querySelectorAll<HTMLElement>('button');
      const targets: Target[] = [
        { layer: [], el, kind: 'frame' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="base"]'),
          kind: 'frame',
          gap: 'column-gap',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', '‹'], el: previous!, kind: 'frame' },
        { layer: ['Actions', '‹', '‹'], el: previous!, kind: 'text' },
        { layer: ['Actions', '2 / 3'], el: shadow(el, '.position'), kind: 'text' },
        { layer: ['Actions', '›'], el: next!, kind: 'frame' },
        { layer: ['Actions', '›', '›'], el: next!, kind: 'text' },
      ];
      expectNone(compare(`odd-message-branch/Alternative 2 of 3/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-inline-assist', () => {
  for (const mode of MODES)
    it(`Selection ready (${mode})`, async () => {
      await import('../src/inline-assist/inline-assist.define.js');
      inMode(mode);
      const el = mount(
        '<odd-inline-assist></odd-inline-assist>',
      ) as HTMLElementTagNameMap['odd-inline-assist'];
      el.selection = { start: 0, end: 24, revision: 'v1', text: 'Summarize this document.' };
      el.documentRevision = 'v1';
      await settle(el);
      const button = (id: string) => shadow(el, `[data-action="${id}"]`);
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="toolbar"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['24 characters selected'], el: shadow(el, 'p.muted'), kind: 'text' },
      ];
      for (const [id, label] of [
        ['rewrite', 'Rewrite'],
        ['explain', 'Explain'],
        ['summarize', 'Summarize'],
        ['translate', 'Translate'],
        ['expand', 'Expand'],
      ] as const)
        targets.push(
          { layer: ['Actions', label], el: button(id), kind: 'frame' },
          { layer: ['Actions', label, label], el: button(id), kind: 'text' },
        );
      expectNone(compare(`odd-inline-assist/Selection ready/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-message', () => {
  for (const mode of MODES)
    it(`Assistant, completed (${mode})`, async () => {
      await import('../src/message/message.define.js');
      inMode(mode);
      const el = mount('<odd-message></odd-message>') as HTMLElementTagNameMap['odd-message'];
      el.message = {
        id: 'm2',
        role: 'assistant',
        parentId: 'm1',
        attemptId: 'at1',
        parts: [{ type: 'text', id: 't1', text: 'Here is a summary of the supplied document.' }],
      };
      el.capabilities = { regenerate: { available: true } };
      await settle(el);
      const [copy, regenerate] = el.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part="footer"] > .text-button',
      );
      const family = `odd-message/Assistant · completed/${mode}`;
      const targets: Target[] = [
        { layer: [], el: shadow(el, '.base'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Assistant'], el: shadow(el, '.role'), kind: 'text' },
        {
          layer: layer(family, 'Here is a summary'),
          el: shadow(el, '[part="content"]'),
          kind: 'text',
        },
        { layer: ['Actions'], el: shadow(el, '[part="footer"]'), kind: 'frame', gap: 'column-gap' },
        { layer: ['Actions', 'Copy'], el: copy!, kind: 'frame' },
        { layer: ['Actions', 'Copy', 'Copy'], el: copy!, kind: 'text' },
        { layer: ['Actions', 'Regenerate'], el: regenerate!, kind: 'frame' },
        { layer: ['Actions', 'Regenerate', 'Regenerate'], el: regenerate!, kind: 'text' },
      ];
      expectNone(compare(family, {}, targets));
      // Copy starts the row, as in Figma: the branch control takes no place without versions.
      expect(copy!.getBoundingClientRect().left).toBe(
        shadow(el, '[part="footer"]').getBoundingClientRect().left,
      );
    });
});

describe('Figma parity: odd-ai-label', () => {
  for (const mode of MODES)
    it(`Generated, collapsed (${mode})`, async () => {
      await import('../src/ai-label/ai-label.define.js');
      inMode(mode);
      const el = mount('<odd-ai-label></odd-ai-label>') as HTMLElementTagNameMap['odd-ai-label'];
      el.provenance = { kind: 'generated', model: 'Example model' };
      await settle(el);
      const label = shadow(el, '[part="label"]');
      const targets: Target[] = [
        { layer: [], el, kind: 'frame' },
        {
          layer: ['Actions', '▸ AI generated'],
          el: label,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', '▸ AI generated', '▸ AI generated'], el: label, kind: 'text' },
      ];
      expectNone(compare(`odd-ai-label/Generated · collapsed/${mode}`, {}, targets));
    });
});
