import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cdp, commands, page, server, userEvent } from 'vitest/browser';
import {
  compare,
  deliberate,
  expectNone,
  figma,
  layersOf,
  mount,
  settle,
  transitions,
  useParity,
  variantIndex,
  type Target,
} from '../../components/test/parity.js';

// Figma parity for the AI elements (page 0:1, "04 · AI components"; snapshot
// design/figma/components.json): each element's specimen, in light and in dark. A family is
// `odd-<tag>/<state>/<mode>` with one variant; its layers bind tokens that the element's parts
// must resolve to (parity.ts). The AI elements register the components they use from the built
// package, so the components' sources are not registered here.
useParity({ register: false });
deliberate(
  [
    /^odd-sources\/One source\/(light|dark)\s+Numbered source row (paddingLeft|paddingTop|topLeftRadius) /,
    'Each source keeps a small padding and radius, so the highlight of a revealed source surrounds its text.',
  ],
  [
    /^odd-citation\/Resolved · expanded\/(light|dark)\s+(Citation marker · 1 paddingLeft|1 textStyle) /,
    'In running text the marker stays a superscript at three quarters of the text size, with a little inline padding; the specimen draws it 32 px square in the preview card.',
  ],
  [
    /^odd-artifact\/Preview · first revision\/(light|dark)\s+Artifact preview itemSpacing /,
    'The preview flows the rendered Markdown, whose blocks keep their own margins.',
  ],
  [
    /^odd-[a-z-]+\/.+\/(light|dark)\s+.+ strokes \(--odd-color-selection-background\): border-block-start-color rgba\(0, 0, 0, 0\), /,
    "A pressed button's border is transparent over its selection fill, as odd-button's is: the same pixels as the selection stroke Figma binds.",
  ],
  [
    /^odd-action-approval\/Requested\/(light|dark)\s+\S+ (paddingLeft|paddingTop) /,
    'Page 09 sets the approval 24 px in; below 480 px of its container it draws 16 px, where Oddkin changes only the arrangement and leaves padding to the theme density (ADR 0049).',
  ],
  [
    /^Oddkin\/AI\/ContextPicker\/ResourceRow Multiple\/False\/Disabled .+ fills \(--odd-color-text-(primary|secondary)\): /,
    'A row that cannot be chosen draws its text in the disabled colour, as every Oddkin option row does; Figma fades the whole row to 50 % opacity, an unbound value.',
  ],
);

const MODES = ['light', 'dark'] as const;
afterEach(() => {
  delete document.documentElement.dataset['oddMode'];
  delete document.documentElement.dataset['oddDensity'];
});
const inMode = (mode: string) => {
  document.documentElement.dataset['oddMode'] = mode;
};
const shadow = (el: Element, selector: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(selector)!;
/** A layer's path whose last name starts with `start` (Figma truncates long text layer names). */
const layer = (family: string, start: string) =>
  figma.get(family)!.layers.find((l) => l.path.at(-1)?.startsWith(start))!.path;
/**
 * WebKit reports a new native control's style as shared from an earlier one (in the other mode,
 * the other mode's colours) until the control's own style is invalidated: touch it first.
 */
const restyle = (el: HTMLElement) => {
  el.style.setProperty('--odd-restyle', '1');
  void getComputedStyle(el).color;
  el.style.removeProperty('--odd-restyle');
};
/** A space token's size in pixels, from a probe placed after `el`. */
const space = (el: Element, name: string) => {
  const probe = document.createElement('div');
  probe.style.rowGap = `var(--odd-space-${name})`;
  el.after(probe);
  return parseFloat(getComputedStyle(probe).rowGap);
};
/** A Figma text style's line height in pixels: parity.ts compares only the PIXELS ones. */
const figmaLineHeight = async (name: string) => {
  const { textStyles } = JSON.parse(await commands.readFile('design/figma/variables.json'));
  const style = textStyles.find((s: { name: string }) => s.name === name);
  return `${(style.fontSize * style.lineHeight.value) / 100}px`;
};

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
      await transitions(targets);
      expectNone(compare(family, {}, targets));
    });
});

// The specimen keeps its odd-message-branch name in Figma; odd-message draws its versions now.
describe('Figma parity: odd-message versions', () => {
  for (const mode of MODES)
    it(`Alternative 2 of 3 (${mode})`, async () => {
      await import('../src/message/message.define.js');
      inMode(mode);
      const el = mount('<odd-message></odd-message>') as HTMLElementTagNameMap['odd-message'];
      el.message = {
        id: 'm2',
        role: 'assistant',
        parts: [{ type: 'text', id: 't1', text: 'The second answer.' }],
      };
      el.branch = { index: 2, count: 3, previousId: 'm1', nextId: 'm3' };
      el.capabilities = { switchBranch: { available: true } };
      await settle(el);
      const group = shadow(el, '.versions');
      const [previous, next] = group.querySelectorAll<HTMLElement>('button');
      const targets: Target[] = [
        { layer: [], el: group, kind: 'frame' },
        {
          layer: ['Actions'],
          el: group,
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
      await transitions(targets);
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
      await transitions(targets);
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
      const copy = shadow(shadow(el, '[part="footer"] > odd-copy-button'), '[part="button"]');
      const [regenerate] = el.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part="footer"] > .odd-button',
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
        { layer: ['Actions', 'Copy'], el: copy, kind: 'frame' },
        { layer: ['Actions', 'Copy', 'Copy'], el: copy, kind: 'text' },
        { layer: ['Actions', 'Regenerate'], el: regenerate!, kind: 'frame' },
        { layer: ['Actions', 'Regenerate', 'Regenerate'], el: regenerate!, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(family, {}, targets));
      // Copy starts the row, as in Figma: the branch control takes no place without versions.
      expect(copy.getBoundingClientRect().left).toBe(
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
      // The label is the summary of the odd-disclosure the element composes.
      const label = shadow(shadow(el, 'odd-disclosure'), '[part="summary"]');
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
      await transitions(targets);
      expectNone(compare(`odd-ai-label/Generated · collapsed/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-response', () => {
  for (const mode of MODES)
    it(`Streaming (${mode})`, async () => {
      await import('../src/response/response.define.js');
      inMode(mode);
      const el = mount('<odd-response></odd-response>') as HTMLElementTagNameMap['odd-response'];
      el.text = 'The document describes three related ideas. The first is';
      el.status = 'streaming';
      await settle(el);
      const family = `odd-response/Streaming/${mode}`;
      const status = shadow(el, '[part="status"]');
      const targets: Target[] = [
        // The column's gap is the status line's top margin.
        { layer: [], el: status, kind: 'frame', fields: [['itemSpacing', 'margin-block-start']] },
        {
          layer: layer(family, 'The document describes'),
          el: shadow(el, '[part="content"]'),
          kind: 'text',
        },
        { layer: ['Generating…'], el: status, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(family, {}, targets));
    });
});

describe('Figma parity: odd-transcript', () => {
  for (const mode of MODES)
    it(`Final and interim text (${mode})`, async () => {
      await import('../src/transcript/transcript.define.js');
      inMode(mode);
      const el = mount(
        '<odd-transcript></odd-transcript>',
      ) as HTMLElementTagNameMap['odd-transcript'];
      el.segments = [{ id: 'a', text: 'Summarize the document.', final: true }];
      el.interim = 'Include the key points';
      await settle(el);
      const family = `odd-transcript/Final and interim text/${mode}`;
      const targets: Target[] = [
        { layer: [], el: shadow(el, '.base'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Summarize the document.'], el: shadow(el, '.segment'), kind: 'text' },
        { layer: layer(family, 'Listening:'), el: shadow(el, '[part="interim"]'), kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(family, {}, targets));
    });
});

describe('Figma parity: odd-usage-meter', () => {
  for (const mode of MODES)
    it(`Measured, estimated, unknown (${mode})`, async () => {
      await import('../src/usage-meter/usage-meter.define.js');
      inMode(mode);
      const el = mount(
        '<odd-usage-meter></odd-usage-meter>',
      ) as HTMLElementTagNameMap['odd-usage-meter'];
      el.usage = [
        {
          kind: 'input-tokens',
          label: 'Input tokens',
          used: 240,
          limit: 1000,
          unit: 'tokens',
          precision: 'measured',
        },
        {
          kind: 'output-tokens',
          label: 'Output tokens',
          used: 120,
          unit: 'tokens',
          precision: 'estimated',
        },
        { kind: 'cost', label: 'Cost', precision: 'unknown' },
      ];
      await settle(el);
      const entries = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.entry')];
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="list"]'), kind: 'frame', gap: 'row-gap' },
      ];
      for (const [i, row, label, value] of [
        [0, 'Usage row · Input tokens', 'Input tokens', '240 / 1,000'],
        [1, 'Usage row · Output tokens', 'Output tokens', 'Estimated: 120'],
        [2, 'Usage row · Cost', 'Cost', 'Unknown'],
      ] as const)
        targets.push(
          { layer: [row], el: entries[i]!, kind: 'frame', gap: 'column-gap' },
          { layer: [row, label], el: entries[i]!.querySelector('dt')!, kind: 'text' },
          {
            layer: [row, value],
            el: entries[i]!.querySelector<HTMLElement>('.value')!,
            kind: 'text',
          },
        );
      await transitions(targets);
      expectNone(compare(`odd-usage-meter/Measured / estimated / unknown/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-model-select', () => {
  for (const mode of MODES)
    it(`Available model (${mode})`, async () => {
      await import('../src/model-select/model-select.define.js');
      inMode(mode);
      const el = mount(
        '<odd-model-select></odd-model-select>',
      ) as HTMLElementTagNameMap['odd-model-select'];
      el.models = [
        {
          id: 'example',
          label: 'Example model',
          description: 'Example host-provided model description.',
          available: true,
        },
      ];
      el.value = 'example';
      await settle(el);
      restyle(shadow(el, '[part="select"]'));
      const family = `odd-model-select/Available model/${mode}`;
      const targets: Target[] = [
        { layer: [], el: shadow(el, '.field'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Model'], el: shadow(el, '[part="label"]'), kind: 'text' },
        {
          layer: ['Native field'],
          el: shadow(el, '[part="select"]'),
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        {
          layer: ['Native field', 'Example model'],
          el: shadow(el, '[part="select"]'),
          kind: 'text',
        },
        {
          layer: layer(family, 'Example host-provided'),
          el: shadow(el, '[part="details"]'),
          kind: 'text',
        },
      ];
      await transitions(targets);
      expectNone(compare(family, {}, targets));
    });
});

describe('Figma parity: odd-sources', () => {
  for (const mode of MODES)
    it(`One source (${mode})`, async () => {
      await import('../src/sources/sources.define.js');
      inMode(mode);
      const el = mount('<odd-sources></odd-sources>') as HTMLElementTagNameMap['odd-sources'];
      el.sources = [
        {
          type: 'source',
          id: 's1',
          sourceId: 'example',
          title: 'Example source',
          url: 'https://example.com/source',
          publisher: 'Example publisher',
          excerpt: 'An excerpt supplied by the host.',
        },
      ];
      await settle(el);
      const item = shadow(el, '.item');
      const row = 'Numbered source row';
      const content = [row, 'Source content'];
      const heading = [...content, 'Title and publisher'];
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Sources'], el: shadow(el, '.heading'), kind: 'text' },
        { layer: [row], el: item, kind: 'frame', gap: 'column-gap' },
        { layer: [row, '1.'], el: shadow(el, '.number'), kind: 'text' },
        { layer: content, el: shadow(el, '.source'), kind: 'frame', gap: 'row-gap' },
        { layer: heading, el: shadow(el, '.line'), kind: 'frame', gap: 'column-gap' },
        { layer: [...heading, '1. Example source'], el: shadow(el, '.title'), kind: 'text' },
        {
          layer: [...heading, 'Example publisher'],
          el: item.querySelector<HTMLElement>('.muted')!,
          kind: 'text',
        },
        {
          layer: [...content, 'An excerpt supplied by the host.'],
          el: shadow(el, '.excerpt'),
          kind: 'text',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-sources/One source/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-response-feedback', () => {
  for (const mode of MODES)
    it(`Negative rating, drafting (${mode})`, async () => {
      await import('../src/response-feedback/response-feedback.define.js');
      inMode(mode);
      const el = mount(
        '<odd-response-feedback></odd-response-feedback>',
      ) as HTMLElementTagNameMap['odd-response-feedback'];
      el.messageId = 'm2';
      await settle(el);
      shadow(el, '[data-rating="negative"]').click();
      await settle(el);
      const good = shadow(el, '[data-rating="positive"]');
      const bad = shadow(el, '[data-rating="negative"]');
      const form = shadow(el, '[part="form"]');
      const field = form.querySelector('textarea')!;
      restyle(field);
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Actions'], el: shadow(el, '.actions'), kind: 'frame', gap: 'column-gap' },
        {
          layer: ['Actions', 'Good response'],
          el: good,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', 'Good response', 'Good response'], el: good, kind: 'text' },
        {
          layer: ['Actions', 'Bad response'],
          el: bad,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', 'Bad response', 'Bad response'], el: bad, kind: 'text' },
        { layer: ['Comment (optional)'], el: form.querySelector('.field span')!, kind: 'text' },
        { layer: ['Native field'], el: field, kind: 'frame' },
        { layer: ['Native field', 'Text'], el: field, kind: 'text' },
        {
          layer: ['Actions [2]'],
          el: form.querySelector<HTMLElement>('.actions')!,
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-response-feedback/Negative rating · drafting/${mode}`, {}, targets));
      // Figma's comment field spans the 636 px specimen, space.xs under its label.
      el.style.inlineSize = '636px';
      const box = field.getBoundingClientRect();
      expect(box.width).toBe(el.getBoundingClientRect().width);
      const label = form.querySelector('.field span')!.getBoundingClientRect();
      expect(box.top - label.bottom).toBeCloseTo(space(el, 'xs'), 1);
    });
});

describe('Figma parity: odd-voice-input', () => {
  for (const mode of MODES)
    it(`Recording (${mode})`, async () => {
      await import('../src/voice-input/voice-input.define.js');
      const { createScriptedVoiceAdapter } = await import('../src/controllers/voice.js');
      inMode(mode);
      const el = mount(
        '<odd-voice-input></odd-voice-input>',
      ) as HTMLElementTagNameMap['odd-voice-input'];
      // A script that hears nothing for a minute: the element stays recording.
      el.adapter = createScriptedVoiceAdapter([{ after: 60_000, final: 'Never heard.' }]);
      await settle(el);
      const record = shadow(el, '.record');
      record.click();
      for (let i = 0; i < 40 && record.getAttribute('aria-pressed') !== 'true'; i++)
        await settle(el);
      for (let i = 0; i < 40 && !/Listening/.test(shadow(el, '[part="status"]').textContent!); i++)
        await settle(el);
      const cancel = shadow(el, '[part="controls"] > button:nth-of-type(2)');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="controls"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
        {
          layer: ['Actions', '● Stop recording'],
          el: record,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', '● Stop recording', '● Stop recording'], el: record, kind: 'text' },
        {
          layer: ['Actions', 'Cancel recording'],
          el: cancel,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', 'Cancel recording', 'Cancel recording'], el: cancel, kind: 'text' },
        { layer: ['Listening…'], el: shadow(el, '[part="status"]'), kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(`odd-voice-input/Recording/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-citation', () => {
  for (const mode of MODES)
    it(`Resolved, expanded inline (${mode})`, async () => {
      await import('../src/citation/citation.define.js');
      inMode(mode);
      // This approved specimen represents the allocated inline presentation.
      const el = mount(
        '<odd-citation presentation="inline"></odd-citation>',
      ) as HTMLElementTagNameMap['odd-citation'];
      el.sourceId = 'example';
      el.index = 1;
      el.source = {
        type: 'source',
        id: 's1',
        sourceId: 'example',
        title: 'Example source',
        url: 'https://example.com/source',
        publisher: 'Example publisher',
        excerpt: 'An excerpt supplied by the host.',
      };
      await settle(el);
      const trigger = shadow(el, '[part="trigger"]');
      trigger.click();
      await settle(el);
      const preview = shadow(el, '[part="preview"]');
      const show = shadow(el, '.preview .odd-button');
      const header = 'Citation header';
      const identity = [header, 'Source identity'];
      const targets: Target[] = [
        { layer: [], el: preview, kind: 'frame', gap: 'row-gap' },
        { layer: [header, 'Citation marker · 1'], el: trigger, kind: 'frame' },
        { layer: [header, 'Citation marker · 1', '1'], el: trigger, kind: 'text' },
        { layer: identity, el: shadow(el, '.identity'), kind: 'frame', gap: 'row-gap' },
        { layer: [...identity, 'Example source'], el: shadow(el, '.title'), kind: 'text' },
        { layer: [...identity, 'Example publisher'], el: shadow(el, '.host'), kind: 'text' },
        { layer: ['An excerpt supplied by the host.'], el: shadow(el, '.excerpt'), kind: 'text' },
        {
          layer: ['Actions'],
          el: shadow(el, '.preview .actions'),
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['Actions', 'Open source'], el: shadow(el, '.link'), kind: 'frame' },
        { layer: ['Actions', 'Open source', 'Open source'], el: shadow(el, '.link'), kind: 'text' },
        {
          layer: ['Actions', 'Show in sources'],
          el: show,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Actions', 'Show in sources', 'Show in sources'], el: show, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(`odd-citation/Resolved · expanded/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-conversation', () => {
  for (const mode of MODES)
    it(`Two-message feed (${mode})`, async () => {
      await import('../src/conversation/conversation.define.js');
      inMode(mode);
      const el = mount(
        '<odd-conversation></odd-conversation>',
      ) as HTMLElementTagNameMap['odd-conversation'];
      el.state = {
        conversationId: 'c1',
        revision: 1,
        tools: {},
        approvals: {},
        questions: {},
        artifacts: {},
        attempts: {},
        branches: {},
        capabilities: {},
        history: 'complete',
        hasMoreHistory: false,
        feedback: {},
        messages: [
          {
            id: 'm1',
            role: 'user',
            parts: [{ type: 'text', id: 't1', text: 'Summarize this document.' }],
          },
          {
            id: 'm2',
            role: 'assistant',
            parentId: 'm1',
            parts: [{ type: 'text', id: 't2', text: 'Here is the document summary.' }],
          },
        ],
      };
      await settle(el);
      const [user, assistant] = el.shadowRoot!.querySelectorAll('odd-message');
      await settle(user!);
      await settle(assistant!);
      const copy = shadow(
        shadow(assistant!, '[part="footer"] > odd-copy-button'),
        '[part="button"]',
      );
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="feed"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['You'], el: shadow(user!, '.role'), kind: 'text' },
        {
          layer: ['Summarize this document.'],
          el: shadow(user!, '[part="content"]'),
          kind: 'text',
        },
        { layer: ['Assistant'], el: shadow(assistant!, '.role'), kind: 'text' },
        {
          layer: ['Here is the document summary.'],
          el: shadow(assistant!, '[part="content"]'),
          kind: 'text',
        },
        {
          layer: ['Actions'],
          el: shadow(assistant!, '[part="footer"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['Actions', 'Copy'], el: copy, kind: 'frame' },
        { layer: ['Actions', 'Copy', 'Copy'], el: copy, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(`odd-conversation/Two-message feed/${mode}`, {}, targets));
      // The role labels draw in Figma's UI text style, through the UI type role.
      const lineHeight = await figmaLineHeight('Oddkin/UI');
      for (const message of [user!, assistant!])
        expect(getComputedStyle(shadow(message, '.role')).lineHeight).toBe(lineHeight);
      // No margin under the reply's last block: the content ends with its text, as in Figma.
      const response = shadow(assistant!, 'odd-response');
      await settle(response);
      const last = response.shadowRoot!.querySelector('.content')!.lastElementChild!;
      expect(shadow(assistant!, '[part="content"]').getBoundingClientRect().bottom).toBeCloseTo(
        last.getBoundingClientRect().bottom,
        1,
      );
      el.style.setProperty('--odd-type-ui-size', '10px');
      el.style.setProperty('--odd-type-ui-weight', '700');
      el.style.setProperty('--odd-type-ui-line-height', '2');
      el.style.setProperty('--odd-type-ui-letter-spacing', '1px');
      const role = getComputedStyle(shadow(user!, '.role'));
      expect([role.fontSize, role.fontWeight, role.lineHeight, role.letterSpacing]).toEqual([
        '10px',
        '700',
        '20px',
        '1px',
      ]);
    });
});

describe('Figma parity: odd-prompt-input', () => {
  for (const mode of MODES)
    it(`Draft ready (${mode})`, async () => {
      await import('../src/prompt-input/prompt-input.define.js');
      inMode(mode);
      const el = mount(
        '<odd-prompt-input></odd-prompt-input>',
      ) as HTMLElementTagNameMap['odd-prompt-input'];
      el.capabilities = { send: { available: true }, attachments: { available: true } };
      await settle(el);
      const input = shadow(el, '[part="input"]') as HTMLTextAreaElement;
      input.value = 'Summarize this document.';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle(el);
      restyle(input);
      const attach = shadow(el, '[part="toolbar"] > .odd-button');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="form"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Input'], el: input, kind: 'frame' },
        { layer: ['Input', 'Summarize this document.'], el: input, kind: 'text' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="toolbar"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['Actions', 'Attach'], el: attach, kind: 'frame' },
        { layer: ['Actions', 'Attach', 'Attach'], el: attach, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(`odd-prompt-input/Draft ready/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-artifact', () => {
  for (const mode of MODES)
    it(`Preview, first revision (${mode})`, async () => {
      await import('../src/artifact/artifact.define.js');
      inMode(mode);
      const el = mount('<odd-artifact></odd-artifact>') as HTMLElementTagNameMap['odd-artifact'];
      el.artifact = {
        artifactId: 'a1',
        title: 'Example artifact',
        kind: 'markdown',
        currentRevisionId: 'r1',
        revisions: [{ revisionId: 'r1', number: 1, content: 'Example document content.' }],
      };
      await settle(el);
      const button = (selector: string) => shadow(el, selector);
      const copy = shadow(shadow(el, '.actions:not([role]) > odd-copy-button'), '[part="button"]');
      const [download] = el.shadowRoot!.querySelectorAll<HTMLElement>(
        '.actions:not([role]) > .odd-button',
      );
      const heading = 'Artifact title and revision';
      const view = ['Actions', 'View selection'];
      const targets: Target[] = [
        { layer: [], el: shadow(el, '.base'), kind: 'frame', gap: 'row-gap' },
        { layer: [heading, 'Example artifact'], el: shadow(el, '.title'), kind: 'text' },
        {
          layer: [heading, 'Revision 1'],
          el: shadow(el, '[part="header"] > .muted'),
          kind: 'text',
        },
        { layer: ['Actions', 'Copy'], el: copy, kind: 'frame' },
        { layer: ['Actions', 'Copy', 'Copy'], el: copy, kind: 'text' },
        { layer: ['Actions', 'Download'], el: download!, kind: 'frame' },
        { layer: ['Actions', 'Download', 'Download'], el: download!, kind: 'text' },
        { layer: view, el: shadow(el, '.actions[role="group"]'), kind: 'frame', gap: 'column-gap' },
        { layer: [...view, 'Preview'], el: button('[data-view="preview"]'), kind: 'frame' },
        {
          layer: [...view, 'Preview', 'Preview'],
          el: button('[data-view="preview"]'),
          kind: 'text',
        },
        { layer: [...view, 'Source'], el: button('[data-view="source"]'), kind: 'frame' },
        { layer: [...view, 'Source', 'Source'], el: button('[data-view="source"]'), kind: 'text' },
        {
          layer: ['Artifact preview'],
          el: shadow(el, '[part="preview"]'),
          kind: 'frame',
          gap: 'row-gap',
        },
        {
          layer: ['Artifact preview', 'Example document content.'],
          el: shadow(el, '[part="preview"]'),
          kind: 'text',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-artifact/Preview · first revision/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-tool-call (page 10)', () => {
  for (const mode of MODES)
    it(`Arguments ready, not run yet, Details open (${mode})`, async () => {
      await import('../src/tool-call/tool-call.define.js');
      inMode(mode);
      const el = mount('<odd-tool-call></odd-tool-call>') as HTMLElementTagNameMap['odd-tool-call'];
      el.tool = {
        toolCallId: 'write-release-notes',
        toolName: 'write_file',
        title: 'Update release notes',
        purpose: 'Write the reviewed draft to docs/release-notes.md.',
        status: 'input-available',
        input: { path: 'docs/release-notes.md', content: 'Add the launch-readiness checklist.' },
      };
      await settle(el);
      (shadow(el, 'odd-disclosure') as HTMLElementTagNameMap['odd-disclosure']).open = true;
      await settle(el);
      const family = 'Oddkin/AI/ToolCall/Proposal';
      const section = shadow(el, '[part="arguments"]');
      const code = shadow(el, '[part="arguments"] .code');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['tool.title'], el: shadow(el, '.name'), kind: 'text' },
        { layer: ['tool.status'], el: shadow(el, '.state'), kind: 'text' },
        { layer: ['tool.purpose'], el: shadow(el, '.purpose'), kind: 'text' },
        { layer: ['Arguments'], el: section, kind: 'frame', gap: 'row-gap' },
        {
          layer: ['Arguments', 'Arguments'],
          el: shadow(el, '[part="arguments"] .label'),
          kind: 'text',
        },
        { layer: layer(family, 'code viewport'), el: code, kind: 'frame' },
        // The complete arguments' code (the streaming variants name a shorter one).
        {
          layer: layer(family, '{\n  "path": "docs/release-notes.md",\n  "mode"'),
          el: code,
          kind: 'text',
        },
      ];
      await transitions(targets);
      expectNone(
        compare(
          family,
          { Status: 'input-available', Content: 'Typical', Density: 'Full' },
          targets,
        ),
      );
    });

  for (const mode of MODES)
    it(`Failed, retryable, Details closed (${mode})`, async () => {
      await import('../src/tool-call/tool-call.define.js');
      inMode(mode);
      const el = mount('<odd-tool-call></odd-tool-call>') as HTMLElementTagNameMap['odd-tool-call'];
      const message = 'The file changed after this proposal was prepared.';
      el.tool = {
        toolCallId: 'write-release-notes',
        toolName: 'write_file',
        title: 'Update release notes',
        purpose: 'Write the reviewed draft to docs/release-notes.md.',
        status: 'output-error',
        input: { path: 'docs/release-notes.md' },
        error: { code: 'conflict', message },
        retryable: true,
      };
      await settle(el);
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['tool.status'], el: shadow(el, '.state'), kind: 'text' },
        { layer: [message], el: shadow(el, '.failure .error'), kind: 'text' },
      ];
      await transitions(targets);
      expectNone(
        compare(
          'Oddkin/AI/ToolCall/Proposal',
          { Status: 'output-error', Content: 'Retryable', Density: 'Full' },
          targets,
        ),
      );
    });
});

describe('Figma parity: odd-task-plan', () => {
  for (const mode of MODES)
    it(`One done, one active (${mode})`, async () => {
      await import('../src/task-plan/task-plan.define.js');
      inMode(mode);
      const el = mount('<odd-task-plan></odd-task-plan>') as HTMLElementTagNameMap['odd-task-plan'];
      el.plan = {
        planId: 'p1',
        title: 'Example plan',
        steps: [
          { id: 's1', title: 'Read the document', status: 'done' },
          { id: 's2', title: 'Prepare the summary', status: 'active' },
        ],
      };
      await settle(el);
      const steps = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.step')];
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Example plan'], el: shadow(el, '.title'), kind: 'text' },
        { layer: ['1 of 2 complete'], el: shadow(el, '[part="progress"] .muted'), kind: 'text' },
      ];
      for (const [i, row, title, status] of [
        [0, 'Plan step', '✓  Read the document', 'Done'],
        [1, 'Plan step [2]', '◌  Prepare the summary', 'In progress'],
      ] as const) {
        const body = steps[i]!.querySelector<HTMLElement>('.body')!;
        targets.push(
          { layer: [row], el: body, kind: 'frame', gap: 'column-gap' },
          {
            layer: [row, title],
            el: body.querySelector<HTMLElement>('.step-title')!,
            kind: 'text',
          },
          {
            layer: [row, status],
            el: body.querySelector<HTMLElement>(':scope > .muted')!,
            kind: 'text',
          },
        );
      }
      await transitions(targets);
      expectNone(compare(`odd-task-plan/One done · one active/${mode}`, {}, targets));
    });
});

describe('Figma parity: odd-question', () => {
  for (const mode of MODES)
    it(`Choice, requested (${mode})`, async () => {
      await import('../src/question/question.define.js');
      inMode(mode);
      const el = mount('<odd-question></odd-question>') as HTMLElementTagNameMap['odd-question'];
      el.question = {
        questionId: 'q1',
        revision: 1,
        prompt: 'Which format would you prefer?',
        kind: 'choice',
        options: [
          { id: 'short', label: 'Short summary' },
          { id: 'detailed', label: 'Detailed summary' },
        ],
        status: 'requested',
      };
      await settle(el);
      const [first, second] = el.shadowRoot!.querySelectorAll<HTMLElement>('.option');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="form"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Which format would you prefer?'], el: shadow(el, '.prompt'), kind: 'text' },
        { layer: ['○  Short summary'], el: first!, kind: 'text' },
        { layer: ['○  Detailed summary'], el: second!, kind: 'text' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="actions"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-question/Choice · requested/${mode}`, {}, targets));
      // As the specimen: the prompt and each option space.xs apart.
      const top = (node: Element) => node.getBoundingClientRect().top;
      const bottom = (node: Element) => node.getBoundingClientRect().bottom;
      expect(Math.round(top(second!) - bottom(first!))).toBe(space(el, 'xs'));
    });
});

describe('Figma parity: odd-checkpoint', () => {
  for (const mode of MODES)
    it(`Available (${mode})`, async () => {
      await import('../src/checkpoint/checkpoint.define.js');
      inMode(mode);
      const el = mount(
        '<odd-checkpoint></odd-checkpoint>',
      ) as HTMLElementTagNameMap['odd-checkpoint'];
      el.checkpoint = {
        checkpointId: 'c1',
        label: 'Before revision',
        description: 'Saved document state.',
        restores: ['Document content'],
        status: 'available',
      };
      el.capabilities = { restoreCheckpoint: { available: true } };
      await settle(el);
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Before revision'], el: shadow(el, '.label'), kind: 'text' },
        { layer: ['Saved document state.'], el: shadow(el, '.description'), kind: 'text' },
        {
          layer: ['Restoring replaces:'],
          el: shadow(el, '[part="restores"]').previousElementSibling!,
          kind: 'text',
        },
        { layer: ['• Document content'], el: shadow(el, '[part="restores"] li'), kind: 'text' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="actions"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-checkpoint/Available/${mode}`, {}, targets));
      // As the specimen: the list starts at the text's edge, space.xs under its lead-in.
      const list = shadow(el, '[part="restores"]');
      const lead = list.previousElementSibling!.getBoundingClientRect();
      const item = list.querySelector('li')!.getBoundingClientRect();
      expect(Math.round(item.left)).toBe(Math.round(lead.left));
      expect(Math.round(item.top - lead.bottom)).toBe(space(el, 'xs'));
    });
});

describe('Figma parity: odd-change-review', () => {
  for (const mode of MODES)
    it(`Proposed, split view (${mode})`, async () => {
      await import('../src/change-review/change-review.define.js');
      inMode(mode);
      const el = mount(
        '<odd-change-review view="split"></odd-change-review>',
      ) as HTMLElementTagNameMap['odd-change-review'];
      el.proposals = [
        {
          proposalId: 'p1',
          baseRevision: 'v1',
          range: { start: 0, end: 13 },
          original: 'Original text',
          replacement: 'Revised text',
          status: 'requested',
        },
      ];
      await settle(el);
      const [before, after] = el.shadowRoot!.querySelectorAll<HTMLElement>('.split > .side');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '.body'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Actions'], el: shadow(el, '.split'), kind: 'frame', gap: 'column-gap' },
        { layer: ['Actions', 'Before'], el: before!, kind: 'frame', gap: 'row-gap' },
        { layer: ['Actions', 'Before', 'Before'], el: before!.querySelector('p')!, kind: 'text' },
        {
          layer: ['Actions', 'Before', 'Original text'],
          el: before!.querySelector('del')!,
          kind: 'text',
        },
        { layer: ['Actions', 'After'], el: after!, kind: 'frame', gap: 'row-gap' },
        { layer: ['Actions', 'After', 'After'], el: after!.querySelector('p')!, kind: 'text' },
        {
          layer: ['Actions', 'After', 'Revised text'],
          el: after!.querySelector('ins')!,
          kind: 'text',
        },
        {
          layer: ['Actions [2]'],
          el: shadow(el, '[part="actions"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-change-review/Proposed · split view/${mode}`, {}, targets));
      // As the specimen, the split view's sides are the cards: the proposal around them is not.
      const proposal = getComputedStyle(shadow(el, '[part="proposal"]'));
      expect([proposal.borderTopStyle, proposal.paddingTop]).toEqual(['none', '0px']);
      expect(proposal.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });
});

describe('Figma parity: odd-action-approval', () => {
  for (const mode of MODES)
    it(`Requested (${mode})`, async () => {
      await import('../src/action-approval/action-approval.define.js');
      inMode(mode);
      const el = mount(
        '<odd-action-approval></odd-action-approval>',
      ) as HTMLElementTagNameMap['odd-action-approval'];
      el.approval = {
        approvalId: 'ap1',
        revision: 1,
        title: 'Update example document',
        summary: 'Review the proposed change.',
        target: 'example.txt',
        changes: [{ label: '', before: 'Original text', after: 'Revised text' }],
        risk: 'low',
        status: 'requested',
      };
      el.capabilities = { respondToApproval: { available: true } };
      await settle(el);
      // Not compared, as page 09 redraws them: the specimen's reason ("Reason (optional)" over a
      // native field) is page 08's ReasonField, collapsed in an odd-disclosure until opened
      // (compared below); its risk line is a badge; and its changes' "Before: …" and "After: …"
      // lines are the shared diff view's Before and After blocks.
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Update example document'], el: shadow(el, '.title'), kind: 'text' },
        { layer: ['Review the proposed change.'], el: shadow(el, '.summary'), kind: 'text' },
        { layer: ['Affects: example.txt'], el: shadow(el, '.target'), kind: 'text' },
        { layer: ['Waiting for your decision'], el: shadow(el, '.state'), kind: 'text' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="actions"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-action-approval/Requested/${mode}`, {}, targets));
    });
});

// Page 08's ReasonField (`Oddkin/AI/Internal/ReasonField`): the approval's reason, a native
// textarea drawn by the components' field sheets in an odd-disclosure whose summary shows the
// label the specimen draws above the field (ADR 0049). Its states: Empty (the placeholder), Filled,
// Focus (the ring), and Disabled (while a decision is pending, the disclosure with it).
describe('Figma parity: the reason field (page 08)', () => {
  for (const mode of MODES)
    it(`Empty, Filled, Focus, and Disabled (${mode})`, async () => {
      await import('../src/action-approval/action-approval.define.js');
      inMode(mode);
      const el = mount(
        '<odd-action-approval></odd-action-approval>',
      ) as HTMLElementTagNameMap['odd-action-approval'];
      el.approval = { approvalId: 'ap1', revision: 1, title: 'Deploy', status: 'requested' };
      el.capabilities = { respondToApproval: { available: true } };
      await settle(el);
      const disclosure = shadow(el, '.reason') as HTMLElementTagNameMap['odd-disclosure'];
      disclosure.open = true;
      await settle(disclosure);
      const field = shadow(el, '.reason textarea') as HTMLTextAreaElement;
      const label = disclosure.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
      const expectState = async (state: string) => {
        restyle(field);
        const path = [`Textarea / ${state}`];
        const targets: Target[] = [
          { layer: [...path, 'Surface'], el: field, kind: state === 'Focus' ? 'ring' : 'frame' },
          {
            layer: [...path, 'Surface', 'reason draft'],
            el: field,
            kind: 'text',
            ...(field.value ? {} : { pseudo: '::placeholder' }),
          },
          { layer: [...path, 'reason label'], el: label, kind: 'text' },
        ];
        await transitions(targets);
        expectNone(compare('Oddkin/AI/Internal/ReasonField', { State: state }, targets));
      };
      await expectState('Empty');
      field.value = 'Use the pilot region agreed with the support team.';
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await settle(el);
      await expectState('Filled');
      field.focus();
      await expectState('Focus');
      field.blur();
      shadow(el, '[data-action="approve"]').click();
      await settle(el);
      await expectState('Disabled');
    });
});

// The decision row of page 08 (805:3, `Oddkin/AI/Internal/DecisionRow/*`): a family per operation,
// a variant per state. Each state's frame and lines bind tokens; its buttons are named with their
// state (`native button · Approve · Loading`), and the row shows those and no others, nor any line
// the state does not draw. Full density (the approval in a 40rem container): the approval's narrow
// arrangement stacks the same buttons full width at the theme density's height, where pages 08 and
// 09 draw 48 px (the elements tests measure that; ADR 0049). Not compared: the change review's, the
// dismissal's, and the undo's Unavailable (the review has no capabilities), and the confirmation's
// Failed and Unavailable (a restore request has no failure of its own before the record says
// `restore-failed`, and Restore… does not open the confirmation while restoring is unavailable).
// A failed proposal keeps the buttons of what failed (ADR 0049, "Pages 10 to 14"), so the review's
// three rows compare their Failed.
describe('Figma parity: the decision row (page 08)', () => {
  const LINES: [RegExp, string][] = [
    [/error/, '.decision-error'],
    [/pending/, '.pending'],
    [/capability reason/, '.decision-reason'],
    [/^state · /, '.outcome'],
  ];
  const STATE = /^native button · (.+) · (Default|Disabled|Loading)$/;
  /** Compares one state of `family`: the row in `root` (the row itself, or what holds it). */
  const expectState = async (family: string, state: string, root: ParentNode) => {
    const values = { State: state, Density: 'Full' };
    const layers = layersOf(figma.get(family)!, variantIndex(figma.get(family)!, values));
    const row =
      root instanceof Element && root.matches('.decision')
        ? root
        : root.querySelector<HTMLElement>('.decision');
    const targets: Target[] = row ? [{ layer: [], el: row, kind: 'frame', gap: 'row-gap' }] : [];
    const drawn: string[] = [];
    const lines: string[] = [];
    for (const l of layers) {
      const name = l.path.at(-1)!;
      const button = STATE.exec(name);
      if (button) drawn.push(`${button[1]} ${button[2]}`);
      else if (l.types.includes('FRAME'))
        targets.push({
          layer: l.path,
          el: root.querySelector('[part="actions"]')!,
          kind: 'frame',
          gap: 'column-gap',
          fields: [['counterAxisSpacing', 'row-gap']],
        });
      else if (l.types.includes('TEXT')) {
        const selector = LINES.find(([pattern]) => pattern.test(name))![1];
        lines.push(selector);
        targets.push({ layer: l.path, el: root.querySelector(selector)!, kind: 'text' });
      }
    }
    const shown = [...root.querySelectorAll('[part="actions"] odd-button')].map(
      (b) =>
        `${b.textContent!.trim()} ${b.hasAttribute('loading') ? 'Loading' : b.hasAttribute('disabled') ? 'Disabled' : 'Default'}`,
    );
    const visible = LINES.map(([, selector]) => selector).filter((selector) => {
      const line = root.querySelector<HTMLElement>(selector);
      return !!line && !line.hidden;
    });
    await transitions(targets);
    expectNone(compare(family, values, targets));
    expect(shown.sort(), `${family} ${state}: buttons`).toEqual(drawn.sort());
    expect(visible, `${family} ${state}: lines`).toEqual(
      LINES.map(([, s]) => s).filter((s) => lines.includes(s)),
    );
  };
  const click = async (el: HTMLElement, action: string) => {
    shadow(el, `[data-action="${action}"]`).click();
    await settle(el);
  };

  for (const mode of MODES) {
    it(`Approval (${mode})`, async () => {
      await import('../src/action-approval/action-approval.define.js');
      inMode(mode);
      const el = mount(
        '<odd-action-approval></odd-action-approval>',
      ) as HTMLElementTagNameMap['odd-action-approval'];
      el.parentElement!.style.inlineSize = '40rem';
      type Approval = NonNullable<typeof el.approval>;
      let revision = 0;
      const show = async (
        status: Approval['status'],
        extra: Partial<Approval> = {},
        capabilities: typeof el.capabilities = {
          respondToApproval: { available: true },
          editApproval: { available: true },
        },
      ) => {
        el.capabilities = capabilities;
        el.approval = {
          approvalId: 'ap1',
          revision: ++revision,
          title: 'Deploy',
          status,
          ...extra,
        };
        await settle(el);
      };
      const family = 'Oddkin/AI/Internal/DecisionRow/Approval';
      await show('requested');
      await expectState(family, 'Ready', el.shadowRoot!);
      await click(el, 'approve');
      await expectState(family, 'SubmittingPrimary', el.shadowRoot!);
      await show('requested');
      await click(el, 'reject');
      await expectState(family, 'SubmittingSecondary', el.shadowRoot!);
      await show('failed', { error: { code: 'x', message: 'The service did not answer.' } });
      await expectState(family, 'Failed', el.shadowRoot!);
      await show('approved');
      await expectState(family, 'Resolved', el.shadowRoot!);
      await show('rejected');
      await expectState(family, 'ResolvedSecondary', el.shadowRoot!);
      await show('requested', {}, { editApproval: { available: true } });
      await expectState(family, 'Unavailable', el.shadowRoot!);
    });

    it(`Question (${mode})`, async () => {
      await import('../src/question/question.define.js');
      inMode(mode);
      const el = mount('<odd-question></odd-question>') as HTMLElementTagNameMap['odd-question'];
      type Question = NonNullable<typeof el.question>;
      let revision = 0;
      const show = async (
        status: Question['status'],
        extra: Partial<Question> = {},
        capabilities?: typeof el.capabilities,
      ) => {
        el.capabilities = capabilities;
        el.question = {
          questionId: 'q1',
          revision: ++revision,
          prompt: 'Which format?',
          kind: 'choice',
          options: [
            { id: 'short', label: 'Short' },
            { id: 'long', label: 'Detailed' },
          ],
          status,
          ...extra,
        };
        await settle(el);
      };
      const family = 'Oddkin/AI/Internal/DecisionRow/Question';
      await show('requested');
      await expectState(family, 'Ready', el.shadowRoot!);
      shadow(el, 'input[name="choice"]').click();
      await click(el, 'answer');
      await expectState(family, 'SubmittingPrimary', el.shadowRoot!);
      await show('requested');
      await click(el, 'skip');
      await expectState(family, 'SubmittingSecondary', el.shadowRoot!);
      await show('failed', { error: { code: 'x', message: 'The service did not answer.' } });
      await expectState(family, 'Failed', el.shadowRoot!);
      await show('answered');
      await expectState(family, 'Resolved', el.shadowRoot!);
      await show('skipped');
      await expectState(family, 'ResolvedSecondary', el.shadowRoot!);
      await show('requested', {}, {});
      await expectState(family, 'Unavailable', el.shadowRoot!);
    });

    it(`Change review: accept, dismiss, undo (${mode})`, async () => {
      await import('../src/change-review/change-review.define.js');
      inMode(mode);
      const el = mount(
        '<odd-change-review></odd-change-review>',
      ) as HTMLElementTagNameMap['odd-change-review'];
      type Proposal = (typeof el.proposals)[number];
      let id = 0;
      const show = async (status: Proposal['status'], extra: Partial<Proposal> = {}) => {
        el.proposals = [
          {
            proposalId: `p${++id}`,
            baseRevision: 'v1',
            range: { start: 0, end: 13 },
            original: 'Original text',
            replacement: 'Revised text',
            status,
            ...extra,
          },
        ];
        await settle(el);
      };
      /** The proposal, or only its decision row (without the line above it). */
      const item = () => shadow(el, '.proposal');
      const row = () => shadow(el, '.proposal .decision');
      const review = 'Oddkin/AI/Internal/DecisionRow/ChangeReview';
      await show('requested');
      await expectState(review, 'Ready', item());
      await click(el, 'accept');
      await expectState(review, 'SubmittingPrimary', item());
      await show('requested');
      await click(el, 'reject');
      await expectState(review, 'SubmittingSecondary', item());
      await show('applied', { undoable: false });
      await expectState(review, 'Resolved', item());
      await show('rejected');
      await expectState(review, 'ResolvedSecondary', item());
      // A failure keeps the buttons of what failed, with its error (ADR 0049, "Pages 10 to 14").
      const error = { code: 'x', message: 'The document is unavailable.' };
      await show('failed', { error });
      await expectState(review, 'Failed', item());
      const dismiss = 'Oddkin/AI/Internal/DecisionRow/ReviewDismiss';
      await show('stale');
      await expectState(dismiss, 'Ready', row());
      await click(el, 'dismiss');
      await expectState(dismiss, 'Submitting', row());
      el.proposals = [{ ...el.proposals[0]!, status: 'failed', error }];
      await settle(el);
      await expectState(dismiss, 'Failed', row());
      el.proposals = [{ ...el.proposals[0]!, status: 'stale' }];
      await settle(el);
      await click(el, 'dismiss');
      el.proposals = [{ ...el.proposals[0]!, status: 'rejected' }];
      await settle(el);
      await expectState(dismiss, 'Resolved', item());
      const undo = 'Oddkin/AI/Internal/DecisionRow/ReviewUndo';
      await show('applied', { undoable: true });
      await expectState(undo, 'Ready', row());
      await click(el, 'undo');
      await expectState(undo, 'Submitting', row());
      el.proposals = [{ ...el.proposals[0]!, status: 'undone' }];
      await settle(el);
      await expectState(undo, 'Resolved', item());
      await show('failed', { appliedRevision: 'v2', error });
      await expectState(undo, 'Failed', row());
    });

    it(`Checkpoint and its confirmation (${mode})`, async () => {
      await import('../src/checkpoint/checkpoint.define.js');
      inMode(mode);
      const el = mount(
        '<odd-checkpoint></odd-checkpoint>',
      ) as HTMLElementTagNameMap['odd-checkpoint'];
      type Checkpoint = NonNullable<typeof el.checkpoint>;
      const show = async (
        status: Checkpoint['status'],
        extra: Partial<Checkpoint> = {},
        available = true,
      ) => {
        el.capabilities = { restoreCheckpoint: { available } };
        el.checkpoint = {
          checkpointId: 'c1',
          label: 'Before revision',
          description: 'Saved document state.',
          restores: ['Document content'],
          status,
          ...extra,
        };
        await settle(el);
      };
      const family = 'Oddkin/AI/Internal/DecisionRow/Checkpoint';
      await show('available');
      await expectState(family, 'Ready', el.shadowRoot!);
      await show('restore-pending');
      await expectState(family, 'SubmittingPrimary', el.shadowRoot!);
      await show('restore-failed', { error: { code: 'x', message: 'The file is locked.' } });
      await expectState(family, 'Failed', el.shadowRoot!);
      await show('restored', { outcome: 'Restored the document to 09:30.' });
      await expectState(family, 'Resolved', el.shadowRoot!);
      await show('available', {}, false);
      await expectState(family, 'Unavailable', el.shadowRoot!);
      const confirmation = 'Oddkin/AI/Internal/DecisionRow/CheckpointConfirmation';
      await show('available');
      await click(el, 'restore');
      await expectState(confirmation, 'Ready', shadow(el, '.confirm'));
      await click(el, 'confirm');
      await expectState(confirmation, 'Submitting', shadow(el, '.confirm'));
      await show('restored', { outcome: 'Restored the document to 09:30.' });
      await expectState(confirmation, 'Resolved', el.shadowRoot!);
    });
  }
});

// The context picker on the owner's C07 design (Figma page 06, 767:2; `Oddkin/AI/ContextPicker/*`).
// The surface is Figma's popover (`Oddkin/Common/popover`, Picker) holding the picker content; its
// buttons are md native buttons compared with `Oddkin/Common/button`; its rows with `ResourceRow`
// and its feedback with `Feedback`, each in the state the surface draws; the sheet with
// `MobileSurface` and the expanded browser with `ExpandedBrowser`. Not compared here: the host's
// compositions (`SelectedChip`, `SelectedOverflow`, `SelectedAttachment`: the pattern's), the
// design-only frames, and the chips of the browser's review (odd-chip, compared with
// `Oddkin/Common/chip` in the components' parity).
describe('Figma parity: odd-context-picker (page 06)', () => {
  type Picker = HTMLElementTagNameMap['odd-context-picker'];
  type Resource = Picker['value'][number];
  const SURFACE = 'Oddkin/AI/ContextPicker/Surface';
  const ROW = 'Oddkin/AI/ContextPicker/ResourceRow';
  const FEEDBACK = 'Oddkin/AI/ContextPicker/Feedback';
  const content = (...path: string[]) => [
    'Oddkin popover · linked primitive',
    'Content',
    'Picker content',
    ...path,
  ];
  const sources = [
    { id: 'drive', label: 'Drive', description: '240 resources', browse: true },
    { id: 'wiki', label: 'Wiki', description: '86 pages', browse: true },
    { id: 'records', label: 'Records' },
  ];
  const brief: Resource = {
    sourceId: 'drive',
    id: 'brief',
    label: 'Launch brief',
    type: 'document',
    path: 'Product / Launch',
    description: '2h ago',
  };
  const checklist: Resource = {
    sourceId: 'wiki',
    id: 'checklist',
    label: 'Launch checklist',
    type: 'page',
    path: 'Platform team',
    description: 'Yesterday',
  };
  const acme: Resource = {
    sourceId: 'records',
    id: 'acme',
    label: 'Acme renewal',
    type: 'account',
  };
  const notes: Resource = {
    sourceId: 'drive',
    id: 'notes',
    label: 'Pricing notes',
    type: 'document',
    unavailable: 'Access changed · Remove or replace',
  };
  const BUTTON = {
    primary: 'Button / Default',
    secondary: 'Button / Secondary',
    ghost: 'Button / Ghost',
  };
  /** Differences of a native button from Figma's md button of that appearance. */
  const button = (el: HTMLElement | undefined, appearance: keyof typeof BUTTON, what: string) => {
    expect(el, what).toBeTruthy();
    const frame = BUTTON[appearance];
    return compare(
      'Oddkin/Common/button',
      { Appearance: appearance, Size: 'md', State: 'Default' },
      [
        { layer: [frame], el: el!, kind: 'frame' },
        { layer: [frame, 'Label'], el: el!, kind: 'text' },
      ],
    ).map((line) => `${what}: ${line}`);
  };
  const named = (el: Picker, label: string) =>
    [...el.shadowRoot!.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.textContent!.trim() === label,
    );
  const rows = (el: Picker) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]')];
  const rowTargets = (row: HTMLElement, name: string, meta: string, ring = false): Target[] => [
    ring
      ? { layer: [], el: row, kind: 'ring' }
      : {
          layer: [],
          el: row,
          kind: 'frame',
          gap: 'column-gap',
          fields: [
            ['paddingRight', 'padding-inline-end'],
            ['paddingBottom', 'padding-block-end'],
            ['bottomRightRadius', 'border-end-end-radius'],
          ],
        },
    { layer: ['Identity and provenance'], el: row.querySelector('.option-label')!, kind: 'frame' },
    { layer: ['Identity and provenance', name], el: row.querySelector('.name')!, kind: 'text' },
    {
      layer: ['Identity and provenance', meta],
      el: row.querySelector('.option-description')!,
      kind: 'text',
    },
  ];
  /** A picker the host answers: `answer` gives the latest query these results. */
  const open = async (setup: (el: Picker) => void = () => {}) => {
    await import('../src/context-picker/context-picker.define.js');
    const el = mount('<odd-context-picker></odd-context-picker>') as Picker;
    el.sources = sources;
    el.multiple = true;
    setup(el);
    let latest = '';
    el.addEventListener('odd-context-query', ({ detail }) => (latest = detail.requestId));
    await settle(el);
    shadow(el, '[part="trigger"]').click();
    await settle(el);
    const answer = async (results: Omit<NonNullable<Picker['results']>, 'requestId'>) => {
      el.results = { requestId: latest, ...results };
      await settle(el);
    };
    const search = async (query: string) => {
      const field = shadow(el, '[part="search"]') as HTMLInputElement;
      field.value = query;
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await new Promise((resolve) => setTimeout(resolve, 260));
      await settle(el);
    };
    return { el, answer, search };
  };
  const complete = (...ids: string[]) =>
    ids.map((sourceId) => ({ sourceId, status: 'complete' as const }));
  // The surface is placed in the viewport: room for Figma's 416 × 480 below the trigger.
  let viewport: [number, number];
  beforeAll(async () => {
    viewport = [window.innerWidth, window.innerHeight];
    await page.viewport(1024, 800);
  });
  afterAll(() => page.viewport(...viewport));

  for (const mode of MODES) {
    it(`Surface, search results (${mode})`, async () => {
      inMode(mode);
      const { el, answer, search } = await open((el) => (el.value = [brief, acme, notes]));
      await search('launch');
      await answer({
        items: [brief, checklist, { ...brief, id: 'retro', label: 'Launch retrospective' }],
        sources: complete('drive', 'wiki', 'records'),
        total: 12,
      });
      const surface = shadow(el, '[part="surface"]');
      const searchbox = shadow(el, '[part="search"]') as HTMLInputElement;
      // The search field is Figma's inline search, focused (`Oddkin/Common/search`, 775:3422),
      // whose label, help, and clear button are hidden.
      const inline: Target[] = [
        { layer: ['Search input / Focus', 'Surface'], el: searchbox, kind: 'frame' },
        {
          layer: ['Search input / Focus', 'Surface', 'Search resources'],
          el: searchbox,
          kind: 'text',
        },
        { layer: ['Search input / Focus', 'Surface [2]'], el: searchbox, kind: 'ring' },
      ];
      expect(searchbox.matches(':focus-visible')).toBe(true);
      const targets: Target[] = [
        {
          layer: content(),
          el: shadow(el, '.content'),
          kind: 'frame',
          gap: 'row-gap',
          fields: [
            ['paddingRight', 'padding-inline-end'],
            ['paddingBottom', 'padding-block-end'],
          ],
        },
        { layer: content('Header'), el: shadow(el, '.header'), kind: 'frame', gap: 'column-gap' },
        { layer: content('Header', 'Add context'), el: shadow(el, '.title'), kind: 'text' },
        {
          layer: content('Scope and view'),
          el: shadow(el, '.scope-row'),
          kind: 'frame',
          gap: 'column-gap',
        },
        {
          layer: content('12 matches · Drive, Wiki and Records'),
          el: shadow(el, '.status-line'),
          kind: 'text',
        },
        {
          layer: content('Scrollable results · listbox'),
          el: shadow(el, '[part="results"]'),
          kind: 'frame',
          gap: 'row-gap',
        },
        { layer: content('Footer'), el: shadow(el, '.footer'), kind: 'frame', gap: 'column-gap' },
        { layer: content('Footer', '3 selected'), el: shadow(el, '.count'), kind: 'text' },
      ];
      await transitions([...targets, ...inline]);
      expectNone([
        ...compare('Oddkin/Common/popover', { State: 'Picker' }, [
          {
            layer: [],
            el: surface,
            kind: 'frame',
            fields: [
              ['strokeRightWeight', 'border-inline-end-width'],
              ['bottomRightRadius', 'border-end-end-radius'],
            ],
          },
        ]),
        ...compare(SURFACE, { State: 'Search results' }, targets),
        ...compare('Oddkin/Common/search', { State: 'Inline focus' }, inline),
        ...button(named(el, 'Close'), 'ghost', 'Close'),
        ...button(named(el, 'Selected (3)'), 'ghost', 'Selected (3)'),
        ...button(named(el, 'Browse…'), 'ghost', 'Browse…'),
        ...button(named(el, 'Done'), 'secondary', 'Done'),
        ...compare(
          ROW,
          { Selection: 'Multiple', Selected: 'True', State: 'Default' },
          rowTargets(rows(el)[0]!, 'Launch brief', 'Drive · Product / Launch · Updated 2h ago'),
        ),
        ...compare(
          ROW,
          { Selection: 'Multiple', Selected: 'False', State: 'Default' },
          rowTargets(rows(el)[1]!, 'Launch brief', 'Drive · Product / Launch · Updated 2h ago'),
        ),
      ]);
      // Figma's 416 × 480 surface, its parts space.xs apart inside.
      const box = surface.getBoundingClientRect();
      expect([box.width, box.height]).toEqual([416, 480]);
      // Figma's inline search: the 40 px field space.2xs in on every side of its 398 × 48 box, which
      // its focus ring fills; a text searchbox, so no engine adds a clear button Figma does not draw.
      const field = shadow(el, '.search-field').getBoundingClientRect();
      expect([field.width, field.height]).toEqual([398, 48]);
      const input = searchbox.getBoundingClientRect();
      expect([input.width, input.height]).toEqual([390, 40]);
      expect([searchbox.type, searchbox.getAttribute('role')]).toEqual(['text', 'searchbox']);
      // Its search icon: 20 × 20 (`icon.size.md`), 12 px in and centred; the text 40 px in.
      const glyph = shadow(el, '.search-field .glyph').getBoundingClientRect();
      expect([glyph.width, glyph.height]).toEqual([20, 20]);
      expect(glyph.left - input.left).toBeCloseTo(12, 1);
      expect(glyph.top - input.top).toBeCloseTo(10, 1);
      expect(getComputedStyle(searchbox).paddingInlineStart).toBe('40px');
      // The footer is as tall as its md buttons (Figma's 40), and each row 56 (3.5rem).
      expect(shadow(el, '.footer').getBoundingClientRect().height).toBe(40);
      expect(rows(el).map((row) => row.getBoundingClientRect().height)).toEqual([56, 56, 56]);
      // The title's line height: parity.ts compares only Figma's line heights given in pixels.
      expect(getComputedStyle(shadow(el, '.title')).lineHeight).toBe(
        await figmaLineHeight('Oddkin/Component/AI/title'),
      );
    });

    it(`Resource type: the document icon, and the icon of a kind (${mode})`, async () => {
      inMode(mode);
      const folder =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Crect width="20" height="16"/%3E%3C/svg%3E';
      const { el, answer } = await open((el) => (el.icons = { folder }));
      await answer({
        items: [brief, { ...brief, id: 'folder', label: 'Launch folder', kind: 'folder' }],
        sources: complete('drive', 'wiki', 'records'),
      });
      // Figma's ResourceType: a 20 px icon in each row.
      for (const row of rows(el)) {
        const icon = row.querySelector('.option-icon > *')!.getBoundingClientRect();
        expect([icon.width, icon.height]).toEqual([20, 20]);
      }
      expect(rows(el)[0]!.querySelector('.option-icon svg')).not.toBeNull();
      expect(rows(el)[1]!.querySelector('.option-icon odd-icon')!.getAttribute('src')).toBe(folder);
    });

    it(`Resource rows: hover, focus, single, unavailable, limit (${mode})`, async () => {
      inMode(mode);
      const meta = 'Drive · Product / Launch · Updated 2h ago';
      const { el, answer } = await open((el) => (el.value = [notes]));
      await answer({ items: [brief, notes], sources: complete('drive', 'wiki', 'records') });
      await userEvent.hover(rows(el)[0]!);
      const hover = rowTargets(rows(el)[0]!, 'Launch brief', meta);
      await transitions(hover);
      const differences = compare(
        ROW,
        { Selection: 'Multiple', Selected: 'False', State: 'Hover' },
        hover,
      );
      await userEvent.unhover(rows(el)[0]!);
      await userEvent.keyboard('{ArrowDown}');
      await settle(el);
      differences.push(
        ...compare(
          ROW,
          { Selection: 'Multiple', Selected: 'False', State: 'Focus' },
          rowTargets(rows(el)[0]!, 'Launch brief', meta, true),
        ),
        ...compare(
          ROW,
          { Selection: 'Multiple', Selected: 'True', State: 'Unavailable' },
          rowTargets(rows(el)[1]!, 'Pricing notes', 'Drive · Access changed · Remove or replace'),
        ),
      );
      await userEvent.keyboard('{ArrowDown}');
      await settle(el);
      differences.push(
        ...compare(
          ROW,
          { Selection: 'Multiple', Selected: 'True', State: 'Focus' },
          rowTargets(rows(el)[1]!, 'Launch brief', meta, true),
        ),
      );
      expect(rows(el)[1]!.querySelector('.option-description')!.textContent).toBe(
        'Drive · Access changed · Remove or replace',
      );
      el.max = 1;
      await settle(el);
      differences.push(
        ...compare(
          ROW,
          { Selection: 'Multiple', Selected: 'False', State: 'Disabled' },
          rowTargets(rows(el)[0]!, 'Launch brief', meta),
        ),
      );
      el.max = 0;
      el.multiple = false;
      el.value = [brief];
      await settle(el);
      differences.push(
        ...compare(
          ROW,
          { Selection: 'Single', Selected: 'True', State: 'Default' },
          rowTargets(rows(el)[0]!, 'Launch brief', meta),
        ),
      );
      expectNone(differences);
      // Figma's radio for a single choice: the indicator round, its dot shown.
      const box = rows(el)[0]!.querySelector<HTMLElement>('.indicator-box')!;
      expect(parseFloat(getComputedStyle(box).borderTopLeftRadius)).toBeGreaterThanOrEqual(
        box.getBoundingClientRect().width / 2,
      );
      expect(getComputedStyle(rows(el)[0]!.querySelector('.indicator-dot')!).visibility).toBe(
        'visible',
      );
      // Long text: two lines of name and two of metadata at most.
      const long = 'Customer onboarding research — APAC enterprise accounts, interviews and notes';
      el.results = {
        ...el.results!,
        items: [
          {
            ...brief,
            label: `${long}, ${long}`,
            path: 'Knowledge base / Customer research / 2026 / Interviews / Enterprise / APAC',
            description: long,
          },
        ],
      };
      await settle(el);
      for (const part of ['.name', '.option-description']) {
        const text = rows(el)[0]!.querySelector<HTMLElement>(part)!;
        const lines =
          text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight);
        expect(Math.round(lines), part).toBe(2);
        expect(text.scrollHeight, `${part} is clamped`).toBeGreaterThan(text.clientHeight);
      }
    });

    // Vitest cannot hold a pointer down: Chromium does it through CDP, released on the title.
    it.runIf(server.browser === 'chromium')(`Resource row, pressed (${mode})`, async () => {
      inMode(mode);
      const { el, answer } = await open();
      await answer({ items: [brief], sources: complete('drive', 'wiki', 'records') });
      const row = rows(el)[0]!;
      const targets = rowTargets(row, 'Launch brief', 'Drive · Product / Launch · Updated 2h ago');
      const mouse = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', at: Element) => {
        const { x, y } = at.getBoundingClientRect();
        return cdp().send('Input.dispatchMouseEvent', {
          type,
          x: x + 4,
          y: y + 4,
          button: 'left',
          clickCount: 1,
        });
      };
      await mouse('mousePressed', row);
      try {
        await transitions(targets);
        expectNone(
          compare(ROW, { Selection: 'Multiple', Selected: 'False', State: 'Pressed' }, targets),
        );
      } finally {
        await mouse('mouseMoved', shadow(el, '.title'));
        await mouse('mouseReleased', shadow(el, '.title'));
      }
      expect(el.value, 'a press released elsewhere chooses nothing').toEqual([]);
    });

    it(`Feedback: failure, no matches, loading, no resources (${mode})`, async () => {
      inMode(mode);
      const { el, answer, search } = await open();
      const feedback = (state: string, frame: string, title: string, text: string) =>
        compare(FEEDBACK, { State: state }, [
          {
            layer: [frame],
            el: shadow(el, '.feedback'),
            kind: 'frame',
            gap: 'row-gap',
            fields: [
              ['paddingRight', 'padding-inline-end'],
              ['paddingBottom', 'padding-block-end'],
            ],
          },
          { layer: [frame, title], el: shadow(el, '.feedback-title'), kind: 'text' },
          { layer: [frame, text], el: shadow(el, '.feedback-text'), kind: 'text' },
        ]);
      const differences = [
        ...feedback(
          'Loading',
          'Loading resources',
          'Loading resources',
          'Getting recent resources from Drive, Wiki and Records.',
        ),
        ...compare(FEEDBACK, { State: 'Loading' }, [
          {
            layer: ['Loading resources', 'Loading skeleton'],
            el: shadow(el, '.placeholder'),
            kind: 'frame',
          },
        ]),
        ...compare(SURFACE, { State: 'Loading' }, [
          {
            layer: content('Loading · 3 connected sources'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
        ]),
      ];
      // The text's line height: parity.ts compares only Figma's line heights given in pixels.
      expect(getComputedStyle(shadow(el, '.feedback-text')).lineHeight).toBe(
        await figmaLineHeight('Oddkin/Component/Field/small'),
      );
      await search('launch');
      await answer({ items: [], sources: [{ sourceId: 'drive', status: 'failed' }] });
      differences.push(
        ...feedback(
          'Search failure',
          'Drive could not be searched',
          'Drive could not be searched',
          'Your selections are safe. Try searching this source again.',
        ),
        ...button(named(el, 'Retry search'), 'secondary', 'Retry search'),
        ...compare(SURFACE, { State: 'Search failure' }, [
          {
            layer: content('Drive search failed · results unknown'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
        ]),
      );
      await search('frostlight');
      await answer({ items: [], sources: complete('drive', 'wiki', 'records') });
      differences.push(
        ...feedback(
          'No matches',
          'No matches in Drive',
          'No matches in Drive',
          'Try another name, clear filters or choose All sources.',
        ),
        ...button(named(el, 'Clear search'), 'ghost', 'Clear search'),
      );
      named(el, 'Clear search')!.click();
      await settle(el);
      await answer({ items: [], sources: complete('drive', 'wiki', 'records') });
      differences.push(
        ...feedback(
          'No resources',
          'No resources available',
          'No resources available',
          'This source has no resources to browse.',
        ),
      );
      expectNone(differences);
    });

    it(`Surface, partial failure and searching (${mode})`, async () => {
      inMode(mode);
      const { el, answer, search } = await open((el) => (el.value = [brief]));
      await search('launch');
      await answer({
        items: [brief, acme],
        sources: [...complete('drive', 'records'), { sourceId: 'wiki', status: 'failed' }],
      });
      const differences = [
        ...compare(SURFACE, { State: 'Partial failure' }, [
          {
            layer: content('Wiki unavailable · 2 of 3 sources searched'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
          {
            layer: content('Scrollable results · listbox'),
            el: shadow(el, '.collection'),
            kind: 'frame',
            gap: 'row-gap',
          },
        ]),
        ...button(named(el, 'Retry Wiki'), 'ghost', 'Retry Wiki'),
      ];
      // Retry hugs its label, as Figma's button does, rather than filling the collection.
      expect(named(el, 'Retry Wiki')!.getBoundingClientRect().width).toBeLessThan(
        shadow(el, '.collection').getBoundingClientRect().width / 2,
      );
      await search('launch p');
      expect(rows(el)[0]!.querySelector('.option-description')!.textContent).toBe(
        'Drive · Product / Launch · Updating',
      );
      differences.push(
        ...compare(SURFACE, { State: 'Searching' }, [
          {
            layer: content('Searching Drive… · previous results shown'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
        ]),
      );
      expectNone(differences);
    });

    it(`Surface, confirm and selected review (${mode})`, async () => {
      inMode(mode);
      const { el, answer } = await open((el) => {
        el.commit = 'confirm';
        el.value = [brief, acme, notes];
      });
      await answer({ items: [brief, checklist], sources: complete('drive', 'wiki', 'records') });
      const differences = [
        ...button(named(el, 'Cancel'), 'ghost', 'Cancel'),
        ...button(named(el, 'Add 3'), 'primary', 'Add 3'),
        ...compare(SURFACE, { State: 'Confirm' }, [
          {
            layer: content('Changes apply only when you choose Add 3'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
        ]),
      ];
      named(el, 'Selected (3)')!.click();
      await settle(el);
      expect(
        (shadow(el, 'select.scope') as HTMLSelectElement).selectedOptions[0]!.textContent,
      ).toBe('Selected only');
      differences.push(
        ...compare(SURFACE, { State: 'Selected review' }, [
          { layer: content('Header', 'Selected context'), el: shadow(el, '.title'), kind: 'text' },
          {
            layer: content('3 selected · across all sources'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
        ]),
      );
      expectNone(differences);
    });

    it(`Surface, browse sources and a nested collection (${mode})`, async () => {
      inMode(mode);
      const research: Resource = {
        sourceId: 'drive',
        id: 'research',
        label: 'Research',
        type: 'folder',
        description: 'Open collection',
        container: true,
      };
      const { el, answer } = await open();
      await answer({ items: [research], sources: complete('drive', 'wiki', 'records') });
      // The surface's own list of sources: Back out of a collection opened from the results
      // (Browse… opens the expanded browser).
      named(el, 'Research · Open collection')!.click();
      await settle(el);
      await answer({ items: [], sources: complete('drive') });
      named(el, 'Back · Drive')!.click();
      await settle(el);
      await answer({ items: [], sources: complete('drive') });
      named(el, 'Back · Sources')!.click();
      await settle(el);
      const differences = [
        ...compare(SURFACE, { State: 'Browse sources' }, [
          {
            layer: content('Browse source navigation · buttons'),
            el: shadow(el, '[part="browse"]'),
            kind: 'frame',
            gap: 'row-gap',
          },
          {
            layer: content('Browse · search scope stays explicit'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
        ]),
        ...button(named(el, 'Drive · 240 resources'), 'ghost', 'Drive · 240 resources'),
      ];
      // Focus rings inside the scrolling collection are inset, as its rows' are: none is clipped.
      await userEvent.keyboard('{Tab}');
      const focused = el.shadowRoot!.activeElement as HTMLElement;
      expect(focused.textContent!.trim()).toBe('Wiki · 86 pages');
      expect(focused.matches(':focus-visible')).toBe(true);
      expect(parseFloat(getComputedStyle(focused).outlineOffset)).toBeLessThan(0);
      named(el, 'Drive · 240 resources')!.click();
      await settle(el);
      await answer({
        items: [
          research,
          {
            sourceId: 'drive',
            id: 'folder',
            label: 'Launch folder',
            type: 'folder',
            description: 'Folder reference · contents not selected',
          },
        ],
        sources: complete('drive'),
      });
      differences.push(
        ...compare(SURFACE, { State: 'Browse nested' }, [
          {
            layer: content('Browse collection · independent navigation and selection'),
            el: shadow(el, '.collection'),
            kind: 'frame',
            gap: 'row-gap',
          },
        ]),
        ...button(named(el, 'Back · Sources'), 'ghost', 'Back'),
        ...button(named(el, 'Research · Open collection'), 'ghost', 'Research · Open collection'),
      );
      // Inside a source, its rows do not repeat the source's name.
      expect(rows(el)[0]!.querySelector('.option-description')!.textContent).toBe(
        'Folder reference · contents not selected',
      );
      expectNone(differences);
    });

    it(`Trigger, text form (${mode})`, async () => {
      await import('../src/context-picker/context-picker.define.js');
      inMode(mode);
      const el = mount('<odd-context-picker></odd-context-picker>') as Picker;
      await settle(el);
      const trigger = shadow(el, '[part="trigger"]');
      expect(trigger.textContent!.trim()).toBe('Add context');
      expect(trigger.querySelector('svg'), 'the text form has no icon').toBeNull();
      expectNone(button(trigger, 'secondary', 'Add context'));
    });

    it(`Trigger, icon form (${mode})`, async () => {
      await import('../src/context-picker/context-picker.define.js');
      inMode(mode);
      const el = mount('<odd-context-picker trigger="icon"></odd-context-picker>') as Picker;
      await settle(el);
      const trigger = shadow(el, '[part="trigger"]');
      const target = (frame: string): Target => ({ layer: [frame], el: trigger, kind: 'frame' });
      // Figma's icon trigger is the secondary md button in a 40 px square frame; its instance
      // keeps a text button's inline padding around an empty label (66 px wide), so the inline
      // padding is not compared: the picker draws a square of the control height instead.
      const state = (name: string, targets: Target[]) =>
        compare(
          'Oddkin/Common/button',
          { Appearance: 'secondary', Size: 'md', State: name },
          targets,
        )
          .filter((line) => !/ padding(Left|Right) \(/.test(line))
          .map((line) => `icon trigger: ${line}`);
      const differences = state('Default', [target('Button / Secondary')]);
      const box = trigger.getBoundingClientRect();
      expect([box.width, box.height]).toEqual([40, 40]);
      // Figma's Oddkin/Icon/plus, 16 px, centred.
      const glyph = trigger.querySelector('svg')!.getBoundingClientRect();
      expect([glyph.width, glyph.height]).toEqual([16, 16]);
      expect(glyph.left - box.left).toBe(box.right - glyph.right);
      await userEvent.hover(trigger);
      await transitions([target('Button / Hover')]);
      differences.push(...state('Hover', [target('Button / Hover')]));
      await userEvent.unhover(trigger);
      await userEvent.keyboard('{Tab}');
      if (!trigger.matches(':focus-visible')) trigger.focus();
      await transitions([target('Button / Focus')]);
      differences.push(
        ...state('Focus', [
          { layer: ['Button / Focus', 'Focus ring \u00b7 decorative'], el: trigger, kind: 'ring' },
        ]),
      );
      trigger.blur();
      el.disabled = true;
      await settle(el);
      await transitions([target('Button / Disabled')]);
      differences.push(...state('Disabled', [target('Button / Disabled')]));
      expectNone(differences);
    });

    // Figma's MobileSurface: the sheet, at its 390 × 844 frame.
    it(`Sheet (${mode})`, async () => {
      inMode(mode);
      await page.viewport(390, 844);
      try {
        const SHEET = 'Oddkin/AI/ContextPicker/MobileSurface';
        const { el, answer, search } = await open((el) => {
          el.presentation = 'sheet';
          el.commit = 'confirm';
          el.value = [brief, checklist];
        });
        await search('launch');
        await answer({
          items: [brief, checklist, { ...brief, id: 'interviews', label: 'Launch interviews' }],
          sources: complete('drive', 'wiki'),
        });
        const dialog = shadow(el, '[part="surface"]');
        const box = dialog.getBoundingClientRect();
        expect([box.width, box.height]).toEqual([390, 844]);
        const targets: Target[] = [
          {
            layer: ['Mobile dialog header'],
            el: shadow(el, '.header'),
            kind: 'frame',
            gap: 'column-gap',
          },
          {
            layer: ['Mobile scope'],
            el: shadow(el, '.scope-row'),
            kind: 'frame',
            gap: 'column-gap',
          },
          {
            layer: layer(SHEET, '3 matches'),
            el: shadow(el, '.status-line'),
            kind: 'text',
          },
          {
            layer: ['Mobile results · scrollable'],
            el: shadow(el, '.collection'),
            kind: 'frame',
            gap: 'row-gap',
          },
          {
            layer: ['Pinned mobile footer'],
            el: shadow(el, '.footer'),
            kind: 'frame',
            gap: 'column-gap',
          },
        ];
        await transitions(targets);
        const differences = [
          // The fill is the dialog's; the padding and gap are its content's.
          ...compare(SHEET, {}, [{ layer: [], el: dialog, kind: 'frame' }]).filter(
            (line) => !/ padding(Left|Top) \(/.test(line),
          ),
          ...compare(SHEET, {}, [
            {
              layer: [],
              el: shadow(el, '.content'),
              kind: 'frame',
              gap: 'row-gap',
              fields: [
                ['paddingRight', 'padding-inline-end'],
                ['paddingBottom', 'padding-block-end'],
              ],
            },
          ]).filter((line) => !/ fills \(/.test(line)),
          ...compare(SHEET, {}, targets),
          ...button(named(el, 'Close'), 'ghost', 'Close'),
          ...button(named(el, 'Selected (2)'), 'ghost', 'Selected (2)'),
          ...button(named(el, 'Cancel'), 'ghost', 'Cancel'),
          ...button(named(el, 'Add 2'), 'primary', 'Add 2'),
        ];
        // The title in the title type (parity.ts compares only Figma's pixel line heights).
        const title = getComputedStyle(shadow(el, '.title'));
        expect([title.fontSize, title.fontWeight]).toEqual(['20px', '600']);
        // The content 16 px in: Figma's 358 wide.
        expect(shadow(el, '.header').getBoundingClientRect().width).toBe(358);
        // The scope and Selected share their row.
        const [scope, selected] = [shadow(el, 'select.scope'), named(el, 'Selected (2)')!];
        expect(scope.getBoundingClientRect().width).toBe(selected.getBoundingClientRect().width);
        expectNone(differences);
      } finally {
        await page.viewport(1024, 800);
      }
    });

    // Figma's ExpandedBrowser, which Browse… opens: 1040 wide (Desktop) and 358 on a phone
    // (Mobile, at 390 × 844), browsing Drive with three resources chosen in a confirm draft.
    for (const [viewport, width, height] of [
      ['Desktop', 1100, 800],
      ['Mobile', 390, 844],
    ] as const)
      it(`Expanded browser, ${viewport} (${mode})`, async () => {
        inMode(mode);
        await page.viewport(width, height);
        try {
          const BROWSER = 'Oddkin/AI/ContextPicker/ExpandedBrowser';
          const desktop = viewport === 'Desktop';
          const research: Resource = {
            sourceId: 'drive',
            id: 'research',
            label: 'Research',
            type: 'folder',
            description: 'Open collection',
            container: true,
          };
          const { el, answer } = await open((el) => {
            el.commit = 'confirm';
            el.value = [brief, checklist, acme];
          });
          await answer({ items: [], sources: complete('drive', 'wiki', 'records') });
          named(el, 'Browse…')!.click();
          await settle(el);
          // Figma's location: Drive / Product / Launch.
          named(el, 'Drive')!.click();
          await settle(el);
          for (const [id, label] of [
            ['product', 'Product'],
            ['launch', 'Launch'],
          ] as const) {
            await answer({
              items: [{ sourceId: 'drive', id, label, type: 'folder', container: true }],
              sources: complete('drive'),
            });
            named(el, `${label} · folder`)!.click();
            await settle(el);
          }
          await answer({
            items: [research, brief, { ...brief, id: 'positioning', label: 'Positioning' }],
            sources: complete('drive'),
            nextCursor: 'p2',
          });
          const dialog = shadow(el, '[part="surface"]');
          const body = desktop ? 'column-gap' : 'row-gap';
          const sides: NonNullable<Target['fields']> = [
            ['paddingRight', 'padding-inline-end'],
            ['paddingBottom', 'padding-block-end'],
          ];
          const targets: Target[] = [
            {
              layer: ['Browser title'],
              el: shadow(el, '.header'),
              kind: 'frame',
              gap: 'column-gap',
            },
            { layer: ['Browser title', 'Browse context'], el: shadow(el, '.title'), kind: 'text' },
            { layer: ['Browser body'], el: shadow(el, '.body'), kind: 'frame', gap: body },
            {
              layer: ['Browser body', 'Sources and location'],
              el: shadow(el, '.nav'),
              kind: 'frame',
              gap: 'row-gap',
              fields: sides,
            },
            {
              layer: ['Browser body', 'Collection contents'],
              el: shadow(el, '.main'),
              kind: 'frame',
              gap: 'row-gap',
            },
            {
              layer: ['Browser body', 'Collection contents', '36 resources · Load more'],
              el: shadow(el, '#status'),
              kind: 'text',
            },
            {
              layer: ['Confirm draft selection'],
              el: shadow(el, '.footer'),
              kind: 'frame',
              gap: 'column-gap',
            },
            {
              layer: ['Confirm draft selection', '3 selected'],
              el: shadow(el, '.count'),
              kind: 'text',
            },
          ];
          if (desktop)
            targets.push(
              {
                layer: ['Browser body', 'Selection review'],
                el: shadow(el, '.review'),
                kind: 'frame',
                gap: 'row-gap',
                fields: sides,
              },
              {
                layer: ['Browser body', 'Selection review', 'Selected · 3'],
                el: shadow(el, '#review-title'),
                kind: 'text',
              },
              {
                layer: layer(BROWSER, 'Selections stay when you browse'),
                el: shadow(el, '.review .status-line'),
                kind: 'text',
              },
            );
          // The pointer rests on the title, off every button (an earlier case left it over one).
          await userEvent.hover(shadow(el, '.title'));
          // The current source's button eases from ghost into secondary: wait for every button.
          await transitions([
            ...targets,
            ...[...el.shadowRoot!.querySelectorAll<HTMLElement>('button')].map((b): Target => ({
              layer: [],
              el: b,
              kind: 'frame',
            })),
          ]);
          const variant = { Viewport: viewport };
          const differences = [
            // The fill, border, and radius are the dialog's; the padding and gap its content's.
            ...compare(BROWSER, variant, [{ layer: [], el: dialog, kind: 'frame' }]).filter(
              (line) => !/ padding(Left|Top) \(/.test(line),
            ),
            ...compare(BROWSER, variant, [
              {
                layer: [],
                el: shadow(el, '.content'),
                kind: 'frame',
                gap: 'row-gap',
                fields: sides,
              },
            ]).filter((line) => !/ (fills|strokes|strokeTopWeight|topLeftRadius) \(/.test(line)),
            ...compare(BROWSER, variant, targets),
            ...button(named(el, 'Close'), 'ghost', 'Close'),
            ...button(named(el, 'All sources'), 'ghost', 'All sources'),
            ...button(named(el, 'Drive'), 'secondary', 'Drive (current)'),
            ...button(named(el, 'Wiki'), 'ghost', 'Wiki'),
            ...button(named(el, 'Records'), 'ghost', 'Records'),
            ...button(named(el, 'Selected (3)'), 'ghost', 'Selected (3)'),
            ...button(named(el, 'Back · Product'), 'ghost', 'Back · Product'),
            ...button(
              named(el, 'Research · Open collection'),
              'ghost',
              'Research · Open collection',
            ),
            ...button(named(el, 'Load more'), 'ghost', 'Load more'),
            ...button(named(el, 'Cancel'), 'ghost', 'Cancel'),
            ...button(named(el, 'Add 3'), 'primary', 'Add 3'),
            ...compare(
              ROW,
              { Selection: 'Multiple', Selected: 'True', State: 'Default' },
              rowTargets(rows(el)[0]!, 'Launch brief', 'Drive · Product / Launch · Updated 2h ago'),
            ),
          ];
          expectNone(differences);
          // The title in the title type (parity.ts compares only Figma's pixel line heights).
          const title = getComputedStyle(shadow(el, '.title'));
          expect([title.fontSize, title.fontWeight]).toEqual(['20px', '600']);
          const w = (selector: string) => shadow(el, selector).getBoundingClientRect().width;
          const nav = [...el.shadowRoot!.querySelectorAll('.nav .source')].map(
            (b) => b.getBoundingClientRect().width,
          );
          // Figma draws the 1 px stroke inside the frame; the dialog's border takes that room.
          const inner =
            (desktop ? 1040 : 358) - 2 * parseFloat(getComputedStyle(dialog).borderLeftWidth) - 32;
          if (desktop) {
            // Figma's 1040, its body 1008 (here 1006): the sources 192 (buttons 176) and the review
            // 272 beside the collection, which takes the rest (Figma leaves 32 px of it unused).
            expect([w('[part="surface"]'), w('.header'), w('.body')]).toEqual([1040, inner, inner]);
            // The collection grows 999 times faster than its neighbours: they keep within 0.2 px.
            const columns = [w('.nav'), w('.review'), w('.main')];
            [192, 272, inner - 192 - 272 - 32].forEach((width, i) =>
              expect(columns[i]).toBeCloseTo(width, 0),
            );
            expect(nav.map(Math.round)).toEqual([176, 176, 176, 176]);
          } else {
            // Figma's 358: each part on its own line; two source buttons share a line.
            expect([w('[part="surface"]'), w('.nav'), w('.main'), w('.review')]).toEqual([
              358,
              inner,
              inner,
              inner,
            ]);
            expect(nav).toEqual(Array(4).fill((inner - 16 - 8) / 2));
          }
          // Back and Load more sit at the collection's start, as wide as their labels (Figma: 176).
          const main = shadow(el, '.main').getBoundingClientRect();
          for (const label of ['Back · Product', 'Load more']) {
            const box = named(el, label)!.getBoundingClientRect();
            expect(box.left, label).toBe(main.left);
            expect(box.width, label).toBeLessThan(main.width / 2);
          }
          expect(named(el, 'Research · Open collection')!.getBoundingClientRect().width).toBe(
            main.width,
          );
          const field = shadow(el, '.search-field').getBoundingClientRect();
          expect([field.width, field.height]).toEqual([inner, 48]);
          expect(shadow(el, '.footer').getBoundingClientRect().height).toBe(40);
        } finally {
          await page.viewport(1024, 800);
        }
      });
  }
});
