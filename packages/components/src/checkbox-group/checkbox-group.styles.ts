import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default checkbox group (Figma `CheckboxGroup`): the legend, description, and error
 * are the shared control look; the choices sit one target height apart, as Figma's 48 px rows.
 */
export const checkboxGroupStyles = css`
  .options {
    gap: ${token('space.lg')};
    padding-block: ${token('space.sm')};
  }
`;
