// Authored content for the docs site's reference pages (docs-content.v1): the titles a tag name
// cannot spell, and the sections the docs' component pages leave out (Figma 20:2190 has no token
// inventory or usage cards). Workbench reads this file from the configuration's folder.
import { readFileSync } from 'node:fs';
import { defineDocs } from '@oddkin/workbench/config';

const tags = ['components', 'ai'].flatMap((name) => {
  const file = new URL(`../../packages/${name}/oddkin.metadata.json`, import.meta.url);
  const metadata = JSON.parse(readFileSync(file, 'utf8')) as {
    components: Record<string, { tag: string }>;
  };
  return Object.values(metadata.components).map((component) => component.tag);
});

const titles: Record<string, string> = {
  'odd-ai-label': 'AI label',
  'odd-one-time-code': 'One-time code',
};

export default defineDocs({
  pages: Object.fromEntries(
    tags.map((tag) => [
      `components/${tag}`,
      {
        ...(titles[tag] ? { title: titles[tag] } : {}),
        sections: { tokens: { visible: false }, guidance: { visible: false } },
      },
    ]),
  ),
});
