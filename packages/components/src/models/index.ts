// Runtime validators and migrations for component models. Not needed to render components:
// element entries import only the types, so their bundles exclude validation.
export { NavigationItemModel, navigationModel } from './navigation.js';
export type { Navigation, NavigationItem } from './navigation.js';
