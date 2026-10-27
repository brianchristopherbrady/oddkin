import { event, prop, type ElementEvents } from '@oddkin/core/element';
import { format, formatNumber, langOf, strings } from '@oddkin/core/i18n';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

export const FILE_INPUT_STRINGS = {
  title: 'Choose a file or drop it here',
  titleMultiple: 'Choose files or drop them here',
  remove: 'Remove {name}',
};

/** Native `input` crosses the shadow boundary; a drop or a removal dispatches it at the host. */
export const fileInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
});
/** Re-dispatched at the host for each user change (native `change` is not composed). */
export const fileChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/**
 * A file chooser over a native `<input type="file">`: a drop zone with a title, the help text,
 * the browser's own picker button, and the chosen files as rows with their size and a remove
 * button. The form value is the files under `name`, as a native file input submits them.
 *
 * @csspart field - The field: label, surface, and external descriptions.
 * @csspart label - The visible label.
 * @csspart surface - The drop zone: title (or error), description, picker button, and files.
 * @csspart title - The instruction, "Choose a file or drop it here"; the error replaces it.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native file input; its `::file-selector-button` takes the secondary button look.
 * @csspart files - The list of chosen files.
 * @csspart file - A chosen file's row: glyph, name, size, and remove button.
 * @csspart remove - A row's remove button.
 * @csspart error - The error message, in the title's place, referenced by `aria-describedby`.
 * @cssstate user-invalid - The field shows its error: `error` is set, or a required field has no file after focus left it or a validity check failed.
 * @cssstate drop-target - Files are being dragged over the surface.
 * @a11y The native file input, named by the label and described by the description and error; the browser announces its button and the chosen files. Each row's remove button is named "Remove {name}" (`strings.remove`); removing a file moves focus to the next row's button, or to the input. Dropping files is an alternative to the picker, never the only way.
 * @keyboard Tab reaches the file input, then each remove button; Enter or Space opens the browser's picker or removes a file.
 * @previewRole fileInput
 * @useFor Attaching files to a form submission.
 * @notFor Uploading in the background with progress (render your own rows); choosing an image to preview and crop.
 * @limitation The picker button's text ("Choose File", "Browse…") is the browser's and follows the browser's language; the input's own file-count text is hidden, since the rows list the files.
 * @limitation `files` is read-only; the user chooses, drops, and removes files. Dropped files are not filtered by `accept`, as on a native input: check them on the server. Reset clears them, and the browser does not restore chosen files after navigation.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinFileInput extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the control.' }),
  accept: prop.string({
    default: '',
    description: 'File types the picker offers, as on native inputs (image/*, or .pdf for PDFs).',
  }),
  multiple: prop.boolean({ reflect: true, description: 'Several files can be chosen.' }),
  required: prop.boolean({ reflect: true, description: 'A file is required to submit.' }),
  strings: prop.object<Partial<typeof FILE_INPUT_STRINGS>>({
    description: 'Localized string overrides: `title`, `titleMultiple`, `remove`.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: fileInputEvent, change: fileChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinFileInput>;

  readonly #files = signal<readonly File[]>([]);
  #focusAfterRemove: number | null = null;
  #dragDepth = 0;

  /** The chosen files, in the order the picker or the drop gave them. */
  get files(): readonly File[] {
    return this.#files.value;
  }

  /** @internal The chosen files for the template. */
  readonly _files: Readable<readonly File[]> = this.#files;

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof FILE_INPUT_STRINGS> = computed(() =>
    strings(FILE_INPUT_STRINGS, this.strings),
  );

  /** @internal A file's size in the page language ("2.4 MB"). */
  _size(bytes: number): string {
    let unit = 0;
    while (bytes >= 1000 && unit < UNITS.length - 1) {
      bytes /= 1000;
      unit++;
    }
    return formatNumber(bytes, langOf(this), {
      style: 'unit',
      unit: UNITS[unit],
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    });
  }

  /** @internal A row's remove-button name. */
  _removeLabel(file: File): string {
    return format(this._strings.value.remove, { name: file.name });
  }

  #input(): HTMLInputElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLInputElement>('[part~="control"]');
  }

  #inactive(): boolean {
    return this._formDisabled.value;
  }

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => {
        const files = this.#files.value;
        // As native: no file submits one empty, unnamed file under the name.
        if (!files.length) return new File([], '', { type: 'application/octet-stream' });
        const data = new FormData();
        for (const file of files) data.append(this.name ?? '', file);
        return data;
      },
      control: () => this.#input(),
      watch: () => [this.required, this.#files.value],
      onReset: () => {
        const input = this.#input();
        if (input) input.value = '';
        this.#files.value = [];
      },
    };
  }

  /** Puts `files` in the native input and the rows, then reports the user's change. */
  #set(files: readonly File[]): void {
    const input = this.#input();
    if (!input) return;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    this.#files.value = files;
    this.emit(fileInputEvent);
    this.emit(fileChangeEvent);
  }

  /** @internal Template handler: the user chose files in the picker. */
  readonly _onChange = (event: Event): void => {
    this.#files.value = [...((event.target as HTMLInputElement).files ?? [])];
    this.emit(fileChangeEvent);
  };

  /** @internal Template handler: files dragged over the surface can drop there. */
  readonly _onDragOver = (event: DragEvent): void => {
    if (this.#inactive() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
  };

  /** @internal Template handler: a drag entered or left the surface or one of its children. */
  readonly _onDragEdge = (event: DragEvent): void => {
    this.#dragDepth = Math.max(0, this.#dragDepth + (event.type === 'dragenter' ? 1 : -1));
    const over = this.#dragDepth > 0 && !this.#inactive();
    this.setState('drop-target', over && !!event.dataTransfer?.types.includes('Files'));
  };

  /** @internal Template handler: files dropped on the surface. */
  readonly _onDrop = (event: DragEvent): void => {
    this.#dragDepth = 0;
    this.setState('drop-target', false);
    const dropped = [...(event.dataTransfer?.files ?? [])];
    if (this.#inactive() || !dropped.length) return;
    event.preventDefault();
    this.#set(this.multiple ? dropped : dropped.slice(0, 1));
  };

  /** @internal Template handler: the user removed one file. */
  _remove(file: File): void {
    const files = this.#files.value;
    this.#focusAfterRemove = files.indexOf(file);
    this.#set(files.filter((f) => f !== file));
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    scope.effect(
      () => {
        void this.#files.value;
        const index = this.#focusAfterRemove;
        if (index === null) return;
        this.#focusAfterRemove = null;
        // The row that took the removed one's place, the one before it, or the input.
        const buttons = this.shadowRoot!.querySelectorAll<HTMLElement>('[part~="remove"]');
        untracked(() => (buttons[Math.min(index, buttons.length - 1)] ?? this.#input())?.focus());
      },
      { phase: 'post', name: '<odd-file-input> focus after removal' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-file-input': OddkinFileInput;
  }
}
