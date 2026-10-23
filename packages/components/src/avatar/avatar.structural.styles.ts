import { css } from '@oddkin/core/styles';

/** A circle that crops its picture and centres its initials. No brand or visual tokens. */
export const avatarStructuralStyles = css`
  :host {
    display: inline-block;
    flex: none;
    vertical-align: middle;
  }
  .avatar {
    display: grid;
    place-items: center;
    inline-size: var(--_avatar-size, 2.5rem);
    block-size: var(--_avatar-size, 2.5rem);
    overflow: hidden;
    border-radius: 50%;
    white-space: nowrap;
  }
  .image {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  @media (forced-colors: active) {
    .avatar {
      border: 1px solid CanvasText;
    }
  }
`;
