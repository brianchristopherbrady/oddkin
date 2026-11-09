import { live } from '@oddkin/core/helpers/live';
import { css } from '@oddkin/core/styles';
import { html } from '@oddkin/core/template';
import { token } from '@oddkin/tokens/refs';
import type { ApprovalRecord } from '../contracts/types.js';

type ApprovalScope = NonNullable<ApprovalRecord['scopes']>[number];

/** The scope choice's words (the approval's strings). */
export interface ScopeStrings {
  readonly scope: string;
  readonly scopeNone: string;
  readonly scopeRequired: string;
  readonly scopeReset: string;
  readonly scopeSelect: string;
  readonly scopeSelectHelp: string;
}

/** What the scope choice shows. */
export interface ScopeSetup {
  readonly scopes: readonly ApprovalScope[];
  /** The person's choice for this revision, or the only scope; never a default (owner). */
  readonly chosen: string | undefined;
  /** A new revision dropped the person's choice: they choose again. */
  readonly reset: boolean;
  readonly disabled: boolean;
  readonly onChange: (event: Event) => void;
}

/** Above this many scopes the choice is a select (owner, 2026-11-09). */
const RADIOS = 4;

/**
 * Figma page 08's ScopeChoice and ScopeOption (`Oddkin/AI/Internal/ScopeChoice`): what an approval
 * covers. No scopes: this action only. One: explained, nothing to choose. Two to four: described
 * radio rows. More: a select, the chosen scope's description below it. Nothing is chosen for the
 * person.
 */
export const scopeChoice = (setup: ScopeSetup, t: ScopeStrings) => {
  const { scopes, chosen, reset, disabled, onChange } = setup;
  if (scopes.length < 2) {
    const only = scopes[0];
    return html`<div part="scope" class="scope-choice">
      <p class="scope-legend">${t.scope}</p>
      <p class="scope-label">${only ? only.label : t.scopeNone}</p>
      <p class="scope-description" ?hidden=${!only?.description}>${only?.description ?? ''}</p>
    </div>`;
  }
  const hint = html`<p id="scope-hint" class="scope-hint">
    ${reset ? t.scopeReset : t.scopeRequired}
  </p>`;
  if (scopes.length > RADIOS) {
    const selected = scopes.find((scope) => scope.id === chosen);
    return html`<div part="scope" class="scope-choice">
      <label class="scope-legend" for="scope">${t.scope}</label>
      ${hint}
      <select
        id="scope"
        name="scope"
        aria-describedby="scope-hint scope-description"
        ?disabled=${disabled}
        @change=${onChange}
      >
        <option value="" disabled .selected=${live(!selected)}>${t.scopeSelect}</option>
        ${scopes.map(
          (scope) =>
            html`<option .value=${scope.id} .selected=${live(scope.id === chosen)}>
              ${scope.label}
            </option>`,
        )}
      </select>
      <p id="scope-description" class="scope-description">
        ${selected ? (selected.description ?? '') : t.scopeSelectHelp}
      </p>
    </div>`;
  }
  return html`<fieldset
    part="scope"
    class="scope-choice"
    aria-describedby="scope-hint"
    ?disabled=${disabled}
  >
    <legend class="scope-legend">${t.scope}</legend>
    ${hint}
    ${scopes.map(
      (scope, i) =>
        html`<div class="scope-option">
          <label class="choice">
            <span class="indicator">
              <input
                type="radio"
                class="indicator-box"
                name="scope"
                .value=${scope.id}
                .checked=${live(chosen === scope.id)}
                aria-describedby=${scope.description ? `scope-${i}` : null}
                @change=${onChange}
              />
              <span class="indicator-mark indicator-dot"></span>
            </span>
            <span class="scope-label">${scope.label}</span>
          </label>
          <p id=${`scope-${i}`} class="scope-description" ?hidden=${!scope.description}>
            ${scope.description ?? ''}
          </p>
        </div>`,
    )}
  </fieldset>`;
};

/**
 * The scope choice on the sunken surface, its hints and descriptions in the small secondary text,
 * and each radio drawn round on the shared control indicator. Its arrangement is the approval's
 * layout recipe; the look is light until the approval's own Figma design (owner, 2026-11-09).
 */
export const scopeChoiceStyles = css`
  .scope-choice {
    margin: 0;
    padding: ${token('space.sm')};
    border: 0;
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.sunken')};
  }
  /* Floated, the legend is an ordinary item inside the sunken box rather than on its edge. */
  .scope-legend {
    float: inline-start;
    margin: 0;
    padding: 0;
    font-weight: ${token('font.weight.medium')};
  }
  :is(.scope-label, .scope-hint, .scope-description) {
    margin: 0;
  }
  :is(.scope-hint, .scope-description) {
    font-size: ${token('type.small.size')};
    color: ${token('color.text.secondary')};
  }
  .scope-option .scope-description {
    padding-inline-start: calc(
      ${token('space.2xs')} + ${token('icon.size.sm')} + ${token('space.sm')}
    );
  }
  .indicator-box,
  .indicator-dot {
    border-radius: ${token('radius.full')};
  }
  .indicator-dot {
    inline-size: 40%;
    block-size: 40%;
    background: currentColor;
  }
  .indicator-box:checked ~ .indicator-dot {
    visibility: visible;
  }
`;
