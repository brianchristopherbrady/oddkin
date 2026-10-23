// @oddkin/ai performance fixture (outside shipped code). Bundled by research/benchmarks/ai/run.mjs.
// Workloads: mount a long history (default 1,000 messages of mixed Markdown, code, citations and
// tool calls), stream a long Markdown answer into it, and tear it down.
import '@oddkin/ai/define/conversation';
import { ConversationController } from '@oddkin/ai/controllers';
import type { AiEvent, ConversationTransport, EventSink } from '@oddkin/ai/contracts';

type Conversation = HTMLElementTagNameMap['odd-conversation'];

const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const settle = async () => {
  await frame();
  await frame();
  await new Promise((resolve) => setTimeout(resolve));
};

/** Elements and text nodes, including every open shadow tree. */
function countNodes(root: Node): number {
  let count = 0;
  const walk = (node: Node) => {
    count++;
    const shadow = (node as Element).shadowRoot;
    if (shadow) walk(shadow);
    for (let child = node.firstChild; child; child = child.nextSibling) walk(child);
  };
  walk(root);
  return count;
}

/** Text content including every open shadow tree. */
function deepText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  let text = '';
  const shadow = (node as Element).shadowRoot;
  if (shadow) text += deepText(shadow);
  for (let child = node.firstChild; child; child = child.nextSibling) text += deepText(child);
  return text;
}

const PARAGRAPH =
  'Ocean heat content keeps rising, and **marine heatwaves** are more frequent. See `trend()` for the method and [the dataset](https://example.org/data).';

function assistantText(i: number): string {
  const blocks = [`### Answer ${i}`, PARAGRAPH];
  if (i % 3 === 0)
    blocks.push('- first finding\n- second finding\n  - nested detail\n- third finding');
  if (i % 5 === 0)
    blocks.push(
      '```ts\nexport function trend(a: number, b: number) {\n  return (b - a) / a;\n}\n```',
    );
  if (i % 7 === 0) blocks.push(`Supported by two sources [^a${i}] [^b${i}].`);
  return blocks.join('\n\n');
}

function history(n: number) {
  const messages: unknown[] = [];
  const tools: unknown[] = [];
  let parentId: string | undefined;
  for (let i = 0; i < n; i++) {
    const id = `m${i}`;
    const user = i % 2 === 0;
    const parts: unknown[] = [
      {
        type: 'text',
        id: `${id}-t`,
        text: user ? `Question ${i}: what changed this decade?` : assistantText(i),
      },
    ];
    if (!user && i % 7 === 0) {
      parts.push({
        type: 'source',
        id: `${id}-sa`,
        sourceId: `a${i}`,
        title: `Source A${i}`,
        url: 'https://example.org/a',
      });
      parts.push({
        type: 'source',
        id: `${id}-sb`,
        sourceId: `b${i}`,
        title: `Source B${i}`,
        url: 'https://example.org/b',
      });
    }
    if (!user && i % 10 === 1) {
      parts.unshift({ type: 'tool-call', id: `${id}-tc`, toolCallId: `tool-${i}` });
      tools.push({
        toolCallId: `tool-${i}`,
        toolName: 'search',
        title: 'Search',
        status: 'output-available',
        input: { q: 'ocean' },
        output: { results: 3 },
      });
    }
    messages.push({
      id,
      role: user ? 'user' : 'assistant',
      ...(parentId ? { parentId } : {}),
      parts,
    });
    parentId = id;
  }
  return { conversationId: 'bench', messages, tools };
}

/** A long Markdown answer split into token-sized chunks (deterministic). */
function answerChunks(targetChars: number): string[] {
  const sections: string[] = [];
  for (let i = 0; sections.join('\n\n').length < targetChars; i++) {
    sections.push(`## Section ${i}`, PARAGRAPH, '- point one\n- point two\n- point three');
    if (i % 2 === 0)
      sections.push('```py\nfor year in range(1990, 2025):\n    print(year, heat[year])\n```');
    if (i % 3 === 0) sections.push('| Year | Value |\n|--|--:|\n| 2000 | 1.2 |\n| 2020 | 2.4 |');
  }
  const text = sections.join('\n\n');
  const chunks: string[] = [];
  for (let at = 0, k = 0; at < text.length; k++) {
    const size = 3 + ((k * 7) % 11);
    chunks.push(text.slice(at, at + size));
    at += size;
  }
  return chunks;
}

const sectionCount = (chunks: readonly string[]) => chunks.join('').split('## Section ').length - 1;

let host: Conversation | undefined;
let controller: ConversationController | undefined;
let sink: EventSink | undefined;
let seq = 0;

const transport: ConversationTransport = {
  capabilities: { send: { available: true }, stop: { available: true } },
  async send(_request, s) {
    sink = s;
  },
};

const push = (event: AiEvent) => sink?.push({ ...event, seq: seq++ } as AiEvent);
const scroller = () => host!.shadowRoot!.querySelector<HTMLElement>('[part="scroller"]')!;

const bench = {
  async mountHistory(n: number) {
    bench.teardown();
    controller = new ConversationController({ transport, conversationId: 'bench' });
    const loadStart = performance.now();
    controller.load(history(n));
    const loadMs = performance.now() - loadStart;
    host = document.createElement('odd-conversation');
    host.label = 'Benchmark conversation';
    host.style.blockSize = '600px';
    host.store = controller;
    const start = performance.now();
    document.getElementById('host')!.append(host);
    await host.updateComplete;
    const committed = performance.now() - start;
    await settle();
    return {
      messages: host.shadowRoot!.querySelectorAll('odd-message').length,
      snapshotLoadMs: loadMs,
      mountToCommitMs: committed,
      mountToSettledMs: performance.now() - start,
      domNodes: countNodes(host),
    };
  },

  async stream(targetChars: number, chunksPerFrame: number) {
    if (!controller || !host) throw new Error('mount first');
    seq = 0;
    const chunks = answerChunks(targetChars);
    await controller.send({ text: 'Write the long report.' });
    push({ type: 'attempt-accepted' });
    push({ type: 'message-start' });
    push({ type: 'text-start', partId: 'answer' });
    await settle();
    const frames: number[] = [];
    let running = true;
    let last = await frame();
    const tick = (t: number) => {
      frames.push(t - last);
      last = t;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const pushCost: number[] = [];
    const start = performance.now();
    for (let i = 0; i < chunks.length; i++) {
      const t0 = performance.now();
      push({ type: 'text-delta', partId: 'answer', delta: chunks[i]! });
      pushCost.push(performance.now() - t0);
      if ((i + 1) % chunksPerFrame === 0) await frame();
    }
    push({ type: 'text-end', partId: 'answer' });
    push({ type: 'finish' });
    await settle();
    running = false;
    const total = performance.now() - start;
    const el = scroller();
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
    const q = (xs: number[], p: number) =>
      sorted(xs)[Math.min(xs.length - 1, Math.ceil(p * xs.length) - 1)]!;
    const messages = host.shadowRoot!.querySelectorAll('odd-message');
    const text = deepText(messages[messages.length - 1]!);
    return {
      chunks: chunks.length,
      characters: chunks.join('').length,
      chunksPerFrame,
      totalMs: total,
      pushMsMedian: q(pushCost, 0.5),
      pushMsP95: q(pushCost, 0.95),
      pushMsMax: Math.max(...pushCost),
      frameMsMedian: q(frames, 0.5),
      frameMsP95: q(frames, 0.95),
      frameMsMax: Math.max(...frames),
      framesOver50ms: frames.filter((f) => f > 50).length,
      frames: frames.length,
      followedToBottom: el.scrollHeight - el.scrollTop - el.clientHeight <= 2,
      renderedFinalHeading: text.includes(`Section ${sectionCount(chunks) - 1}`),
      domNodes: countNodes(host),
    };
  },

  teardown() {
    host?.remove();
    controller?.dispose();
    host = undefined;
    controller = undefined;
    sink = undefined;
    return countNodes(document.getElementById('host')!);
  },
};

(globalThis as unknown as { bench: typeof bench }).bench = bench;
