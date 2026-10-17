/**
 * `@mote/core/element` — the authoring base class, properties, events, and registration.
 * Requires a DOM (`HTMLElement`).
 */
export { MoteElement, elementProperties } from './element.js';
export type { ElementProperty, MoteElementClass, WithProps } from './element.js';
export { prop, attributeNameFor } from './props.js';
export type { Conversion, PropDefinition, PropDefinitions, PropKind, PropValues } from './props.js';
export { event, emit } from './events.js';
export type { EventDefinition, EventDefinitionInit, EventDetail } from './events.js';
export { define } from './define.js';
export type { DefineOptions } from './define.js';
