// Context between elements: a provider and a consumer from @oddkin/state/context alone.
import { consume, createContext, provide } from '@oddkin/state/context';
import { createScope } from '@oddkin/core/scope';

const theme = createContext<string>('theme');
export function connect(host: Element, child: Element) {
  const scope = createScope();
  scope.use(provide(host, theme, 'light'));
  const value = scope.use(consume(child, theme, { fallback: 'none' }));
  value.subscribe((name) => globalThis.console.log(name));
  return scope;
}
