import type { ComponentPageData, WorkbenchIndex } from '@oddkin/workbench/data';
import { repository } from './pages/model.js';
import { AI_GROUP, exampleElement } from './reference.js';

/**
 * The AI interfaces page (Figma "03 · Reference", AI interfaces): `@oddkin/ai` with a live
 * conversation built from the documented examples, its elements (each linking to its reference
 * page), the three demos, and how to install and register it. The words come from the package
 * manifest, its README, the demos' READMEs, and docs/architecture/ai-interaction.md.
 */

export interface AiData {
  readonly index: WorkbenchIndex;
  /** The conversation and composer reference data, whose default examples make the live example. */
  readonly conversation: ComponentPageData | undefined;
  readonly composer: ComponentPageData | undefined;
}

/** `@oddkin/ai`'s package description (packages/ai/package.json). */
export const AI_DESCRIPTION =
  'Optional AI interaction elements, headless controllers, and stream adapters for conversation, inline assistance, research, and agent workflows.';

/** The demos in examples/ (packages/ai/README.md), described from their own READMEs. */
export const AI_DEMOS: readonly {
  dir: string;
  title: string;
  text: string;
  elements: readonly string[];
}[] = [
  {
    dir: 'ai-research',
    title: 'Research assistant',
    text: 'Composer with attachments and suggestions, context picker, model selection, streaming Markdown with citations, a streamed tool call, sources, a revisioned artifact, and usage.',
    elements: ['odd-conversation', 'odd-context-picker', 'odd-artifact'],
  },
  {
    dir: 'ai-writing',
    title: 'Inline writing assistant',
    text: 'Selections captured against a document revision, inline-assist actions as proposals, change review with accept, reject, and undo, provenance, and dictation.',
    elements: ['odd-inline-assist', 'odd-change-review', 'odd-ai-label'],
  },
  {
    dir: 'ai-agent',
    title: 'Agent task panel',
    text: 'Application-owned state: a store holds the plan, tools, approval, question, checkpoints, and run log; elements render those records and emit intent events that the page handles.',
    elements: ['odd-task-plan', 'odd-action-approval', 'odd-checkpoint'],
  },
];

const tree = repository.replace('/blob/', '/tree/');

function node<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(name);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function link(label: string, href: string, className?: string): HTMLAnchorElement {
  const result = node('a', className, label);
  result.href = href;
  return result;
}

/** A code sample with its language and a copy button, as the authored pages draw one. */
function codeBlock(code: string, lang: 'js' | 'html' | 'sh', id: string): HTMLElement {
  const figure = node('figure', 'code-block');
  const toolbar = node('div', 'code-toolbar odd-row odd-row-between');
  const copy = document.createElement('odd-copy-button');
  copy.setAttribute('from', id);
  toolbar.append(
    node('span', 'code-label', { js: 'JavaScript', html: 'HTML', sh: 'Terminal' }[lang]),
    copy,
  );
  const pre = node('pre', 'code');
  pre.id = id;
  pre.dataset['lang'] = lang;
  pre.tabIndex = 0;
  pre.append(node('code', undefined, code));
  figure.append(toolbar, pre);
  return figure;
}

/** The conversation example with the composer example in its composer slot; a picture, so inert. */
async function liveExample(host: HTMLElement, data: AiData): Promise<void> {
  if (!data.conversation || !data.composer) return;
  const [conversation, composer] = await Promise.all([
    exampleElement(data.conversation, { slots: false }),
    exampleElement(data.composer),
  ]);
  if (!conversation || !composer) return;
  composer.slot = 'composer';
  conversation.append(composer);
  host.replaceChildren(conversation);
}

function elementsSection(index: WorkbenchIndex, href: (path: string) => string): HTMLElement {
  const elements = index.registry.pages.filter(
    (page) => page.kind === 'component' && page.group === AI_GROUP,
  );
  const result = node('section', 'content-section ai-elements');
  result.setAttribute('aria-labelledby', 'ai-elements-title');
  const title = node('h2', undefined, `${elements.length} interaction elements`);
  title.id = 'ai-elements-title';
  // Dot-separated links, as the design lists them; each opens the element's reference page.
  const list = node('p', 'ai-element-links');
  elements.forEach((page, i) => {
    if (i) list.append(' \u00b7 ');
    list.append(link(page.title, href(page.route)));
  });
  result.append(
    title,
    node('p', undefined, 'No model calls, no storage, no third-party runtime dependencies.'),
    list,
  );
  return result;
}

function demosSection(): HTMLElement {
  const result = node('section', 'content-section');
  result.setAttribute('aria-labelledby', 'ai-demos-title');
  const title = node('h2', undefined, 'Start from a pattern');
  title.id = 'ai-demos-title';
  const list = node('ul', 'card-list odd-auto-grid odd-auto-grid-fit');
  list.setAttribute('role', 'list');
  for (const demo of AI_DEMOS) {
    const card = document.createElement('odd-card');
    card.className = 'resource-card';
    const heading = node('h3', undefined, demo.title);
    heading.slot = 'header';
    const action = link(
      `View the ${demo.title.toLowerCase()} source`,
      `${tree}examples/${demo.dir}`,
      'odd-button',
    );
    action.slot = 'footer';
    action.dataset['fullWidth'] = '';
    card.append(
      heading,
      node('p', undefined, demo.text),
      node('p', 'card-meta', demo.elements.join(' \u00b7 ')),
      action,
    );
    const item = node('li');
    item.append(card);
    list.append(item);
  }
  result.append(
    title,
    node('p', undefined, 'Each demo is simulated: no network requests, model, or credentials.'),
    list,
  );
  return result;
}

function installSection(): HTMLElement {
  const result = node('section', 'content-section');
  result.setAttribute('aria-labelledby', 'ai-install-title');
  const title = node('h2', undefined, 'Install and register');
  title.id = 'ai-install-title';
  const lead = node('p');
  lead.append(
    'Depends on ',
    node('code', undefined, '@oddkin/core'),
    ', ',
    node('code', undefined, '@oddkin/tokens'),
    ', and ',
    node('code', undefined, '@oddkin/components'),
    '. Load a theme stylesheet (e.g. ',
    node('code', undefined, '@oddkin/tokens/css/default.css'),
    '). Register only what you use:',
  );
  const owner = node('p', 'note');
  owner.append(
    node('strong', undefined, 'Application-owned behavior. '),
    'It never calls a model, stores conversations, or enforces authorization: the application (the host) owns data, transport, persistence, policy, and telemetry. ',
    link(
      'Read the AI interaction architecture',
      `${repository}docs/architecture/ai-interaction.md`,
    ),
    '.',
  );
  result.append(
    title,
    codeBlock('npm install @oddkin/ai@beta', 'sh', 'ai-code-install'),
    lead,
    codeBlock(
      "import '@oddkin/ai/define/conversation'; // also registers odd-message, odd-response, odd-tool-call, \u2026\nimport '@oddkin/ai/define/prompt-input';",
      'js',
      'ai-code-register',
    ),
    codeBlock(
      '<odd-conversation label="Assistant">\n  <odd-prompt-input slot="composer" label="Ask a question"></odd-prompt-input>\n</odd-conversation>',
      'html',
      'ai-code-markup',
    ),
    owner,
  );
  return result;
}

/** Renders the page into `main`; `href` maps a site path to a link. */
export function renderAi(
  main: HTMLElement,
  data: AiData,
  header: HTMLElement,
  href: (path: string) => string,
): void {
  const example = node('div', 'ai-example specimen odd-stack');
  const stage = node('div', 'ai-example-stage');
  stage.inert = true;
  const caption = node(
    'p',
    'card-meta',
    'odd-conversation with odd-prompt-input in its composer slot, from their documented examples. The host supplies the records; nothing here calls a model.',
  );
  example.append(stage, caption);
  // The example takes the main column; the element list sits beside it, or below on narrow screens.
  // The split's override properties are set here, since the site layout's own values inherit.
  const intro = node('div', 'ai-intro odd-split odd-split-end');
  intro.style.setProperty('--odd-split-side-width', '20rem');
  intro.style.setProperty('--odd-split-main-min', '26rem');
  intro.style.setProperty('--odd-split-gap', 'var(--odd-space-2xl)');
  intro.append(example, elementsSection(data.index, href));
  main.append(header, intro, demosSection(), installSection());
  liveExample(stage, data).catch(reportError);
}
