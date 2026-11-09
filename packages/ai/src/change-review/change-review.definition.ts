import { buttonDefinition } from '@oddkin/components/button';
import { disclosureDefinition } from '@oddkin/components/disclosure';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { decisionRowStyles } from '../internal/decision-row.styles.js';
import { OddkinChangeReview } from './change-review.js';
import { changeReviewStyles } from './change-review.styles.js';
import { changeReviewTemplate } from './change-review.template.js';

export const changeReviewDefinition = compose({
  name: 'odd-change-review',
  element: OddkinChangeReview,
  template: changeReviewTemplate,
  styles: [aiBaseStyles, decisionRowStyles, changeReviewStyles],
  dependencies: { button: buttonDefinition, disclosure: disclosureDefinition },
});
