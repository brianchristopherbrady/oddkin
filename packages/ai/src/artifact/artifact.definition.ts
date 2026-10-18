import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinArtifact } from './artifact.js';
import { artifactStyles } from './artifact.styles.js';
import { artifactTemplate } from './artifact.template.js';

export const artifactDefinition = compose({
  name: 'odd-artifact',
  element: OddkinArtifact,
  template: artifactTemplate,
  styles: [aiBaseStyles, artifactStyles],
});
