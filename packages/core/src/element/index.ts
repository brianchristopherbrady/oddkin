/**
 * `@oddkin/core/element` — the authoring base class, properties, events, and registration.
 * Requires a DOM (`HTMLElement`).
 */
export { OddkinElement, elementProperties } from './element.js';
export type {
  ElementEventMap,
  ElementProperties,
  ElementProperty,
  OddkinElementClass,
  WithProps,
} from './element.js';
export { prop, attributeNameFor } from './props.js';
export type { Conversion, PropDefinition, PropDefinitions, PropKind, PropValues } from './props.js';
export { event, emit } from './events.js';
export type { ElementEvents, EventDefinition, EventDefinitionInit, EventDetail } from './events.js';
export { define } from './define.js';
export { compose, isElementDefinition } from './definition.js';
export type { ElementDefinition, ElementDefinitionInit, ElementTemplate } from './definition.js';
export type { DefineOptions } from './define.js';
