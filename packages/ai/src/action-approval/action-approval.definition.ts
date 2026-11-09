import { badgeDefinition } from '@oddkin/components/badge';
import { buttonDefinition } from '@oddkin/components/button';
import { disclosureDefinition } from '@oddkin/components/disclosure';
import {
  controlIndicatorStructuralStyles,
  controlIndicatorStyles,
  controlStyles,
  fieldStructuralStyles,
} from '@oddkin/components/styles';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { decisionRowStyles } from '../internal/decision-row.styles.js';
import { scopeChoiceStyles } from '../internal/scope-choice.js';
import { OddkinActionApproval } from './action-approval.js';
import { actionApprovalStyles } from './action-approval.styles.js';
import { actionApprovalTemplate } from './action-approval.template.js';

export const actionApprovalDefinition = compose({
  name: 'odd-action-approval',
  element: OddkinActionApproval,
  template: actionApprovalTemplate,
  styles: [
    aiBaseStyles,
    controlIndicatorStructuralStyles,
    controlIndicatorStyles,
    fieldStructuralStyles,
    controlStyles,
    decisionRowStyles,
    scopeChoiceStyles,
    actionApprovalStyles,
  ],
  dependencies: {
    badge: badgeDefinition,
    button: buttonDefinition,
    disclosure: disclosureDefinition,
  },
});
