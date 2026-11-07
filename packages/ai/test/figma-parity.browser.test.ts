import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import {
  compare,
  deliberate,
  expectNone,
  figma,
  mount,
  settle,
  transitions,
  useParity,
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
      const [copy, regenerate] = el.shadowRoot!.querySelectorAll<HTMLElement>(
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
        { layer: ['Actions', 'Copy'], el: copy!, kind: 'frame' },
        { layer: ['Actions', 'Copy', 'Copy'], el: copy!, kind: 'text' },
        { layer: ['Actions', 'Regenerate'], el: regenerate!, kind: 'frame' },
        { layer: ['Actions', 'Regenerate', 'Regenerate'], el: regenerate!, kind: 'text' },
      ];
      await transitions(targets);
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

describe('Figma parity: odd-suggestions', () => {
  for (const mode of MODES)
    it(`Insert and send (${mode})`, async () => {
      await import('../src/suggestions/suggestions.define.js');
      inMode(mode);
      const el = mount(
        '<odd-suggestions></odd-suggestions>',
      ) as HTMLElementTagNameMap['odd-suggestions'];
      el.suggestions = [
        { id: 'summarize', label: 'Summarize', prompt: 'Summarize this document.' },
        { id: 'explain', label: 'Explain the key points', prompt: 'Explain the key points.' },
      ];
      await settle(el);
      const items = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.item')];
      const targets: Target[] = [
        { layer: ['Actions'], el: shadow(el, '[part="list"]'), kind: 'frame', gap: 'column-gap' },
      ];
      for (const [i, pill, label] of [
        [0, 'Actions', 'Summarize'],
        [1, 'Actions [2]', 'Explain the key points'],
      ] as const) {
        const insert = items[i]!.querySelector<HTMLElement>('[part="suggestion"]')!;
        const send = items[i]!.querySelector<HTMLElement>('[part="send"]')!;
        targets.push(
          { layer: ['Actions', pill], el: items[i]!, kind: 'frame', gap: 'column-gap' },
          { layer: ['Actions', pill, label], el: insert, kind: 'frame' },
          { layer: ['Actions', pill, label, label], el: insert, kind: 'text' },
          { layer: ['Actions', pill, '↑'], el: send, kind: 'frame' },
          { layer: ['Actions', pill, '↑', '↑'], el: send, kind: 'text' },
        );
      }
      await transitions(targets);
      expectNone(compare(`odd-suggestions/Insert and send/${mode}`, {}, targets));
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
    it(`Resolved, expanded (${mode})`, async () => {
      await import('../src/citation/citation.define.js');
      inMode(mode);
      const el = mount('<odd-citation></odd-citation>') as HTMLElementTagNameMap['odd-citation'];
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

describe('Figma parity: odd-context-picker', () => {
  // Compact density too: a raw length that equals its token at the default density differs there.
  const cases: [string, string][] = [
    ...MODES.map((m): [string, string] => [m, '']),
    ['light', 'compact'],
  ];
  for (const [mode, density] of cases)
    it(`Ready context (${mode}${density ? `, ${density} density` : ''})`, async () => {
      await import('../src/context-picker/context-picker.define.js');
      inMode(mode);
      if (density) document.documentElement.dataset['oddDensity'] = density;
      const el = mount(
        '<odd-context-picker></odd-context-picker>',
      ) as HTMLElementTagNameMap['odd-context-picker'];
      el.items = [{ id: 'c1', kind: 'file', label: 'Example document.txt', status: 'ready' }];
      await settle(el);
      const item = 'Context item · file details / status / actions';
      const details = [item, 'File details'];
      const tools = [item, 'Item actions'];
      const [inspect, remove] = el.shadowRoot!.querySelectorAll<HTMLElement>('.tools > button');
      const add = shadow(el, '[part="add"] > .odd-button');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: [item], el: shadow(el, '[part="item"]'), kind: 'frame' },
        { layer: details, el: shadow(el, '.details'), kind: 'frame', gap: 'row-gap' },
        {
          layer: [...details, 'Example document.txt'],
          el: shadow(el, '.details .label'),
          kind: 'text',
        },
        { layer: [...details, 'File'], el: shadow(el, '.details .muted'), kind: 'text' },
        { layer: [item, 'Status'], el: shadow(el, '.status'), kind: 'frame', gap: 'column-gap' },
        { layer: [item, 'Status', 'Ready'], el: shadow(el, '.status'), kind: 'text' },
        { layer: tools, el: shadow(el, '.tools'), kind: 'frame', gap: 'column-gap' },
        { layer: [...tools, 'Inspect'], el: inspect!, kind: 'frame' },
        { layer: [...tools, 'Inspect', '▾'], el: inspect!, kind: 'text' },
        { layer: [...tools, '✕'], el: remove!, kind: 'frame' },
        { layer: [...tools, '✕', '✕'], el: remove!, kind: 'text' },
        {
          layer: ['Add context'],
          el: shadow(el, '[part="add"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
        { layer: ['Add context', 'Add files'], el: add, kind: 'frame' },
        { layer: ['Add context', 'Add files', 'Add files'], el: add, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(`odd-context-picker/Ready context/${mode}`, {}, targets));
      // The item's details, status, and actions are space.sm apart, as Figma spaces them.
      const probe = document.createElement('div');
      probe.style.columnGap = 'var(--odd-space-sm)';
      el.after(probe);
      expect(getComputedStyle(shadow(el, '.row')).columnGap).toBe(
        getComputedStyle(probe).columnGap,
      );
      // The texts follow the type roles Figma binds: a theme that sets a role reaches them.
      const roles = {
        'body-family': 'serif',
        'body-size': '20px',
        'body-line-height': '2',
        'small-size': '10px',
        'small-line-height': '3',
      };
      for (const [role, value] of Object.entries(roles))
        el.style.setProperty(`--odd-type-${role}`, value);
      const font = (selector: string) => {
        const style = getComputedStyle(shadow(el, selector));
        return [style.fontFamily, style.fontSize, style.lineHeight];
      };
      expect(font('.details .label')).toEqual(['serif', '20px', '40px']);
      expect(font('.details .muted')).toEqual(['serif', '10px', '30px']);
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
      const copy = shadow(assistant!, '[part="footer"] > .odd-button');
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
      const [copy, download] = el.shadowRoot!.querySelectorAll<HTMLElement>(
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
        { layer: ['Actions', 'Copy'], el: copy!, kind: 'frame' },
        { layer: ['Actions', 'Copy', 'Copy'], el: copy!, kind: 'text' },
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

describe('Figma parity: odd-tool-call', () => {
  for (const mode of MODES)
    it(`Arguments ready, not executed (${mode})`, async () => {
      await import('../src/tool-call/tool-call.define.js');
      inMode(mode);
      const el = mount('<odd-tool-call></odd-tool-call>') as HTMLElementTagNameMap['odd-tool-call'];
      el.tool = {
        toolCallId: 't1',
        toolName: 'example_tool',
        status: 'input-available',
        input: { document: 'example.txt' },
      };
      await settle(el);
      (shadow(el, 'details') as HTMLDetailsElement).open = true;
      await settle(el);
      const family = `odd-tool-call/Arguments ready · not executed/${mode}`;
      const code = shadow(el, '[part="arguments"] .code');
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame' },
        { layer: ['▾ example_tool'], el: shadow(el, '.name'), kind: 'text' },
        { layer: ['Status'], el: shadow(el, '.status'), kind: 'frame', gap: 'column-gap' },
        {
          layer: ['Status', 'Arguments ready; not run yet'],
          el: shadow(el, '.status'),
          kind: 'text',
        },
        { layer: ['Arguments'], el: shadow(el, '[part="arguments"] .label'), kind: 'text' },
        { layer: ['Arguments [2]'], el: code, kind: 'frame' },
        { layer: layer(family, '{ "document"'), el: code, kind: 'text' },
      ];
      await transitions(targets);
      expectNone(compare(family, {}, targets));
      // Figma's column: the name, then the status on its own line, then the arguments, xs apart.
      const top = (selector: string) => shadow(el, selector).getBoundingClientRect().top;
      expect(top('.status')).toBeGreaterThan(shadow(el, '.name').getBoundingClientRect().bottom);
      expect(top('[part="arguments"] .label')).toBeGreaterThan(
        shadow(el, '.status').getBoundingClientRect().bottom,
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
          status: 'proposed',
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
      const field = shadow(el, 'textarea');
      restyle(field);
      const targets: Target[] = [
        { layer: [], el: shadow(el, '[part="base"]'), kind: 'frame', gap: 'row-gap' },
        { layer: ['Update example document'], el: shadow(el, '.title'), kind: 'text' },
        { layer: ['Review the proposed change.'], el: shadow(el, '.summary'), kind: 'text' },
        { layer: ['Affects: example.txt'], el: shadow(el, '.target'), kind: 'text' },
        { layer: ['Risk: low'], el: shadow(el, '.target + .muted'), kind: 'text' },
        {
          layer: ['Proposed changes'],
          el: shadow(el, '[part="changes"]'),
          kind: 'frame',
          gap: 'row-gap',
        },
        {
          layer: ['Proposed changes', 'Before: Original text'],
          el: shadow(el, 'del'),
          kind: 'text',
        },
        { layer: ['Proposed changes', 'After: Revised text'], el: shadow(el, 'ins'), kind: 'text' },
        { layer: ['Waiting for your decision'], el: shadow(el, '.state'), kind: 'text' },
        { layer: ['Reason (optional)'], el: shadow(el, '.reason .muted'), kind: 'text' },
        {
          layer: ['Native field'],
          el: field,
          kind: 'frame',
          fields: [['minHeight', 'min-block-size']],
        },
        { layer: ['Native field', 'Text'], el: field, kind: 'text' },
        {
          layer: ['Actions'],
          el: shadow(el, '[part="actions"]'),
          kind: 'frame',
          gap: 'column-gap',
        },
      ];
      await transitions(targets);
      expectNone(compare(`odd-action-approval/Requested/${mode}`, {}, targets));
      // As the specimen: each change reads "Before: …" and "After: …", in sight, one under the
      // other and space.xs apart.
      const del = shadow(el, 'del');
      const ins = shadow(el, 'ins');
      expect(del.textContent!.replace(/\s+/g, ' ').trim()).toBe('Before: Original text');
      expect(el.shadowRoot!.querySelector('.changes .visually-hidden')).toBeNull();
      const gap = ins.getBoundingClientRect().top - del.getBoundingClientRect().bottom;
      expect(Math.round(gap)).toBe(space(el, 'xs'));
    });
});
