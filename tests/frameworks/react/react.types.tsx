// Compile-time test of the opt-in React 19 typings (tsconfig.jsx.json, part of `npm run typecheck`).
// Every @ts-expect-error must fail to compile; an unused one fails the typecheck.
import type {} from '@oddkin/components/frameworks/react';
import type {} from '@oddkin/ai/define/conversation';
import type {} from '@oddkin/ai/define/prompt-input';
import type {} from '@oddkin/components/define/input';
import type {} from '@oddkin/components/define/side-nav';
import type { NavigationItem } from '@oddkin/components/models';
import type { PromptSubmitDetail } from '@oddkin/ai/events';
import { useRef } from 'react';

declare const items: readonly NavigationItem[];

export function Shell() {
  const nav = useRef<HTMLElementTagNameMap['odd-side-nav']>(null);
  return (
    <>
      <odd-side-nav
        ref={nav}
        label="Primary"
        items={items}
        current="overview"
        renderLabel={(item) => item.label}
        className="nav"
        onodd-action={(event) => {
          const action: string = event.detail.action;
          void action;
        }}
        onodd-toggle={(event) => event.detail.expanded && event.preventDefault()}
      />
      <odd-input
        label="Name"
        name="name"
        required
        value="Ada"
        onInput={(event) => void event.currentTarget}
        onChange={(event) => void event.target}
      />
      <odd-prompt-input
        onprompt-submit={(event) => {
          const detail: PromptSubmitDetail = event.detail;
          void detail.text;
        }}
      />
      <odd-conversation onhistory-request={(event) => void event.detail} />

      {/* @ts-expect-error -- items is an array of entries, not a string */}
      <odd-side-nav items="[]" />
      {/* @ts-expect-error -- unknown property */}
      <odd-side-nav itemz={items} />
      {/* @ts-expect-error -- the action detail has no expanded */}
      <odd-side-nav onodd-action={(event) => event.detail.expanded} />
      {/* @ts-expect-error -- type is one of the declared input types */}
      <odd-input type="number" />
      {/* @ts-expect-error -- read-only getters are not props */}
      <odd-input form={null} />
      {/* @ts-expect-error -- the prompt-submit detail has no id */}
      <odd-prompt-input onprompt-submit={(event) => event.detail.id} />
    </>
  );
}
