import { html } from '@oddkin/core/template';
import type { OddkinToolCall } from './tool-call.js';

/**
 * Anatomy (Figma page 10): the `base` card holds the call's `summary` (its name, its status, and
 * its purpose), the Details disclosure with its `arguments` and `result`, the failure and Retry,
 * which stay visible while Details is closed, and any approval, whose open request stays visible
 * too. The card is a group named by the call.
 */
export const toolCallTemplate = (host: OddkinToolCall) => {
  const t = host._strings;
  const tool = host.tool;
  if (!tool) return html``;
  const status = host._status(tool);
  const output = host._output();
  const args = host._arguments();
  return html`<div
    part="base"
    class="base"
    role="group"
    aria-labelledby="name"
    data-status=${tool.status}
  >
    <div part="summary" class="summary">
      <p id="name" class="name">${tool.title || tool.toolName}</p>
      <p class="state">${t[status]}</p>
      <p class="purpose" ?hidden=${!tool.purpose}>${tool.purpose ?? ''}</p>
    </div>
    <odd-disclosure class="details" label=${t.details} ?hidden=${!args && output === undefined}>
      <div class="body">
        <div part="arguments" class="section" ?hidden=${!args}>
          <p class="label">${t.arguments}</p>
          <pre class="code" tabindex="0">${args}</pre>
        </div>
        <div part="result" class="section" ?hidden=${output === undefined}>
          <p class="label">${t.result}</p>
          ${typeof output === 'string' ? html`<pre class="code" tabindex="0">${output}</pre>` : output}
        </div>
      </div>
    </odd-disclosure>
    ${
      tool.status === 'output-error'
        ? html`<div class="failure" role="group" aria-label=${t.error}>
            <p class="error">${tool.error?.message ?? t['output-error']}</p>
            ${
              tool.retryable
                ? html`<button class="odd-button" type="button" @click=${host._retry}>
                    ${t.retry}
                  </button>`
                : null
            }
          </div>`
        : null
    }
    ${
      host.approval
        ? html`<odd-action-approval
            .approval=${host.approval}
            .capabilities=${host.capabilities}
          ></odd-action-approval>`
        : null
    }
  </div>`;
};
