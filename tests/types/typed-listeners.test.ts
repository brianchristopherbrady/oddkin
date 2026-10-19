import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {} from '@oddkin/ai/define/conversation';
import type {} from '@oddkin/ai/define/prompt-input';
import type {} from '@oddkin/components/define/input';
import type {} from '@oddkin/components/define/side-nav';

// Listeners are typed from each element's own `static events` (`_events`), so AI events need no
// entries in the global event map, where their unprefixed names would collide.

const root = fileURLToPath(new URL('../..', import.meta.url));
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : /^[\w-]+\.ts$/.test(entry.name) && !/\.(examples|define|definition)\.ts$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

describe('typed listeners', () => {
  it('every element with static events declares _events from them', () => {
    const checked: string[] = [];
    const missing: string[] = [];
    for (const dir of ['packages/components/src', 'packages/ai/src'])
      for (const file of sources(join(root, dir))) {
        const code = readFileSync(file, 'utf8');
        const element = /export class (\w+)[\s\S]*?static override events\s*=/.exec(code);
        if (!element) continue;
        checked.push(element[1]!);
        if (!code.includes(`declare readonly _events?: ElementEvents<typeof ${element[1]}>;`))
          missing.push(`${relative(root, file)}: ${element[1]}`);
      }
    expect(missing).toEqual([]);
    expect(checked.length).toBeGreaterThanOrEqual(23);
  });
});

// Compile-time (checked by `npm run typecheck`): every @ts-expect-error must be an error.
export function typedListeners(
  prompt: HTMLElementTagNameMap['odd-prompt-input'],
  conversation: HTMLElementTagNameMap['odd-conversation'],
  input: HTMLElementTagNameMap['odd-input'],
): void {
  prompt.addEventListener('prompt-submit', (event) => {
    const text: string = event.detail.text;
    void text;
    // @ts-expect-error -- the prompt-submit detail has no id
    void event.detail.id;
  });
  prompt.removeEventListener('prompt-stop', (event) => void event.detail);
  conversation.addEventListener('history-request', (event) => void event.detail);
  input.addEventListener('input', (event) => void event.composed);
  // @ts-expect-error -- a listener for another detail type is rejected
  conversation.addEventListener('history-request', (event: CustomEvent<string>) => void event);
  // @ts-expect-error -- AI events are not in the global map: a document listener gets a plain Event
  document.addEventListener('prompt-submit', (event) => void event.detail);
}
