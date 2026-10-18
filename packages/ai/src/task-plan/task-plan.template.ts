import { html, repeat } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinTaskPlan } from './task-plan.js';

/** Anatomy: a title, `progress`, and the `steps` list with nested parallel tasks. */
export const taskPlanTemplate = (host: OddkinTaskPlan) => {
  const t = host._strings;
  const plan = host.plan;
  if (!plan) return html``;
  const { done, total } = host._progress();
  const progressText = format(t.progress, { done, total });
  return html`<section class="base" part="base" aria-labelledby="title">
    <p id="title" class="title">${plan.title || t.label}</p>
    <div part="progress" class="progress">
      <progress .max=${Math.max(total, 1)} .value=${done} aria-label=${progressText}></progress>
      <span class="muted">${progressText}</span>
    </div>
    <ol part="steps" class="steps">
      ${repeat(
        plan.steps,
        (step) => step.id,
        (step) =>
          html`<li class="step" data-status=${step.status}>
            <span class="symbol" aria-hidden="true">${host._symbol(step.status)}</span>
            <div class="body">
              <span class="step-title">${step.title}</span>
              <span class="visually-hidden">, ${host._status(step.status, step.blocker)}</span>
              <span class="muted" aria-hidden="true"
                >${host._status(step.status, step.blocker)}</span
              >
              <span class="detail" ?hidden=${!step.detail}>${step.detail ?? ''}</span>
              ${
                step.status === 'needs-input' && step.inputRequest
                  ? html`<span class="request"
                      >${format(t.needsInput, { request: step.inputRequest })}
                      <button
                        class="text-button"
                        type="button"
                        data-step=${step.id}
                        @click=${host._respond}
                      >
                        ${t.respond}
                      </button></span
                    >`
                  : null
              }
              ${
                step.tasks?.length
                  ? html`<p class="muted parallel">${t.parallel}</p>
                      <ul class="tasks">
                        ${step.tasks.map(
                          (task) =>
                            html`<li class="task" data-status=${task.status}>
                              <span class="symbol" aria-hidden="true"
                                >${host._symbol(task.status)}</span
                              >
                              <span
                                >${task.title}<span class="visually-hidden"
                                  >, ${host._status(task.status)}</span
                                ></span
                              >
                              <span class="muted" aria-hidden="true"
                                >${host._status(task.status)}</span
                              >
                            </li>`,
                        )}
                      </ul>`
                  : null
              }
            </div>
          </li>`,
      )}
    </ol>
  </section>`;
};
