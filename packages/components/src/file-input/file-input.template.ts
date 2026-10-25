import { html, repeat } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { closeGlyph, fileGlyph, uploadGlyph } from '../styles/glyphs.js';
import type { OddkinFileInput } from './file-input.js';

/**
 * Anatomy: a `label` part labelling the native `<input type="file" part="control">` inside the
 * `surface` drop zone, which holds the upload glyph with the `title` (or the `error` in its
 * place), the `description`, the input, and the `files` list of `file` rows (file glyph, name,
 * size, `remove` button). `description` and `error` are referenced by `aria-describedby`.
 */
export const fileInputTemplate = (input: OddkinFileInput) => {
  const files = input._files.value;
  const text = input._strings.value;
  const inactive = input._formDisabled.value;
  return html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!input.label}>${input.label}</label>
    <div
      part="surface"
      class="surface"
      @dragenter=${input._onDragEdge}
      @dragleave=${input._onDragEdge}
      @dragover=${input._onDragOver}
      @drop=${input._onDrop}
    >
      <div class="header">
        <span class="header-glyph">${uploadGlyph}</span>
        <span part="title" class="title" ?hidden=${!!input.error}>
          ${input.multiple ? text.titleMultiple : text.title}
        </span>
        <span part="error" id="error" class="error" ?hidden=${!input.error}>${input.error}</span>
      </div>
      <div part="description" id="description" class="description" ?hidden=${!input.description}>
        ${input.description}
      </div>
      <input
        part="control"
        id="control"
        class="picker"
        type="file"
        accept=${input.accept}
        ?multiple=${input.multiple}
        ?required=${input.required}
        ?disabled=${inactive}
        aria-describedby=${input._describedBy}
        aria-invalid=${input._userInvalid.value ? 'true' : null}
        @change=${input._onChange}
        @blur=${input._onBlur}
      />
      <ul part="files" class="files" ?hidden=${!files.length}>
        ${repeat(
          files,
          (file) => file,
          (file) =>
            html`<li part="file" class="file">
              <span class="file-glyph">${fileGlyph}</span>
              <span class="file-text">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${input._size(file.size)}</span>
              </span>
              <button
                part="remove"
                class="remove"
                type="button"
                aria-label=${input._removeLabel(file)}
                ?disabled=${inactive}
                @click=${() => input._remove(file)}
              >
                ${closeGlyph}
              </button>
            </li>`,
        )}
      </ul>
    </div>
    ${externalDescriptionTemplate(input._externalDescription)}
  </div>`;
};
