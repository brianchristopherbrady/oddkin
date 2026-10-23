import { live } from '@oddkin/core/helpers/live';
import { html, repeat } from '@oddkin/core/template';
import { can } from '../contracts/normalize.js';
import type { MessagePart } from '../contracts/types.js';
import { safeUrl } from '../markdown/url.js';
import { format } from '../internal/strings.js';
import type { OddkinMessage } from './message.js';

interface PartContext {
  readonly tools: OddkinMessage['tools'];
  readonly approvals: OddkinMessage['approvals'];
  readonly artifacts: OddkinMessage['artifacts'];
  readonly capabilities: OddkinMessage['capabilities'];
  readonly markdown: OddkinMessage['markdown'];
  readonly artifactRenderers: OddkinMessage['artifactRenderers'];
  readonly renderTool: OddkinMessage['renderTool'];
  readonly sources: OddkinMessage['_sources'];
  readonly error: NonNullable<OddkinMessage['attempt']>['error'];
}

const part = (host: OddkinMessage, p: MessagePart, lastText: boolean, c: PartContext) => {
  const t = host._strings;
  const role = host.message?.role;
  switch (p.type) {
    case 'text':
      return role === 'assistant'
        ? html`<odd-response
            .text=${p.text}
            .status=${host._textStatus(p, lastText)}
            .error=${c.error}
            .sources=${c.sources}
            .markdown=${c.markdown}
          ></odd-response>`
        : html`<p class="plain-text">${p.text}</p>`;
    case 'reasoning':
      return html`<details class="reasoning">
        <summary>${t.reasoning}</summary>
        <odd-response
          .text=${p.text}
          .status=${host._textStatus(p, false)}
          .markdown=${c.markdown}
        ></odd-response>
      </details>`;
    case 'file': {
      const url = p.url ? safeUrl(p.url) : undefined;
      return html`<p class="file">
        <span class="muted">${t.file}:</span>
        ${url ? html`<a href=${url} rel="noopener noreferrer nofollow" target="_blank">${p.name}</a>` : html`<span>${p.name}</span>`}
      </p>`;
    }
    case 'source':
      return null;
    case 'tool-call': {
      const tool = c.tools?.[p.toolCallId];
      if (!tool) return html`<p class="fallback">${t.toolMissing}</p>`;
      return html`<odd-tool-call
        .tool=${tool}
        .approval=${tool.approvalId ? c.approvals?.[tool.approvalId] : undefined}
        .capabilities=${c.capabilities}
        .renderOutput=${c.renderTool}
      ></odd-tool-call>`;
    }
    case 'approval': {
      const approval = c.approvals?.[p.approvalId];
      if (!approval) return html`<p class="fallback">${t.approvalMissing}</p>`;
      return html`<odd-action-approval
        .approval=${approval}
        .capabilities=${c.capabilities}
      ></odd-action-approval>`;
    }
    case 'artifact': {
      const artifact = c.artifacts?.[p.artifactId];
      if (!artifact) return html`<p class="fallback">${t.artifactMissing}</p>`;
      return html`<odd-artifact
        .artifact=${artifact}
        revision-id=${p.revisionId ?? ''}
        .renderers=${c.artifactRenderers}
        .markdown=${c.markdown}
      ></odd-artifact>`;
    }
    case 'data':
      return (
        host._data(p) ?? html`<p class="fallback">${format(t.dataInvalid, { name: p.name })}</p>`
      );
    case 'unsupported':
      return html`<p class="fallback">${host._unsupported(p.originalType)}</p>`;
  }
};

/** Anatomy: `header` (role, provenance), `content` (parts in order, then sources), and `footer`. */
export const messageTemplate = (host: OddkinMessage) => {
  const t = host._strings;
  const m = host.message;
  if (!m) return html``;
  const parts = m.parts;
  let lastText = -1;
  parts.forEach((p, i) => {
    if (p.type === 'text') lastText = i;
  });
  const assistant = m.role === 'assistant';
  const editing = host._editing.value;
  const terminal = ['completed', 'cancelled', 'failed', 'interrupted'].includes(
    host.attempt?.status ?? 'completed',
  );
  const sources = host._sources;
  // Repeat items render untracked during commit: read everything they use here.
  const context: PartContext = {
    tools: host.tools,
    approvals: host.approvals,
    artifacts: host.artifacts,
    capabilities: host.capabilities,
    markdown: host.markdown,
    artifactRenderers: host.artifactRenderers,
    renderTool: host.renderTool,
    sources,
    error: host.attempt?.error,
  };
  void host.renderers;
  return html`<div class="base" data-role=${m.role}>
    <div part="header" class="header">
      <span class="role">${t[m.role]}</span>
      ${m.provenance ? html`<odd-ai-label .provenance=${m.provenance}></odd-ai-label>` : null}
    </div>
    <div part="content" class="content" ?hidden=${editing !== undefined}>
      ${repeat(
        parts,
        (p) => p.id,
        (p, i) => part(host, p, i === lastText, context),
      )}
      ${sources.length ? html`<odd-sources .sources=${sources}></odd-sources>` : null}
    </div>
    ${
      editing !== undefined
        ? html`<form class="edit" @submit=${host._saveEdit} @keydown=${host._onEditKey}>
            <label
              ><span class="visually-hidden">${t.editLabel}</span>
              <textarea rows="3" .value=${live(editing)} @input=${host._onEditInput}></textarea>
            </label>
            <div class="actions">
              <odd-button size="sm" appearance="primary" @click=${host._saveEdit}
                >${t.save}</odd-button
              >
              <odd-button size="sm" appearance="ghost" @click=${host._cancelEdit}
                >${t.cancel}</odd-button
              >
            </div>
          </form>`
        : null
    }
    <div part="footer" class="footer actions" ?hidden=${editing !== undefined}>
      <odd-message-branch
        .messageId=${m.id}
        .branch=${host.branch}
        .capabilities=${host.capabilities}
      ></odd-message-branch>
      ${host.text ? html`<button class="text-button" type="button" @click=${host._copy}>${t.copy}</button>` : null}
      ${
        assistant && host._can('regenerate') && terminal && m.attemptId
          ? html`<button class="text-button" type="button" @click=${host._regenerate}>
              ${t.regenerate}
            </button>`
          : null
      }
      ${
        m.role === 'user' && host._can('edit')
          ? html`<button
              class="text-button"
              type="button"
              data-action="edit"
              @click=${host._startEdit}
            >
              ${t.edit}
            </button>`
          : null
      }
      ${
        assistant && can(host.capabilities, 'feedback') && terminal
          ? html`<odd-response-feedback
              .messageId=${m.id}
              .feedback=${host.feedback}
              .reasons=${host.feedbackReasons}
            ></odd-response-feedback>`
          : null
      }
    </div>
  </div>`;
};
