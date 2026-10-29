import { describe, expect, it } from 'vitest';
import {
  FRAME_PROTOCOL,
  FRAME_PROTOCOL_VERSION,
  isCompatibleFrameMessage,
  isFrameHello,
  isFrameMessage,
  isFrameReply,
  isFrameRequest,
  isJsonValue,
} from '../src/protocol/index.js';

const identity = {
  protocol: FRAME_PROTOCOL,
  version: FRAME_PROTOCOL_VERSION,
  frame: 'preview-1',
  generation: 1,
};

describe('frame protocol', () => {
  it('accepts plain JSON values and rejects values that need coercion', () => {
    expect(isJsonValue({ example: ['primary', null, 3, false] })).toBe(true);
    expect(isJsonValue(Object.assign(Object.create(null), { value: 'ok' }))).toBe(true);
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(new Date())).toBe(false);
    expect(isJsonValue({ value: undefined })).toBe(false);
    expect(isJsonValue({ value: () => {} })).toBe(false);
    expect(isJsonValue(1n)).toBe(false);

    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;
    expect(isJsonValue(cycle)).toBe(false);
    const shared = { value: 1 };
    expect(isJsonValue([shared, shared])).toBe(true);
    expect(isJsonValue([, 'sparse'])).toBe(false);
    expect(
      isJsonValue(Object.defineProperty({}, 'value', { get: () => 1, enumerable: true })),
    ).toBe(false);
  });

  it('validates handshakes, commands, replies, and protocol compatibility', () => {
    const hello = { ...identity, kind: 'hello' };
    expect(isFrameMessage(hello)).toBe(true);
    expect(isFrameHello(hello)).toBe(true);
    expect(isCompatibleFrameMessage({ ...hello, version: 2 })).toBe(false);

    const request = {
      ...identity,
      kind: 'mount',
      id: 1,
      payload: {
        tag: 'odd-button',
        registration: '@oddkin/components/define/button',
        example: 'example:odd-button/primary',
        properties: { label: 'Save' },
      },
    };
    expect(isFrameRequest(request)).toBe(true);
    expect(isFrameRequest({ ...request, id: 0 })).toBe(false);
    expect(isFrameRequest({ ...request, payload: { element: new Date() } })).toBe(false);
    // Declared sync pairs: property and event names only.
    const sync = (value: unknown) =>
      isFrameRequest({ ...request, payload: { ...request.payload, sync: value } });
    expect(sync([{ property: 'value', event: 'input' }])).toBe(true);
    expect(sync([{ property: 'value' }])).toBe(false);
    expect(sync([{ property: 'value', event: 1 }])).toBe(false);
    expect(sync({ property: 'value', event: 'input' })).toBe(false);
    expect(isFrameRequest({ ...request, payload: { ...request.payload, events: [1] } })).toBe(
      false,
    );
    // The example module whose fixture the frame runs: a URL.
    const fixture = (value: unknown) =>
      isFrameRequest({ ...request, payload: { ...request.payload, fixture: value } });
    expect(fixture('/_oddkin/examples/odd-button.js')).toBe(true);
    expect(fixture({ url: '/_oddkin/examples/odd-button.js' })).toBe(false);

    const reply = { ...identity, kind: 'reply', replyTo: 1, payload: { mounted: true } };
    expect(isFrameReply(reply)).toBe(true);
    expect(isFrameReply({ ...reply, error: { code: 'failed', message: 'no' } })).toBe(false);
    expect(isFrameMessage({ ...identity, kind: 'hello', generation: 0 })).toBe(false);
  });

  it('accepts CSS custom properties by name only, on mount and one at a time', () => {
    const mount = (styles: unknown) =>
      isFrameRequest({
        ...identity,
        kind: 'mount',
        id: 1,
        payload: {
          tag: 'odd-button',
          registration: '@oddkin/components/define/button',
          example: 'example:odd-button/primary',
          styles,
        },
      });
    expect(mount({ '--odd-button-background': 'rebeccapurple' })).toBe(true);
    expect(mount({})).toBe(true);
    expect(mount({ background: 'red' })).toBe(false);
    expect(mount({ '--odd-button-background': 1 })).toBe(false);
    expect(mount(['--odd-button-background'])).toBe(false);

    const set = (payload: unknown) => isFrameRequest({ ...identity, kind: 'set', id: 2, payload });
    expect(set({ cssProperty: '--odd-button-background', cssValue: 'red' })).toBe(true);
    expect(set({ cssProperty: '--odd-button-background', cssValue: null })).toBe(true);
    expect(set({ cssProperty: 'background', cssValue: 'red' })).toBe(false);
    expect(set({ cssProperty: '--', cssValue: 'red' })).toBe(false);
    expect(set({ cssProperty: '--a: red; --b', cssValue: 'red' })).toBe(false);
    expect(set({ cssProperty: '--odd-button-background' })).toBe(false);
    expect(set({ cssProperty: '--odd-button-background', cssValue: 1 })).toBe(false);
    // One write per request: a CSS property, a property, or an attribute.
    expect(set({ cssProperty: '--a', cssValue: 'red', property: 'label', value: 'Go' })).toBe(
      false,
    );
    expect(set({ cssProperty: '--a', cssValue: 'red', attribute: 'id', attributeValue: 'a' })).toBe(
      false,
    );
  });

  it('validates inspectPreview request limits and stable ids without executing previews', () => {
    const inspect = {
      ...identity,
      kind: 'inspect',
      id: 1,
      payload: {
        example: 'example:odd-button/primary',
        interactions: [
          { id: 'event:odd-button#odd-activate', event: 'odd-activate', target: 'button' },
        ],
        limits: { errors: 2, events: 5, state: 3, checks: 1 },
      },
    };
    expect(isFrameRequest(inspect)).toBe(true);
    expect(
      isFrameRequest({
        ...inspect,
        payload: { ...inspect.payload, interactions: [{ id: 'event:missing', event: 'click' }] },
      }),
    ).toBe(false);
    expect(
      isFrameRequest({ ...inspect, payload: { ...inspect.payload, limits: { events: -1 } } }),
    ).toBe(false);
  });
});
