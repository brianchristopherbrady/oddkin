import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Size the shared indicator and center it against the first line of the label. */
export const checkboxStyles = css`
  .choice {
    --_checkbox-size: ${token('icon.size.md')};
    --_checkbox-line: calc(${token('type.ui.size')} * ${token('type.ui.line-height')});
    --_checkbox-lane: max(${token('target.min')}, var(--_checkbox-size), var(--_checkbox-line));
    min-inline-size: ${token('target.min')};
  }
  :host([size='sm']) .choice {
    --_checkbox-size: ${token('icon.size.sm')};
  }
  :host([size='lg']) .choice {
    --_checkbox-size: ${token('icon.size.lg')};
  }
  .indicator {
    min-block-size: var(--_checkbox-lane);
  }
  :host([size='lg']) .indicator {
    font-size: ${token('icon.size.md')};
  }
  .indicator-box {
    inline-size: var(--_checkbox-size);
    block-size: var(--_checkbox-size);
  }
  .choice > .label {
    padding-block-start: calc((var(--_checkbox-lane) - var(--_checkbox-line)) / 2);
  }
`;
