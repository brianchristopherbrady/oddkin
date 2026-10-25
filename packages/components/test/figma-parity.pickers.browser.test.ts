import { describe, it } from 'vitest';
import type { OddkinFileInput } from '../src/file-input/file-input.js';
import {
  compare,
  expectNone,
  mount,
  settle,
  shadowPart,
  transitions,
  useParity,
  type Target,
} from './parity.js';

// Figma parity of the pickers: the file input (component-contracts.md §3.3).
useParity();

describe('Figma parity: odd-file-input (fileUpload)', () => {
  const description = 'PDF, PNG, JPG · Maximum 10 MB';
  for (const state of ['Empty', 'Error', 'Uploaded'] as const)
    it(state, async () => {
      const error = state === 'Error' ? ' error="File is too large"' : '';
      const el = mount(
        `<odd-file-input label="Project attachments" description="${description}"${error}></odd-file-input>`,
      ) as OddkinFileInput;
      await settle(el);
      if (state === 'Uploaded') {
        const input = el.shadowRoot!.querySelector('input')!;
        const data = new DataTransfer();
        data.items.add(new File([new Uint8Array(2_400_000)], 'component-guidelines.pdf'));
        input.files = data.files;
        input.dispatchEvent(new Event('change'));
        await settle(el);
      }
      const frame = `File upload / ${state}`;
      const part = (name: string) => shadowPart(el, name);
      const header = el.shadowRoot!.querySelector<HTMLElement>('.header')!;
      const targets: Target[] = [
        { layer: [frame, 'Project attachments'], el: part('label'), kind: 'text' },
        { layer: [frame, 'Surface'], el: part('surface'), kind: 'frame' },
      ];
      if (state === 'Uploaded') {
        const row = part('file');
        targets.push(
          { layer: [frame, 'Surface', 'Header'], el: row, kind: 'frame', gap: 'column-gap' },
          {
            layer: [frame, 'Surface', 'Header', 'component-guidelines.pdf'],
            el: row.querySelector('.file-name')!,
            kind: 'text',
          },
          {
            layer: [frame, 'Surface', '2.4 MB · Upload complete'],
            el: row.querySelector('.file-size')!,
            kind: 'text',
          },
        );
      } else {
        const title = state === 'Error' ? 'File is too large' : 'Choose a file or drop it here';
        targets.push(
          { layer: [frame, 'Surface', 'Header'], el: header, kind: 'frame', gap: 'column-gap' },
          {
            layer: [frame, 'Surface', 'Header', title],
            el: part(state === 'Error' ? 'error' : 'title'),
            kind: 'text',
          },
          { layer: [frame, 'Surface', description], el: part('description'), kind: 'text' },
        );
      }
      await transitions(targets);
      expectNone(compare('Oddkin/Common/fileUpload', { State: state }, targets));
    });
});
