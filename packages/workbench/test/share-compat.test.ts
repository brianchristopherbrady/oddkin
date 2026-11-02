import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchData,
  type ComponentPageData,
  type LibraryInput,
} from '../src/data/index.js';
import type { CemPackage, OddkinMetadataLike } from '../src/pages/index.js';
import { decodeShare, encodeShare, SHARE_PARAM, type SharePayload } from '../src/panels/model.js';

// A share link the published Workbench 1.0.0-beta.1 made (fixtures/share-1.0.0-beta.1.json, recorded
// by scripts/workbench-share-fixture.mjs), opened by this Workbench under release-process.md §1:
// a later Workbench opens a share-payload.v1 link, dropping with a note each name the component no
// longer declares, and refuses a link of another version.

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const recorded = json('./fixtures/share-1.0.0-beta.1.json') as {
  link: string;
  payload: SharePayload;
};
const encoded = new URL(recorded.link).searchParams.get(SHARE_PARAM)!;
const components: LibraryInput = {
  name: '@oddkin/components',
  version: '0.0.0',
  cem: json('../../components/custom-elements.json') as CemPackage,
  metadata: json('../../components/oddkin.metadata.json') as OddkinMetadataLike,
};
const { data } = buildWorkbenchData({
  config: { library: { packages: ['@oddkin/components'] } },
  libraries: [components],
});
const button = data!.pages['components/odd-button'] as ComponentPageData;

describe('a share link from the published Workbench 1.0.0-beta.1', () => {
  it('opens in this Workbench with every name it carries', () => {
    expect(recorded.payload).toMatchObject({ v: 1, kind: 'component', component: 'odd-button' });
    const { state, preview, problems } = decodeShare(button, encoded);
    expect(problems).toEqual([]);
    expect(state).toEqual({
      preset: 'default',
      attributes: { appearance: 'ghost' },
      properties: {},
      slots: { '': 'Publish' },
      styles: { '--odd-button-background': 'rgb(1, 2, 3)' },
    });
    expect(preview).toEqual({ mode: 'dark', direction: 'rtl', width: 360 });
  });

  it('drops, with a note, a name the component no longer declares', () => {
    const declaration = button.declaration as {
      attributes?: { name: string }[];
      members?: { name: string }[];
    };
    const later: ComponentPageData = {
      ...button,
      declaration: {
        ...button.declaration,
        attributes: (declaration.attributes ?? []).filter((a) => a.name !== 'appearance'),
        members: (declaration.members ?? []).filter((m) => m.name !== 'appearance'),
      } as ComponentPageData['declaration'],
    };
    const { state, problems } = decodeShare(later, encoded);
    expect(problems).toEqual(['Ignored attribute "appearance".']);
    expect(state?.attributes).toEqual({});
    expect(state?.slots).toEqual({ '': 'Publish' });
  });

  it('refuses a link of another version', () => {
    const next = encodeShare({ ...recorded.payload, v: 2 } as unknown as SharePayload);
    expect(decodeShare(button, next)).toEqual({
      problems: ['The preview link uses an unsupported version.'],
    });
  });
});
