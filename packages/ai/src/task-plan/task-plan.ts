import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import type { PlanRecord, StepStatus } from '../contracts/types.js';
import { planInputEvent } from '../events.js';
import { format, strings } from '../internal/strings.js';

export const TASK_PLAN_STRINGS = {
  label: 'Plan',
  progress: '{done} of {total} steps done',
  parallel: 'Running in parallel',
  blocked: 'Blocked: {reason}',
  needsInput: 'Needs your input: {request}',
  respond: 'Respond',
  pending: 'Pending',
  active: 'In progress',
  done: 'Done',
  failed: 'Failed',
  'needs-input': 'Needs input',
  skipped: 'Skipped',
};

const SYMBOL: Record<StepStatus, string> = {
  pending: '\u25CB',
  active: '\u25D4',
  done: '\u2713',
  failed: '\u2715',
  blocked: '\u2298',
  skipped: '\u2013',
  'needs-input': '?',
};

/**
 * An agent's plan: ordered steps, parallel tasks within a step, blockers, progress, and requests
 * for input.
 *
 * @csspart progress - The native progress bar and its text.
 * @csspart steps - The ordered list of steps.
 * @a11y An ordered list; each step's status is text (symbols are decorative). Progress is a labelled native `<progress>` with a text equivalent.
 * @keyboard Tab reaches "Respond" buttons on steps that need input.
 * @useFor Showing multi-step agent work as it proceeds.
 * @notFor Static checklists the user edits.
 * @category AI
 */
export class OddkinTaskPlan extends OddkinElement.with({
  plan: prop.object<PlanRecord>({ description: 'The plan record (replace to update).' }),
  strings: prop.object<Partial<typeof TASK_PLAN_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'odd-plan-input-request': planInputEvent };
  declare readonly _events?: ElementEvents<typeof OddkinTaskPlan>;

  /** @internal */
  get _strings(): typeof TASK_PLAN_STRINGS {
    return strings(TASK_PLAN_STRINGS, this.strings);
  }

  /** @internal */
  _status(status: StepStatus, reason?: string): string {
    const t = this._strings;
    if (status === 'blocked') return format(t.blocked, { reason: reason ?? '' });
    return t[status];
  }

  /** @internal */
  _symbol(status: StepStatus): string {
    return SYMBOL[status];
  }

  /** @internal */
  _progress(): { done: number; total: number } {
    const steps = this.plan?.steps ?? [];
    return {
      done: steps.filter((s) => s.status === 'done' || s.status === 'skipped').length,
      total: steps.length,
    };
  }

  /** @internal */
  readonly _respond = (event: Event): void => {
    const stepId = (event.currentTarget as HTMLElement).dataset['step'];
    if (this.plan && stepId) this.emit(planInputEvent, { planId: this.plan.planId, stepId });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-task-plan': OddkinTaskPlan;
  }
}
