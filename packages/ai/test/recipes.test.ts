import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { LayoutRecipe } from '@oddkin/components/layout';
import type { CSSResult } from '@oddkin/core/styles';
import { actionApprovalRecipe } from '../src/action-approval/action-approval.recipe.js';
import { actionApprovalRecipeStyles } from '../src/action-approval/action-approval.recipe.styles.js';
import { actionApprovalStyles } from '../src/action-approval/action-approval.styles.js';
import { activityRecipe } from '../src/activity/activity.recipe.js';
import { activityRecipeStyles } from '../src/activity/activity.recipe.styles.js';
import { activityStyles } from '../src/activity/activity.styles.js';
import { artifactRecipe } from '../src/artifact/artifact.recipe.js';
import { artifactRecipeStyles } from '../src/artifact/artifact.recipe.styles.js';
import { artifactStyles } from '../src/artifact/artifact.styles.js';
import { changeReviewRecipe } from '../src/change-review/change-review.recipe.js';
import { changeReviewRecipeStyles } from '../src/change-review/change-review.recipe.styles.js';
import { changeReviewStyles } from '../src/change-review/change-review.styles.js';
import { checkpointRecipe } from '../src/checkpoint/checkpoint.recipe.js';
import { checkpointRecipeStyles } from '../src/checkpoint/checkpoint.recipe.styles.js';
import { checkpointStyles } from '../src/checkpoint/checkpoint.styles.js';
import { citationRecipe } from '../src/citation/citation.recipe.js';
import { citationRecipeStyles } from '../src/citation/citation.recipe.styles.js';
import { citationStyles } from '../src/citation/citation.styles.js';
import { contextPickerRecipe } from '../src/context-picker/context-picker.recipe.js';
import { contextPickerRecipeStyles } from '../src/context-picker/context-picker.recipe.styles.js';
import { contextPickerStyles } from '../src/context-picker/context-picker.styles.js';
import { conversationRecipe } from '../src/conversation/conversation.recipe.js';
import { conversationRecipeStyles } from '../src/conversation/conversation.recipe.styles.js';
import { conversationStyles } from '../src/conversation/conversation.styles.js';
import { inlineAssistRecipe } from '../src/inline-assist/inline-assist.recipe.js';
import { inlineAssistRecipeStyles } from '../src/inline-assist/inline-assist.recipe.styles.js';
import { inlineAssistStyles } from '../src/inline-assist/inline-assist.styles.js';
import { aiElementRecipe } from '../src/internal/ai-element.recipe.js';
import { aiElementRecipeStyles } from '../src/internal/ai-element.recipe.styles.js';
import { aiElementStyles } from '../src/internal/base.styles.js';
import { messageRecipe } from '../src/message/message.recipe.js';
import { messageRecipeStyles } from '../src/message/message.recipe.styles.js';
import { messageStyles } from '../src/message/message.styles.js';
import { promptInputRecipe } from '../src/prompt-input/prompt-input.recipe.js';
import { promptInputRecipeStyles } from '../src/prompt-input/prompt-input.recipe.styles.js';
import { promptInputStyles } from '../src/prompt-input/prompt-input.styles.js';
import { questionRecipe } from '../src/question/question.recipe.js';
import { questionRecipeStyles } from '../src/question/question.recipe.styles.js';
import { questionStyles } from '../src/question/question.styles.js';
import { responseFeedbackRecipe } from '../src/response-feedback/response-feedback.recipe.js';
import { responseFeedbackRecipeStyles } from '../src/response-feedback/response-feedback.recipe.styles.js';
import { responseFeedbackStyles } from '../src/response-feedback/response-feedback.styles.js';
import { sourcesRecipe } from '../src/sources/sources.recipe.js';
import { sourcesRecipeStyles } from '../src/sources/sources.recipe.styles.js';
import { sourcesStyles } from '../src/sources/sources.styles.js';
import { suggestionsRecipe } from '../src/suggestions/suggestions.recipe.js';
import { suggestionsRecipeStyles } from '../src/suggestions/suggestions.recipe.styles.js';
import { suggestionsStyles } from '../src/suggestions/suggestions.styles.js';
import { taskPlanRecipe } from '../src/task-plan/task-plan.recipe.js';
import { taskPlanRecipeStyles } from '../src/task-plan/task-plan.recipe.styles.js';
import { taskPlanStyles } from '../src/task-plan/task-plan.styles.js';
import { toolCallRecipe } from '../src/tool-call/tool-call.recipe.js';
import { toolCallRecipeStyles } from '../src/tool-call/tool-call.recipe.styles.js';
import { toolCallStyles } from '../src/tool-call/tool-call.styles.js';
import { transcriptRecipe } from '../src/transcript/transcript.recipe.js';
import { transcriptRecipeStyles } from '../src/transcript/transcript.recipe.styles.js';
import { transcriptStyles } from '../src/transcript/transcript.styles.js';
import { usageMeterRecipe } from '../src/usage-meter/usage-meter.recipe.js';
import { usageMeterRecipeStyles } from '../src/usage-meter/usage-meter.recipe.styles.js';
import { usageMeterStyles } from '../src/usage-meter/usage-meter.styles.js';
import { voiceInputRecipe } from '../src/voice-input/voice-input.recipe.js';
import { voiceInputRecipeStyles } from '../src/voice-input/voice-input.recipe.styles.js';
import { voiceInputStyles } from '../src/voice-input/voice-input.styles.js';

// Layout in shadow roots (layout-recipes.md §14), extracted at build time as in
// packages/components/test/recipes.test.ts: each element's sheet opens with its recipe's CSS as a
// precompiled module, so no registration loads the recipe engine. UPDATE_FIXTURES=1 regenerates.
const extracted: readonly (readonly [string, LayoutRecipe, CSSResult, CSSResult])[] = [
  [
    'action-approval/action-approval',
    actionApprovalRecipe,
    actionApprovalRecipeStyles,
    actionApprovalStyles,
  ],
  ['activity/activity', activityRecipe, activityRecipeStyles, activityStyles],
  ['artifact/artifact', artifactRecipe, artifactRecipeStyles, artifactStyles],
  ['change-review/change-review', changeReviewRecipe, changeReviewRecipeStyles, changeReviewStyles],
  ['checkpoint/checkpoint', checkpointRecipe, checkpointRecipeStyles, checkpointStyles],
  ['citation/citation', citationRecipe, citationRecipeStyles, citationStyles],
  [
    'context-picker/context-picker',
    contextPickerRecipe,
    contextPickerRecipeStyles,
    contextPickerStyles,
  ],
  ['conversation/conversation', conversationRecipe, conversationRecipeStyles, conversationStyles],
  ['inline-assist/inline-assist', inlineAssistRecipe, inlineAssistRecipeStyles, inlineAssistStyles],
  ['internal/ai-element', aiElementRecipe, aiElementRecipeStyles, aiElementStyles],
  ['message/message', messageRecipe, messageRecipeStyles, messageStyles],
  ['prompt-input/prompt-input', promptInputRecipe, promptInputRecipeStyles, promptInputStyles],
  ['question/question', questionRecipe, questionRecipeStyles, questionStyles],
  [
    'response-feedback/response-feedback',
    responseFeedbackRecipe,
    responseFeedbackRecipeStyles,
    responseFeedbackStyles,
  ],
  ['sources/sources', sourcesRecipe, sourcesRecipeStyles, sourcesStyles],
  ['suggestions/suggestions', suggestionsRecipe, suggestionsRecipeStyles, suggestionsStyles],
  ['task-plan/task-plan', taskPlanRecipe, taskPlanRecipeStyles, taskPlanStyles],
  ['tool-call/tool-call', toolCallRecipe, toolCallRecipeStyles, toolCallStyles],
  ['transcript/transcript', transcriptRecipe, transcriptRecipeStyles, transcriptStyles],
  ['usage-meter/usage-meter', usageMeterRecipe, usageMeterRecipeStyles, usageMeterStyles],
  ['voice-input/voice-input', voiceInputRecipe, voiceInputRecipeStyles, voiceInputStyles],
];

const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
// The layer order statement only matters beside variant or condition layers; without them it is
// left out (41 B gzip of the ai-chat bundle for the first eight elements).
const extract = (text: string) =>
  /odd\.layout\.(variant|condition) \{/.test(text) ? text : text.replace(/^@layer [^;{]+;\n/, '');
// Single-quoted with escapes, so the generated module is already in Prettier's format.
const literal = (text: string) =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

describe('extracted recipe styles', () => {
  for (const [path, recipe, styles, sheet] of extracted) {
    const name = path.split('/')[1]!;
    const exportName = `${camel(name)}RecipeStyles`;
    it(`${exportName} matches ./${name}.recipe.ts and opens the element's sheet`, async () => {
      const url = new URL(`../src/${path}.recipe.styles.ts`, import.meta.url);
      const expected =
        `// Generated from ./${name}.recipe.ts by packages/ai/test/recipes.test.ts (UPDATE_FIXTURES=1).\n` +
        `// Do not edit: change the recipe and regenerate.\n` +
        `import { unsafeCSS } from '@oddkin/core/styles';\n\n` +
        `export const ${exportName} = unsafeCSS(\n  ${literal(extract(recipe.cssText))},\n);\n`;
      if (process.env['UPDATE_FIXTURES']) await writeFile(url, expected);
      expect(await readFile(url, 'utf8')).toBe(expected);
      expect(styles.cssText).toBe(extract(recipe.cssText));
      expect(sheet.cssText.trimStart().startsWith(styles.cssText)).toBe(true);
    });
  }
});
