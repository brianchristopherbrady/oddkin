// A splitter between two panes: @oddkin/core/controllers/resize with a Scope, nothing else.
import { ResizeHandle } from '@oddkin/core/controllers/resize';
import { createScope } from '@oddkin/core/scope';

export function attach(container: HTMLElement, handle: HTMLElement) {
  const scope = createScope();
  let position = 50;
  const apply = (value: number) => {
    position = value;
    container.style.setProperty('grid-template-columns', `${value}fr auto ${100 - value}fr`);
    handle.setAttribute('aria-valuenow', String(Math.round(value)));
  };
  scope.use(
    new ResizeHandle({
      handle: () => handle,
      container: () => container,
      value: () => position,
      min: () => 10,
      max: () => 90,
      onInput: apply,
    }),
  );
  return scope;
}
