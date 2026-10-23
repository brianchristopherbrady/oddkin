import { html } from '@oddkin/core/template';
import type { OddkinArtifact } from './artifact.js';

/** Anatomy: a labelled region with `header`, a `preview` container, and a `source` view. */
export const artifactTemplate = (host: OddkinArtifact) => {
  const t = host._strings;
  const a = host.artifact;
  const revision = host.revision;
  if (!a || !revision) return html`<div part="preview" hidden></div>`;
  const previewable = host._previewable;
  const mode = previewable ? host.view : 'source';
  return html`<section class="base" aria-labelledby="title">
    <div part="header" class="header">
      <p id="title" class="title">${a.title}</p>
      <label class="revision" ?hidden=${a.revisions.length < 2}>
        <span class="visually-hidden">${t.revision}</span>
        <select @change=${host._onRevision}>
          ${a.revisions.map(
            (r) =>
              html`<option .value=${r.revisionId} ?selected=${r.revisionId === revision.revisionId}>
                ${host._revisionLabel(r, a.revisions.length)}
              </option>`,
          )}
        </select>
      </label>
      <span class="muted" ?hidden=${a.revisions.length > 1}
        >${host._revisionLabel(revision, a.revisions.length)}</span
      >
      <div class="actions" role="group" aria-label=${t.view} ?hidden=${!previewable}>
        <button
          class="text-button"
          type="button"
          data-view="preview"
          aria-pressed=${mode === 'preview' ? 'true' : 'false'}
          @click=${host._setMode}
        >
          ${t.preview}
        </button>
        <button
          class="text-button"
          type="button"
          data-view="source"
          aria-pressed=${mode === 'source' ? 'true' : 'false'}
          @click=${host._setMode}
        >
          ${t.source}
        </button>
      </div>
      <div class="actions">
        <button class="text-button" type="button" @click=${host._copy}>${t.copy}</button>
        <button class="text-button" type="button" data-format="source" @click=${host._export}>
          ${t.download}
        </button>
        ${host.exports.map((e) => html`<button class="text-button" type="button" data-format=${e.format} @click=${host._export}>${e.label}</button>`)}
      </div>
    </div>
    <p class="muted" ?hidden=${previewable}>${t.noPreview}</p>
    <p class="summary muted" ?hidden=${!revision.summary}>${revision.summary ?? ''}</p>
    <div part="preview" class="preview" ?hidden=${mode !== 'preview'}></div>
    <pre part="source" class="source" tabindex="0" ?hidden=${mode !== 'source'}>
${revision.content}</pre>
  </section>`;
};
