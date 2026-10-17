import { MoteElement, compose, define } from '@mote/core';

class Computed extends MoteElement {}
class Made extends MoteElement {}

const suffix = 'x';
export const computedName = compose({ name: `dyn-${suffix}`, element: Computed });

const make = () => compose({ name: 'dyn-made', element: Made });
define(make());

const base = (globalThis as { base?: object }).base ?? {};
export const spreadUnknown = compose({ ...base, name: 'dyn-spread', element: Made });
