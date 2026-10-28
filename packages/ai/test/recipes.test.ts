import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { LayoutRecipe } from '@oddkin/components/layout';
import type { CSSResult } from '@oddkin/core/styles';
import { activityRecipe } from '../src/activity/activity.recipe.js';
import { activityRecipeStyles } from '../src/activity/activity.recipe.styles.js';
import { activityStyles } from '../src/activity/activity.styles.js';
import { artifactRecipe } from '../src/artifact/artifact.recipe.js';
import { artifactRecipeStyles } from '../src/artifact/artifact.recipe.styles.js';
import { artifactStyles } from '../src/artifact/artifact.styles.js';
import { citationRecipe } from '../src/citation/citation.recipe.js';
import { citationRecipeStyles } from '../src/citation/citation.recipe.styles.js';
import { citationStyles } from '../src/citation/citation.styles.js';
import { conversationRecipe } from '../src/conversation/conversation.recipe.js';
import { conversationRecipeStyles } from '../src/conversation/conversation.recipe.styles.js';
import { conversationStyles } from '../src/conversation/conversation.styles.js';
import { messageRecipe } from '../src/message/message.recipe.js';
import { messageRecipeStyles } from '../src/message/message.recipe.styles.js';
import { messageStyles } from '../src/message/message.styles.js';
import { sourcesRecipe } from '../src/sources/sources.recipe.js';
import { sourcesRecipeStyles } from '../src/sources/sources.recipe.styles.js';
import { sourcesStyles } from '../src/sources/sources.styles.js';
import { suggestionsRecipe } from '../src/suggestions/suggestions.recipe.js';
import { suggestionsRecipeStyles } from '../src/suggestions/suggestions.recipe.styles.js';
import { suggestionsStyles } from '../src/suggestions/suggestions.styles.js';
import { transcriptRecipe } from '../src/transcript/transcript.recipe.js';
import { transcriptRecipeStyles } from '../src/transcript/transcript.recipe.styles.js';
import { transcriptStyles } from '../src/transcript/transcript.styles.js';

// Layout in shadow roots (layout-recipes.md §14), extracted at build time as in
// packages/components/test/recipes.test.ts: each element's sheet opens with its recipe's CSS as a
// precompiled module, so no registration loads the recipe engine. UPDATE_FIXTURES=1 regenerates.
const extracted: readonly (readonly [string, LayoutRecipe, CSSResult, CSSResult])[] = [
  ['activity', activityRecipe, activityRecipeStyles, activityStyles],
  ['artifact', artifactRecipe, artifactRecipeStyles, artifactStyles],
  ['citation', citationRecipe, citationRecipeStyles, citationStyles],
  ['conversation', conversationRecipe, conversationRecipeStyles, conversationStyles],
  ['message', messageRecipe, messageRecipeStyles, messageStyles],
  ['sources', sourcesRecipe, sourcesRecipeStyles, sourcesStyles],
  ['suggestions', suggestionsRecipe, suggestionsRecipeStyles, suggestionsStyles],
  ['transcript', transcriptRecipe, transcriptRecipeStyles, transcriptStyles],
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
  for (const [name, recipe, styles, sheet] of extracted) {
    const exportName = `${camel(name)}RecipeStyles`;
    it(`${exportName} matches ./${name}.recipe.ts and opens the element's sheet`, async () => {
      const url = new URL(`../src/${name}/${name}.recipe.styles.ts`, import.meta.url);
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
