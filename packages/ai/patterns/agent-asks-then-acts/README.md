# Agent asks, then acts

**New** with ADR 0049: a question and the action it shapes, in the conversation, in order.

## The problem

An agent often needs one answer before it can propose an action: where to post, which version to deploy, who should receive it. The question and the action belong in the conversation in the order they happened, each bound to its own record and revision, so the person sees what they answered next to what the agent then proposed, and neither can be mistaken for the other.

## Elements and recipes

- `odd-conversation` and `odd-message` (`@oddkin/ai`): the message keeps its parts in order and draws each request where the agent made it.
- `odd-question`, which `odd-message` draws for a `question` part: the question, its answers, and Answer and Skip, bound to the question's `revision`.
- `odd-action-approval`, which `odd-message` draws for an `approval` part: the action the answer shaped, with Approve and Reject, bound to the approval's `revision`.

## Example

[example.html](example.html): records the application owns (validated by `createConversationView`), with one assistant message whose parts are its text and a question. The page stands in for the backend: an answer moves the question to `answered` and adds, as the message's next part, the approval the answer shaped; a decision moves the approval to `approved` or `rejected`. With a `ConversationController`, the transport's `answer` and `decide` carry the same requests, and the stream's `question-request` and `approval-request` add the parts (ai-interaction.md §4.6). No composition document: the composition catalog does not name the AI elements.

## Interaction and accessibility

- Each request is a labelled group inside the message, in reading order: the question before the action it shaped.
- The question's answers are native form controls. Answer sends one answer per revision; Skip sends a skip, never an empty answer.
- Once answered, the question shows its outcome, and focus moves there from its button, which goes. Nothing moves focus to the new request: the person reaches it next with Tab.
- The approval works as in the pattern Approval outside a tool call: its scope, reason, keyboard path, and outcome.
- In a conversation, the conversation announces: its requests keep `announce` at `none`.

## Responsive behaviour

The message stacks its parts. Each request fits its container: below 480 px the approval is compact and its buttons stack.

## States

- **Asking:** the question is `requested`. With a controller, the attempt waits for the person (`awaiting-input`, its `wait` naming the question).
- **Answered:** the question shows its outcome, and the backend proposes the action.
- **Skipped:** the backend goes on without the answer, proposing nothing that needed it.
- **Deciding:** the approval is `requested`, and its decision goes to the host.
- **Withdrawn:** when the run ends before the person responds, its open requests become `cancelled` and offer nothing.

## When to use it

Use it when an answer changes the action the agent proposes. When the action is already known, ask for its approval directly (Approval outside a tool call, or a tool call's approval); when no action follows, the question alone is enough.

## Evidence

`packages/ai/test/patterns.browser.test.ts` checks, in Chromium, Firefox, and WebKit, that the question comes first in the message with no approval yet, that answering sends one answer bound to the question's revision, that the approval the answer shaped follows the question and names the chosen channel, and that approving sends one decision bound to the approval's revision.
