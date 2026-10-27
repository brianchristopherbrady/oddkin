// @oddkin/components/autoload (ADR 0046 D9): the loader alone; each definition it imports is
// fetched by URL at run time, so none is in this graph.
import { load, observe } from '@oddkin/components/autoload';

export { load, observe };
