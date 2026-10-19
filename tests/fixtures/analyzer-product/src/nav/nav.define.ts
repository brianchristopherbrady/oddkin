import { OddkinSideNav, sideNavDefinition } from '@oddkin/components/side-nav';
import { compose, define } from '@oddkin/core/element';

// Analysis must never execute product modules.
throw new Error('analysis executed the studio nav module');

/** Studio's navigation: Oddkin's side navigation, unchanged, under Studio's name. */
export class StudioNav extends OddkinSideNav {}

export const studioNavDefinition = compose({
  ...sideNavDefinition,
  name: 'studio-nav',
  element: StudioNav,
});

define(studioNavDefinition);
