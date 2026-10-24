import { css } from '@oddkin/core/styles';

/**
 * The textarea is a block; its field layout is the shared `fieldStructuralStyles`. The user
 * drags its height (`resize="vertical"`), or it follows its content (`resize="auto"`: native
 * field sizing where the engine has it, a measured height otherwise). No brand tokens.
 */
export const textareaStructuralStyles = css`
  :host {
    display: block;
  }
  .control {
    resize: vertical;
  }
  :host([resize='none']) .control,
  :host([resize='auto']) .control {
    resize: none;
  }
  @supports (field-sizing: content) {
    :host([resize='auto']) .control {
      field-sizing: content;
    }
  }
`;
