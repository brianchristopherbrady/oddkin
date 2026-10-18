import { OddkinElement, compose, define } from '@oddkin/core';

class Computed extends OddkinElement {}
class Made extends OddkinElement {}

const suffix = 'x';
export const computedName = compose({ name: `dyn-${suffix}`, element: Computed });

const make = () => compose({ name: 'dyn-made', element: Made });
define(make());

const base = (globalThis as { base?: object }).base ?? {};
export const spreadUnknown = compose({ ...base, name: 'dyn-spread', element: Made });
