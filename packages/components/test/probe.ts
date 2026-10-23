import { compose, define, type ElementDefinition } from '@oddkin/core/element';
import { flush } from '@oddkin/core/reactive';

// Playwright's role locators and axe cannot read ElementInternals semantics, so tests read them
// through a test-only subclass registered as `probe-<name>`.
export interface Semantics {
  readonly role: string | null;
  readonly label: string | null;
  readonly hidden: string | null;
}

/** Registers `probe-<name>` for a definition (once) and returns the tag. */
export function probeTag(definition: { readonly name: string; readonly element: unknown }): string {
  const tag = definition.name.replace(/^odd-/, 'probe-');
  if (!customElements.get(tag)) {
    const Base = definition.element as new () => HTMLElement;
    class Probe extends Base {
      get semantics(): Semantics {
        const internals = (this as unknown as { internals: ElementInternals }).internals;
        return {
          role: internals.role ?? null,
          label: internals.ariaLabel ?? null,
          hidden: internals.ariaHidden ?? null,
        };
      }
    }
    define(compose({ ...(definition as ElementDefinition), name: tag, element: Probe as never }));
  }
  return tag;
}

export const semantics = (el: Element): Semantics =>
  (el as unknown as { semantics: Semantics }).semantics;

/** Loads the shipped default theme into the document; returns a function that removes it. */
export async function loadTheme(): Promise<() => void> {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../tokens/dist/css/default.css', import.meta.url).href;
  await new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = reject;
    document.head.append(link);
  });
  return () => link.remove();
}

/** The computed value of a theme custom property for `property`, resolved in this document. */
export function themeValue(property: string, variable: string): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, `var(${variable})`);
  document.body.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

/** Waits for the element's update and the reactive flush. */
export async function settle(el: Element): Promise<void> {
  flush();
  await (el as unknown as { updateComplete?: Promise<void> }).updateComplete;
  flush();
  await new Promise(requestAnimationFrame);
}
