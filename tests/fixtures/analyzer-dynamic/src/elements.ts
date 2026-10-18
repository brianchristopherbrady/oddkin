import { OddkinElement, define, prop } from '@oddkin/core';

// Analysis must never execute library modules.
throw new Error('analysis executed this module');

const shared = { tone: prop.string() };
const key = 'label';

/** @oddkin-metadata ./elements.metadata.json */
export class DynamicElement extends OddkinElement.with({
  ...shared,
  [key]: prop.string(),
  size: prop.number({ default: Math.PI }),
  open: prop.boolean({ reflect: true }),
}) {}

define('dynamic-element', DynamicElement);
