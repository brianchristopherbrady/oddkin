// The site's llms.txt and the agent guides it links, generated from the published metadata.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { siteFacts } from './facts.mjs';
import { publicAiCategories, publicAiComponents } from './public-ai-components.mjs';

function siteLibrary(library, categories) {
  if (library.name !== '@oddkin/ai') return library;
  const { metadata } = library;
  const components = Object.fromEntries(
    Object.entries(metadata.components ?? {})
      .filter(([, component]) => publicAiComponents.has(component.tag))
      .map(([id, component]) => [
        id,
        { ...component, category: `category:${publicAiCategories[component.tag]}` },
      ]),
  );
  const recipes = Object.fromEntries(
    Object.entries(metadata.recipes ?? {}).filter(
      ([, recipe]) => recipe.name === 'ai-element' || publicAiComponents.has(`odd-${recipe.name}`),
    ),
  );
  return { ...library, metadata: { ...metadata, components, recipes, categories } };
}

export async function writeLlms(root, out, base) {
  const {
    generateKit,
    kitDirName,
    llmsText,
    packageKit,
    resolveProjectContext,
    siteLlmsText,
    writeKit,
  } = await import(pathToFileURL(join(root, 'packages/analyzer/dist/kit/index.js')).href);
  const { description } = await siteFacts(root);
  const project = resolveProjectContext(root);
  for (const { severity, code, message } of project.diagnostics) {
    console.error(`${severity} ${code}: ${message}`);
  }
  const categories = project.libraries.find(({ name }) => name === '@oddkin/components')?.metadata
    .categories;
  const siteProject = {
    ...project,
    libraries: project.libraries.map((library) => siteLibrary(library, categories)),
  };
  const kits = [];
  for (const library of siteProject.libraries.filter((entry) => entry.owned)) {
    const isAi = library.name === '@oddkin/ai';
    // The complete AI patterns reference documents components outside the site's selection.
    const { files, manifest } = isAi
      ? generateKit(siteProject, library.name, { packaged: true })
      : await packageKit(siteProject, library);
    if (isAi) {
      const guide = files
        .get('GUIDE.md')
        .replace(
          /Generated from this package's published metadata[^\n]+/,
          'This website guide covers the published component reference pages for this package. The installed package provides the full agent kit.',
        );
      files.set('GUIDE.md', guide);
      manifest.guide.bytes = Buffer.byteLength(guide);
      manifest.packaging = ['llms-txt'];
      files.set('kit.json', `${JSON.stringify(manifest, null, 2)}\n`);
      files.set(
        'llms.txt',
        llmsText(library, manifest).replace(
          'The agent kit for this installed version, generated from its published metadata.',
          'The website agent guide for the AI components documented here.',
        ),
      );
    }
    const path = `agent/${kitDirName(library.name)}/`;
    writeKit(join(out, path), files);
    kits.push({ library, manifest, url: new URL(path, base).href });
  }
  writeFileSync(
    join(out, 'llms.txt'),
    siteLlmsText({ title: 'Oddkin', summary: description, kits }).replace(
      'The same kit ships in the package, in `node_modules/<package>/agent/`.',
      'Installed packages ship their full kits in `node_modules/<package>/agent/`.',
    ),
  );
}
