# Empty conversation

## The problem

A new conversation is an empty column and a text box. Without a word about what the assistant can do, people guess or leave. The conversation's `empty` slot is the place to say it, with a few prompts to start from.

## Elements and recipes

- `odd-conversation` (`@oddkin/ai`): its `empty` slot shows while there are no messages.
- `odd-empty-state` (`@oddkin/components`): a title, one sentence, and the next steps in its `footer`.
- The [Suggested prompts](../suggested-prompts/README.md) pattern: the buttons in the footer.
- `odd-prompt-input` (`@oddkin/ai`) in the conversation's `composer` slot.

## Example

[example.html](example.html): the empty state in the `empty` slot, with three suggestions that fill the composer. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- The empty state's title and sentence are text in reading order, before the composer; the sentence says what the assistant does with the person's documents and what it does not do.
- The suggestions are a group named "Suggested prompts"; each fills the composer and focuses it.
- When the first message arrives the conversation hides the slot; focus stays in the composer.

## Responsive behaviour

The empty state centres in the conversation's width, and the suggestions wrap.

## States

- **Loading history:** the conversation shows its own loading line; keep the empty state for a conversation that has none.
- **Error:** when history fails, the conversation offers Retry; the empty state does not change.

## When to use it

Use it for every new conversation. For a page with no conversation at all, use `odd-empty-state` alone.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, that the empty state shows with no messages, its title and group names, that a suggestion fills the composer, and that the slot hides once a message arrives.
