import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createApp, h, nextTick, ref } from 'vue';
import { flush } from '@oddkin/core/reactive';
import type { ApprovalRecord } from '../src/contracts/types.js';
import type { ApprovalDecideDetail } from '../src/events.js';

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
});

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });

const record = (
  revision: number,
  status: ApprovalRecord['status'] = 'requested',
): ApprovalRecord => ({
  approvalId: 'ap',
  revision,
  title: `Deploy v${revision}`,
  status,
});
const caps = { respondToApproval: { available: true } };

async function approvalElement(root: HTMLElement) {
  await frames(2);
  flush();
  const el = root.querySelector(
    'odd-action-approval',
  ) as HTMLElementTagNameMap['odd-action-approval'];
  await el.updateComplete;
  flush();
  return el;
}

describe('framework bindings (A16)', () => {
  it('plain JavaScript: properties assigned before definition are replayed', async () => {
    const el = document.createElement('odd-action-approval-late') as HTMLElement & {
      approval?: ApprovalRecord;
    };
    el.approval = record(1);
    container.append(el);
    const { OddkinActionApproval } = await import('../src/action-approval/index.js');
    customElements.define('odd-action-approval-late', class extends OddkinActionApproval {});
    expect((el as unknown as { approval: ApprovalRecord }).approval).toEqual(record(1));
  });

  it('React 19 sets object properties and receives typed custom events', async () => {
    await import('../src/action-approval/action-approval.define.js');
    const decisions: ApprovalDecideDetail[] = [];
    let setRevision!: (n: number) => void;
    function App() {
      const [revision, set] = useState(1);
      setRevision = set;
      return createElement('odd-action-approval', {
        approval: record(revision),
        capabilities: caps,
        'onapproval-decide': (e: CustomEvent<ApprovalDecideDetail>) => decisions.push(e.detail),
      });
    }
    const root = createRoot(container);
    flushSync(() => root.render(createElement(App)));
    let el = await approvalElement(container);
    expect(el.approval).toEqual(record(1));
    expect(el.getAttribute('approval')).toBeNull();
    (el.shadowRoot!.querySelector('odd-button[appearance="primary"]') as HTMLElement).click();
    expect(decisions).toEqual([
      {
        approvalId: 'ap',
        revision: 1,
        toolCallId: undefined,
        decision: 'approve',
        reason: undefined,
      },
    ]);
    flushSync(() => setRevision(2));
    el = await approvalElement(container);
    expect(el.approval?.revision).toBe(2);
    // Re-rendering with new props never echoes intent events.
    expect(decisions).toHaveLength(1);
    root.unmount();
  });

  it('Vue 3 sets object properties and receives typed custom events', async () => {
    await import('../src/action-approval/action-approval.define.js');
    const decisions: ApprovalDecideDetail[] = [];
    const revision = ref(1);
    const app = createApp({
      setup: () => () =>
        h('odd-action-approval', {
          approval: record(revision.value),
          capabilities: caps,
          onApprovalDecide: (e: CustomEvent<ApprovalDecideDetail>) => decisions.push(e.detail),
        }),
    });
    app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('odd-');
    app.mount(container);
    let el = await approvalElement(container);
    expect(el.approval).toEqual(record(1));
    (el.shadowRoot!.querySelector('odd-button[appearance="primary"]') as HTMLElement).click();
    expect(decisions.map((d) => [d.approvalId, d.revision, d.decision])).toEqual([
      ['ap', 1, 'approve'],
    ]);
    revision.value = 2;
    await nextTick();
    el = await approvalElement(container);
    expect(el.approval?.revision).toBe(2);
    expect(decisions).toHaveLength(1);
    app.unmount();
  });
});
