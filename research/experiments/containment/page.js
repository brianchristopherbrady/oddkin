// M8 CSS review (F08): measures `contain: content` and `content-visibility: auto` against no
// containment on a card collection and a streaming conversation. Each variant is one rule on the
// item hosts: on `odd-card` from page CSS, and on `odd-message` from a sheet adopted into the
// conversation's shadow root (an experiment-only hook; no component ships either rule).
import '@oddkin/components/define/badge';
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/ai/define/conversation';

const RULES = {
  none: () => '',
  contain: () => 'contain: content;',
  visibility: (size) => `content-visibility: auto; contain-intrinsic-size: auto ${size};`,
};
const LOREM =
  'Containment limits style, layout, and paint work to a subtree, and content-visibility skips it while off screen. ';
const CAPS = {
  send: { available: true },
  stop: { available: true },
  history: { available: true },
  regenerate: { available: true },
  feedback: { available: true },
};

const wrap = document.getElementById('wrap');
const root = document.documentElement;
const frames = (n = 2) =>
  new Promise((resolve) => {
    const step = (left) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
/** Style and layout forced synchronously, in milliseconds. */
const forced = () => {
  const start = performance.now();
  void root.offsetHeight;
  return performance.now() - start;
};
/** Applies a change n times, each followed by a forced style and layout; the median time. */
async function repeat(n, change) {
  const times = [];
  for (let i = 0; i < n; i++) {
    change(i);
    times.push(forced());
    await frames(1);
  }
  return median(times);
}
const theme = (n) => repeat(n, (i) => (root.dataset.oddMode = i % 2 ? 'light' : 'dark'));

const card = (i) =>
  `<odd-card appearance="elevated" label="Card ${i}"><h2 slot="header">Card ${i}</h2>` +
  `<p>Card ${i} summary. ${LOREM}</p><div slot="footer" class="odd-cluster">` +
  `<odd-badge tone="info">Tag ${i % 7}</odd-badge><odd-button>Open ${i}</odd-button></div></odd-card>`;

async function cards({ variant, count = 400, toggles = 10 }) {
  const style = document.createElement('style');
  style.textContent = `odd-card { ${RULES[variant]('260px')} }`;
  document.head.append(style);
  wrap.style.inlineSize = '1200px';
  const grid = document.createElement('div');
  grid.className = 'odd-auto-grid';
  const start = performance.now();
  grid.innerHTML = Array.from({ length: count }, (_, i) => card(i)).join('');
  wrap.append(grid);
  await Promise.all(
    [...grid.querySelectorAll('odd-card, odd-badge, odd-button')].map((el) => el.updateComplete),
  );
  const render = performance.now() - start;
  const firstLayout = forced();
  await frames(2);
  const themeChange = await theme(toggles);
  await frames(2);
  const resize = await repeat(toggles, (i) => (wrap.style.inlineSize = i % 2 ? '1200px' : '760px'));
  await frames(2);
  return { render, firstLayout, theme: themeChange, resize, scrollHeight: root.scrollHeight };
}

const message = (i, text = `Message ${i}. ${LOREM.repeat(2)}`) => ({
  id: `m${i}`,
  role: i % 2 ? 'assistant' : 'user',
  ...(i ? { parentId: `m${i - 1}` } : {}),
  parts: [{ type: 'text', id: `t${i}`, text }],
});
const snapshot = (messages, revision) => ({
  conversationId: 'c',
  revision,
  messages,
  tools: {},
  approvals: {},
  artifacts: {},
  attempts: {},
  branches: {},
  capabilities: CAPS,
  history: 'complete',
  hasMoreHistory: false,
  feedback: {},
});

async function transcript({ variant, count = 200, chunks = 60, toggles = 10 }) {
  const el = document.createElement('odd-conversation');
  el.label = 'Transcript';
  el.announce = 'none';
  el.style.display = 'block';
  el.style.blockSize = '600px';
  el.style.inlineSize = '720px';
  let messages = Array.from({ length: count }, (_, i) => message(i));
  let revision = 1;
  el.state = snapshot(messages, revision);
  const start = performance.now();
  wrap.append(el);
  await el.updateComplete;
  await Promise.all(
    [...el.shadowRoot.querySelectorAll('odd-message')].map((m) => m.updateComplete),
  );
  const render = performance.now() - start;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`odd-message { ${RULES[variant]('160px')} }`);
  el.shadowRoot.adoptedStyleSheets = [...el.shadowRoot.adoptedStyleSheets, sheet];
  const firstLayout = forced();
  await frames(2);

  // Streaming: the last (assistant) message grows by a few words per snapshot.
  const last = count - 1;
  const totals = [];
  const layouts = [];
  for (let c = 0; c < chunks; c++) {
    const part = messages[last].parts[0];
    messages = [...messages.slice(0, last), message(last, `${part.text} Chunk ${c} adds words.`)];
    const t0 = performance.now();
    el.state = snapshot(messages, ++revision);
    await el.updateComplete;
    await el.shadowRoot.querySelector('[part="feed"] > odd-message:last-child')?.updateComplete;
    const t1 = performance.now();
    void root.offsetHeight;
    const t2 = performance.now();
    totals.push(t2 - t0);
    layouts.push(t2 - t1);
    await frames(1);
  }
  await frames(2);
  const themeChange = await theme(toggles);
  await frames(2);
  const resize = await repeat(toggles, (i) => (el.style.inlineSize = i % 2 ? '720px' : '480px'));
  await frames(2);
  const scroller = el.shadowRoot.querySelector('[part="scroller"]');
  return {
    render,
    firstLayout,
    stream: median(totals),
    streamLayout: median(layouts),
    theme: themeChange,
    resize,
    sheetKept: el.shadowRoot.adoptedStyleSheets.includes(sheet),
    atEnd: Math.abs(scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop) < 2,
    scrollHeight: scroller.scrollHeight,
  };
}

window.bench = { cards, transcript };
