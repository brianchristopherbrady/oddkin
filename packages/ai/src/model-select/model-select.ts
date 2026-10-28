import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import type { ModelOption } from '../contracts/types.js';
import { modelChangeEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export const MODEL_SELECT_STRINGS = {
  label: 'Model',
  unavailable: '{label} (unavailable)',
  capabilities: 'Capabilities',
  none: 'No models available',
};

/**
 * Choose among application-provided models, with capabilities and availability. Built on a
 * native `<select>`; unavailable models are listed but disabled, with the host's reason.
 *
 * @csspart label - The visible label of the select.
 * @csspart select - The native select.
 * @csspart details - Description, capabilities, and availability of the selected model.
 * @cssprop --odd-field-height - Minimum height of the select (never below the target-size token). Shared by every form control.
 * @cssprop --odd-field-radius - Corner radius of the select. Shared by every form control.
 * @cssprop --odd-field-border-color - Border colour of the select. Shared by every form control.
 * @cssprop --odd-field-background - Background colour of the select. Shared by every form control.
 * @a11y A labelled native select; details are referenced with `aria-describedby`.
 * @keyboard Native select behavior.
 * @useFor Letting users choose the model used for the next request.
 * @notFor Settings unrelated to models.
 * @limitation Programmatic `value` changes never dispatch `odd-model-change`.
 * @customization 1 2
 * @category AI
 */
export class OddkinModelSelect extends OddkinElement.with({
  models: prop.array<ModelOption>({ description: 'Models supplied by the application.' }),
  value: prop.string({ default: '', reflect: true, description: 'Selected model id.' }),
  label: prop.string({
    default: '',
    description: 'Visible label; defaults to the localized "Model".',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents changing the model.' }),
  strings: prop.object<Partial<typeof MODEL_SELECT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { 'odd-model-change': modelChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinModelSelect>;

  /** @internal */
  get _strings(): typeof MODEL_SELECT_STRINGS {
    return strings(MODEL_SELECT_STRINGS, this.strings);
  }

  /** The selected model record, if listed. */
  get selected(): ModelOption | undefined {
    return this.models.find((m) => m.id === this.value);
  }

  /** @internal */
  readonly _onChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const previousModelId = this.value;
    const modelId = select.value;
    if (this.emit(modelChangeEvent, { modelId, previousModelId })) this.value = modelId;
    else select.value = previousModelId;
  };

  // Options render after the select's own bindings, so the selection is synced after commit.
  protected override updated(): void {
    const select = this.shadowRoot?.querySelector('select');
    if (select && this.models.length && select.value !== this.value) select.value = this.value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-model-select': OddkinModelSelect;
  }
}
