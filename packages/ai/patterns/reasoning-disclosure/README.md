# Reasoning disclosure

## The problem

Some models return their reasoning beside the answer. Most readers want the answer first; some want to check how it was reached. Showing the reasoning collapsed, under a clear name, serves both without pushing the answer down.

## Elements and recipes

- `odd-disclosure` (`@oddkin/components`): the native disclosure, named "Reasoning".
- `odd-response` (`@oddkin/ai`): the reasoning text, rendered as Markdown and streamed like an answer.

`odd-message` draws a reasoning part this way itself; use the pattern when you lay out a message yourself.

## Example

[example.html](example.html): a disclosure holding a response, and two lines that give the response its text. No composition document yet: version 1 of the composition catalog does not name the AI elements.

## Interaction and accessibility

- The summary is a native disclosure button named "Reasoning", with its expanded state from the platform; Enter or Space opens it.
- Closed, the reasoning is out of the reading order; find-in-page still opens it on a match.
- The reasoning streams like an answer and is not a live region: nothing is announced token by token.

## Responsive behaviour

The disclosure takes the width of the message; long lines in the reasoning wrap, and code blocks scroll inside it.

## States

- **Streaming:** set the response's `status` to `streaming` while the reasoning arrives; the disclosure stays as the person left it.
- **Empty:** without reasoning, leave the disclosure out.

## When to use it

Use it for content a reader may want but does not need to read: reasoning, a tool's raw output, the full prompt. For content everyone needs, show it; for switching between views, use `odd-tabs`.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, that the disclosure is named "Reasoning", starts closed with its text out of view, and opens to show the rendered reasoning.
