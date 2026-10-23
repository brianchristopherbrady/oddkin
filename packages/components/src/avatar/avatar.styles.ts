import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default avatar: Figma `avatar` (sunken circle, primary initials; 32, 40, 48 px). */
export const avatarStyles = css`
  :host {
    --_avatar-size: var(--odd-avatar-size, ${token('control.height.md')});
  }
  :host([size='sm']) {
    --_avatar-size: var(--odd-avatar-size, ${token('control.height.sm')});
  }
  :host([size='lg']) {
    --_avatar-size: var(--odd-avatar-size, ${token('control.height.lg')});
  }
  .avatar {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  :host([size='sm']) .avatar {
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
  }
`;
