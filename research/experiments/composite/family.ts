/**
 * Two component families for the composite prototype: Oddkin's published input and button, and
 * a product's recomposed `studio-*` implementations of the same foundations (multi-product.md §5).
 * The studio family keeps behavior and anatomy and changes only the name and class, which is all
 * the composite mechanisms need to tell the families apart.
 */
import { OddkinButton, buttonDefinition } from '@oddkin/components/button';
import { OddkinInput, inputDefinition } from '@oddkin/components/input';
import { compose, type ElementDefinition } from '@oddkin/core/element';

export interface Family {
  readonly input: ElementDefinition<OddkinInput>;
  readonly button: ElementDefinition<OddkinButton>;
}

class StudioInput extends OddkinInput {}
class StudioButton extends OddkinButton {}

export const oddkinFamily: Family = { input: inputDefinition, button: buttonDefinition };

export const studioFamily: Family = {
  input: compose({ ...inputDefinition, name: 'studio-input', element: StudioInput }),
  button: compose({ ...buttonDefinition, name: 'studio-button', element: StudioButton }),
};
