import { html } from '@oddkin/core/template';
import type { OddkinAvatar } from './avatar.js';

/** Anatomy: `part="base"` circle with `part="image"` while the picture loads, else the initials. */
export const avatarTemplate = (avatar: OddkinAvatar) => {
  const picture = avatar.src !== '' && !avatar._failed.value;
  return html`<span part="base" class="avatar"
    >${
      picture
        ? html`<img
            part="image"
            class="image"
            alt=""
            src=${avatar.src}
            @error=${avatar._onError}
          />`
        : html`<span class="initials" aria-hidden="true"><slot>${avatar._initials}</slot></span>`
    }</span
  >`;
};
