import { html } from '@oddkin/core/template';
import type { OddkinToolCall } from './tool-call.js';

const TONE: Record<string, string> = {
  'output-available': 'success',
  'output-error': 'danger',
  denied: 'danger',
  executing: 'active',
  'input-streaming': 'active',
  'awaiting-approval': 'active',
};

/** Anatomy: `base` with a native disclosure (`summary`, `arguments`, `result`), then any approval. */
export const toolCallTemplate = (host: OddkinToolCall) => {
  const t = host._strings;
  const tool = host.tool;
  if (!tool) return html``;
  const output = host._output();
  const args = host._arguments();
  return html`<div part="base" class="base" data-status=${tool.status}>
      <details class="details">
        <summary part="summary" class="summary">
          <span class="name">${tool.title || tool.toolName}</span>
          <span class="status" data-tone=${TONE[tool.status] ?? ''}>${t[tool.status]}</span>
          <span class="purpose muted" ?hidden=${!tool.purpose}>${tool.purpose ?? ''}</span>
        </summary>
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
      </details>
      ${
        tool.status === 'output-error'
          ? html`<div class="failure" role="group" aria-label=${t.error}>
              <span class="error">${tool.error?.message ?? t['output-error']}</span>
              ${
                tool.retryable
                  ? html`<button class="text-button" type="button" @click=${host._retry}>
                      ${t.retry}
                    </button>`
                  : null
              }
            </div>`
          : null
      }
    </div>
    ${
      host.approval
        ? html`<odd-action-approval
            .approval=${host.approval}
            .capabilities=${host.capabilities}
          ></odd-action-approval>`
        : null
    }`;
};
