// Agent task panel demo: plan, parallel tools, a clarifying question, an approval bound to a
// revision, interruption, failure and retry, and checkpoints with confirmed restoration. The
// application owns all state in its own store; elements render records and send intents.
// Simulated: a local timer script plays the agent. No network, model, or credentials.
import '@oddkin/ai/define/task-plan';
import '@oddkin/ai/define/activity';
import '@oddkin/ai/define/tool-call';
import '@oddkin/ai/define/action-approval';
import '@oddkin/ai/define/question';
import '@oddkin/ai/define/checkpoint';
import '@oddkin/ai/define/conversation';
import { createAnnouncer } from '@oddkin/ai/announce';
import { createConversationView, selectSource } from '@oddkin/ai/controllers';

const $ = (selector) => document.querySelector(selector);
createAnnouncer($('#app'));

// ---- A tiny application store (any store with getSnapshot/subscribe works) ----
function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      state = { ...state, ...fn(state) };
      for (const listener of [...listeners]) listener();
    },
  };
}

const CAPS = {
  stop: { available: true },
  retry: { available: true },
  respondToApproval: { available: true },
  restoreCheckpoint: { available: true },
};
const plan = (statuses, tasks) => ({
  planId: 'deploy',
  title: 'Upgrade and deploy the billing service',
  steps: [
    { id: 'inspect', title: 'Inspect the repository', status: statuses[0] },
    { id: 'update', title: 'Update dependencies', status: statuses[1], tasks },
    {
      id: 'notes',
      title: 'Write migration notes',
      status: statuses[2],
      inputRequest: 'Which release channel should the notes target?',
    },
    {
      id: 'deploy',
      title: 'Deploy to production',
      status: statuses[3],
      blocker: statuses[3] === 'blocked' ? 'Waiting for your approval' : undefined,
    },
  ],
});
const initial = () => ({
  run: 0,
  plan: plan(['pending', 'pending', 'pending', 'pending']),
  tools: [],
  approval: undefined,
  question: undefined,
  checkpoints: [],
  attempt: undefined,
  log: [],
});
const store = createStore(initial());
const controls = { failTool: false, expireApproval: false, restoreFails: false, delay: 600 };

// ---- Rendering: elements receive records; nothing is copied ----
const toolsHost = $('#tools');
const checkpointsHost = $('#checkpoints');
const approval = $('odd-action-approval');
const question = $('odd-question');
const activity = $('odd-activity');
const planEl = $('odd-task-plan');
approval.capabilities = CAPS;
activity.capabilities = CAPS;

function sync(el, records, key, tag, assign) {
  const existing = new Map([...el.children].map((child) => [child.dataset.key, child]));
  const order = records.map((record) => {
    const id = record[key];
    let child = existing.get(id);
    if (!child) {
      child = document.createElement(tag);
      child.dataset.key = id;
    }
    assign(child, record);
    return child;
  });
  el.replaceChildren(...order);
}

function render() {
  const s = store.getSnapshot();
  planEl.plan = s.plan;
  activity.attempt = s.attempt;
  activity.tools = s.tools;
  sync(toolsHost, s.tools, 'toolCallId', 'odd-tool-call', (el, tool) => {
    el.tool = tool;
    el.capabilities = CAPS;
  });
  approval.hidden = !s.approval;
  if (s.approval) approval.approval = s.approval;
  question.hidden = !s.question;
  if (s.question) question.question = s.question;
  sync(checkpointsHost, s.checkpoints, 'checkpointId', 'odd-checkpoint', (el, checkpoint) => {
    el.checkpoint = checkpoint;
    el.capabilities = CAPS;
    el.announce = true;
  });
  $('#empty-checkpoints').hidden = s.checkpoints.length > 0;
}
store.subscribe(render);

// The run log is an odd-conversation whose source is derived from the application store.
$('#run-log').source = selectSource(store, (s) =>
  createConversationView({
    conversationId: `run-${s.run}`,
    messages: s.log,
    capabilities: {},
  }),
);

// ---- The simulated agent ----
let timers = [];
const later = (ms, fn) => timers.push(setTimeout(fn, ms * (controls.delay / 600)));
const say = (text) =>
  store.update((s) => ({
    log: [
      ...s.log,
      {
        id: `log-${s.log.length}`,
        role: 'assistant',
        parts: [{ type: 'text', id: `t-${s.log.length}`, text }],
      },
    ],
  }));
const setTool = (id, patch) =>
  store.update((s) => ({
    tools: s.tools.map((t) => (t.toolCallId === id ? { ...t, ...patch } : t)),
  }));
const setAttempt = (patch) =>
  store.update((s) => ({ attempt: s.attempt && { ...s.attempt, ...patch } }));

function runTool(id, title, ok) {
  setTool(id, { status: 'executing' });
  later(900, () => {
    if (store.getSnapshot().attempt?.status === 'cancelled') return;
    if (ok) setTool(id, { status: 'output-available', output: { updated: true, title } });
    else
      setTool(id, {
        status: 'output-error',
        error: { code: 'npm.timeout', message: 'Registry timed out (simulated).' },
        retryable: true,
      });
    afterTools();
  });
}

function afterTools() {
  const s = store.getSnapshot();
  const update = s.tools.filter((t) => t.toolCallId.startsWith('upd'));
  if (update.some((t) => t.status === 'executing' || t.status === 'output-error')) return;
  const tasks = update.map((t) => ({ id: t.toolCallId, title: t.title, status: 'done' }));
  store.update(() => ({
    plan: plan(['done', 'done', 'needs-input', 'pending'], tasks),
    checkpoints: [
      checkpoint('cp-1', 'After dependency updates', [
        'package.json and lockfile',
        'Plan progress (steps 1–2)',
      ]),
    ],
    question: {
      questionId: 'channel',
      revision: 1,
      prompt: 'Which release channel should the migration notes target?',
      kind: 'choice',
      options: [
        { id: 'stable', label: 'Stable' },
        { id: 'beta', label: 'Beta', description: 'early adopters' },
      ],
      allowCustom: true,
      status: 'requested',
    },
  }));
  setAttempt({ status: 'awaiting-input' });
  say('Dependencies are updated. I need one answer before writing the notes.');
}

const checkpoint = (checkpointId, label, restores) => ({
  checkpointId,
  label,
  description: `Restores the working tree and plan to “${label}”.`,
  restores,
  createdAt: new Date().toISOString(),
  status: 'available',
});

function start() {
  for (const id of timers) clearTimeout(id);
  timers = [];
  const run = store.getSnapshot().run + 1;
  store.update(() => ({
    ...initial(),
    run,
    attempt: {
      attemptId: `run-${run}`,
      runId: `run-${run}`,
      conversationId: 'agent',
      messageId: 'm',
      promptId: 'p',
      relation: 'new',
      status: 'streaming',
      connection: 'open',
      stop: 'none',
    },
  }));
  say(
    'Starting: inspect, update dependencies in parallel, write notes, then deploy after approval.',
  );
  store.update(() => ({ plan: plan(['active', 'pending', 'pending', 'pending']) }));
  later(700, () => {
    store.update(() => ({
      plan: plan(
        ['done', 'active', 'pending', 'pending'],
        [
          { id: 'upd-api', title: 'Update API client', status: 'active' },
          { id: 'upd-db', title: 'Update database driver', status: 'active' },
        ],
      ),
      tools: [
        {
          toolCallId: 'upd-api',
          toolName: 'npm.update',
          title: 'Update API client',
          purpose: 'Bump @billing/api-client to 4.x',
          status: 'input-available',
          input: { package: '@billing/api-client', to: '^4.0.0' },
        },
        {
          toolCallId: 'upd-db',
          toolName: 'npm.update',
          title: 'Update database driver',
          purpose: 'Bump pg to 9.x',
          status: 'input-available',
          input: { package: 'pg', to: '^9.0.0' },
        },
      ],
    }));
    runTool('upd-api', 'Update API client', true);
    runTool('upd-db', 'Update database driver', !controls.failTool);
  });
}

function requestApproval(revision) {
  store.update(() => ({
    plan: plan(['done', 'done', 'done', 'blocked'], store.getSnapshot().plan.steps[1].tasks),
    approval: {
      approvalId: 'deploy',
      toolCallId: 'deploy-tool',
      revision,
      title: 'Deploy billing service to production',
      summary: 'Rolls out the upgraded service to all regions.',
      target: 'production (3 regions)',
      risk: 'high',
      changes: [
        { label: '@billing/api-client', before: '3.9.2', after: '4.0.0' },
        {
          label: 'Regions',
          before: '0 of 3',
          after: revision > 1 ? '1 of 3 (canary first)' : '3 of 3',
        },
      ],
      status: 'requested',
      expiresAt: new Date(
        Date.now() + (controls.expireApproval ? 4000 : 10 * 60_000),
      ).toISOString(),
    },
    tools: [
      ...store.getSnapshot().tools.filter((t) => t.toolCallId !== 'deploy-tool'),
      {
        toolCallId: 'deploy-tool',
        toolName: 'deploy',
        title: 'Deploy',
        status: 'awaiting-approval',
        input: { regions: revision > 1 ? 1 : 3 },
      },
    ],
  }));
  setAttempt({ status: 'awaiting-input' });
  if (controls.expireApproval)
    later(4000 * (600 / controls.delay), () => {
      const a = store.getSnapshot().approval;
      if (a?.status === 'requested')
        store.update(() => ({ approval: { ...a, status: 'expired' } }));
    });
}

// ---- Intents from the elements ----
$('#app').addEventListener('question-answer', (event) => {
  const q = store.getSnapshot().question;
  if (!q || event.detail.revision !== q.revision) return;
  store.update(() => ({ question: { ...q, status: 'submitting' } }));
  later(500, () => {
    store.update((s) => ({
      question: { ...s.question, status: 'submitted', answer: event.detail.answer },
    }));
    say(`Thanks. Writing notes for ${JSON.stringify(event.detail.answer)}.`);
    setAttempt({ status: 'streaming' });
    later(800, () => {
      store.update((s) => ({
        checkpoints: [
          ...s.checkpoints,
          checkpoint('cp-2', 'After migration notes', [
            'docs/MIGRATION.md',
            'Plan progress (steps 1–3)',
          ]),
        ],
      }));
      requestApproval(1);
    });
  });
});
$('#app').addEventListener('question-skip', () =>
  store.update((s) => ({ question: { ...s.question, status: 'skipped' } })),
);

$('#app').addEventListener('approval-decide', (event) => {
  const a = store.getSnapshot().approval;
  // The backend checks the revision: a decision for an older proposal is stale.
  if (!a || a.revision !== event.detail.revision || a.status !== 'requested') return;
  store.update(() => ({
    approval: { ...a, status: 'decision-pending', decision: event.detail.decision },
  }));
  later(700, () => {
    const current = store.getSnapshot().approval;
    if (current.revision !== event.detail.revision) return;
    const approved = event.detail.decision === 'approve';
    store.update(() => ({ approval: { ...current, status: approved ? 'approved' : 'rejected' } }));
    if (!approved) {
      setTool('deploy-tool', { status: 'denied' });
      store.update((s) => ({
        plan: plan(['done', 'done', 'done', 'skipped'], s.plan.steps[1].tasks),
      }));
      setAttempt({ status: 'completed' });
      return say('Deployment skipped at your request.');
    }
    // Approval is not success: the deploy runs (and may fail) separately.
    setAttempt({ status: 'streaming' });
    setTool('deploy-tool', { status: 'executing' });
    store.update((s) => ({
      plan: plan(['done', 'done', 'done', 'active'], s.plan.steps[1].tasks),
    }));
    later(1500, () => {
      if (store.getSnapshot().attempt?.status === 'cancelled') return;
      setTool('deploy-tool', {
        status: 'output-available',
        output: { regions: current.revision > 1 ? 1 : 3 },
      });
      store.update((s) => ({
        plan: plan(['done', 'done', 'done', 'done'], s.plan.steps[1].tasks),
      }));
      setAttempt({ status: 'completed' });
      say('Deployed.');
    });
  });
});

$('#app').addEventListener('tool-retry', (event) => {
  setTool(event.detail.toolCallId, { error: undefined, retryable: undefined });
  runTool(event.detail.toolCallId, 'retry', true);
});

$('#app').addEventListener('prompt-stop', () => {
  setAttempt({ stop: 'requested' });
  later(800, () => {
    for (const id of timers) clearTimeout(id);
    timers = [];
    const s = store.getSnapshot();
    store.update(() => ({
      attempt: { ...s.attempt, status: 'cancelled', stop: 'confirmed' },
      tools: s.tools.map((t) =>
        t.status === 'executing' || t.status === 'input-streaming'
          ? { ...t, status: 'cancelled' }
          : t,
      ),
    }));
    say('Stopped. Completed work is kept; restore a checkpoint or start again.');
  });
});

$('#app').addEventListener('checkpoint-restore', (event) => {
  const id = event.detail.checkpointId;
  const patch = (status, extra = {}) =>
    store.update((s) => ({
      checkpoints: s.checkpoints.map((c) =>
        c.checkpointId === id ? { ...c, status, ...extra } : c,
      ),
    }));
  patch('restore-pending');
  setTimeout(() => {
    if (controls.restoreFails)
      patch('restore-failed', {
        error: {
          code: 'git.conflict',
          message: 'Uncommitted changes conflict with the checkpoint (simulated).',
        },
      });
    else
      patch('restored', {
        outcome: 'The working tree and plan match the checkpoint (simulated confirmation).',
      });
  }, 1200);
});

// ---- Simulation controls ----
$('#start').addEventListener('click', start);
$('#fail-tool').addEventListener('change', (e) => (controls.failTool = e.target.checked));
$('#expire').addEventListener('change', (e) => (controls.expireApproval = e.target.checked));
$('#restore-fails').addEventListener('change', (e) => (controls.restoreFails = e.target.checked));
$('#delay').addEventListener(
  'change',
  (e) => (controls.delay = Math.max(50, Number(e.target.value))),
);
$('#revise').addEventListener('click', () => {
  const a = store.getSnapshot().approval;
  if (a && (a.status === 'requested' || a.status === 'decision-pending'))
    requestApproval(a.revision + 1);
});

render();
document.body.dataset.ready = 'true';
