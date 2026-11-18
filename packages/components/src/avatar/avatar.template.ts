import { html, nothing, repeat } from '@oddkin/core/template';
import type { OddkinAvatar } from './avatar.js';

/**
 * Anatomy: `part="base"` circle holding the initials (or slotted content) until the picture of
 * `src` has loaded, then `part="image"`. The picture is requested hidden; it fails into the
 * initials. Each source gets its own image, so a replaced request and its listeners go with it.
 */
export const avatarTemplate = (avatar: OddkinAvatar) => {
  const source = avatar.src;
  const requested = source !== '' && avatar._failed.value !== source;
  const loaded = requested && avatar._loaded.value === source;
  return html`<span part="base" class="avatar"
    >${repeat(
      requested ? [source] : [],
      (picture) => picture,
      (picture) =>
        html`<img
          part="image"
          class="image"
          alt=""
          src=${picture}
          ?hidden=${!loaded}
          @load=${(event: Event) => avatar._settle(event, picture)}
          @error=${(event: Event) => avatar._settle(event, picture)}
        />`,
    )}${
      loaded
        ? nothing
        : html`<span class="initials" aria-hidden="true"><slot>${avatar._initials}</slot></span>`
    }</span
  >`;
};
