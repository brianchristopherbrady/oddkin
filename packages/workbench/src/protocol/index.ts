/** DOM-free message contracts shared by the Workbench host and preview frames. */
export const FRAME_PROTOCOL = 'oddkin.frame';
export const FRAME_PROTOCOL_VERSION = 1;

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type ExampleId = `example:${string}/${string}`;
export type EventId = `event:${string}#${string}`;
export type PropertyId = `property:${string}#${string}`;

export interface FrameIdentity {
  readonly frame: string;
  readonly generation: number;
}

export interface FrameSettings {
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly container?: { readonly width: number; readonly height?: number };
  readonly direction?: 'ltr' | 'rtl';
  readonly mode?: 'light' | 'dark';
  readonly density?: string;
  readonly product?: string;
  readonly profile?: string;
}

export interface FrameMountPayload {
  readonly tag: string;
  readonly registration: string;
  readonly example: ExampleId;
  readonly properties?: Readonly<Record<string, JsonValue>>;
  readonly attributes?: Readonly<Record<string, string | null>>;
  readonly slots?: Readonly<Record<string, string>>;
  readonly events?: readonly string[];
  /**
   * Declared property ↔ event sync pairs (metadata `syncPairs`). After such an event the frame
   * reports the property's value in a `state` notification (`{ property, value }`); nothing is
   * inferred from event names.
   */
  readonly sync?: readonly { readonly property: string; readonly event: string }[];
  /** CSS custom property values set on the element (`style.setProperty`); names start with `--`. */
  readonly styles?: Readonly<Record<string, string>>;
  /**
   * URL of the example module (a `defineExamples` default export) whose fixture for `example`
   * runs after the element is connected, as `mountExample` runs it in tests.
   */
  readonly fixture?: string;
  readonly settings?: FrameSettings;
}

/**
 * One write: a property (a value, or `unset`), an attribute (a string, or `null` to remove it), or
 * a CSS custom property on the element's style (a value, or `null` to remove it).
 */
export interface FrameSetPayload {
  readonly property?: string;
  readonly value?: JsonValue;
  readonly unset?: boolean;
  readonly attribute?: string;
  readonly attributeValue?: string | null;
  readonly cssProperty?: string;
  readonly cssValue?: string | null;
}

export interface FrameSlotPayload {
  readonly name: string;
  readonly text: string;
}

/** One element per preview role, mounted together (Theme Studio specimens). */
export interface FrameSpecimenItem extends FrameMountPayload {
  /** The preview role this element plays, e.g. `primaryAction`. */
  readonly role: string;
  /** Visible caption naming the role. */
  readonly label: string;
}

export interface FrameSpecimenPayload {
  readonly items: readonly FrameSpecimenItem[];
  readonly settings?: FrameSettings;
}

export interface FrameThemePayload {
  readonly cssText: string;
}

export interface InspectPreviewRequest {
  /** Stable example id, e.g. `example:odd-button/primary`. */
  readonly example: ExampleId;
  readonly settings?: FrameSettings;
  readonly properties?: Readonly<Record<string, JsonValue>>;
  readonly slots?: Readonly<Record<string, string>>;
  readonly interactions?: readonly {
    readonly id: EventId;
    readonly event: string;
    readonly target?: string;
  }[];
  readonly limits?: {
    readonly errors?: number;
    readonly events?: number;
    readonly state?: number;
    readonly checks?: number;
  };
}

export interface InspectPreviewResponse {
  readonly errors: readonly {
    readonly id: EventId;
    readonly phase: string;
    readonly message: string;
  }[];
  readonly events: readonly {
    readonly id: EventId;
    readonly name: string;
    readonly time: number;
    readonly bubbles: boolean;
    readonly composed: boolean;
    readonly cancelable: boolean;
    readonly detail?: JsonValue;
  }[];
  readonly state: readonly { readonly id: PropertyId; readonly value: JsonValue }[];
  readonly checks: readonly {
    readonly id: string;
    readonly status: 'pass' | 'fail' | 'skip';
    readonly engine: string;
    readonly version: string;
    readonly configuration: JsonValue;
    readonly verification: string;
  }[];
  readonly conditions: JsonValue;
  readonly engine: string;
  readonly version: string;
  readonly configuration: JsonValue;
  readonly truncated: {
    readonly errors: boolean;
    readonly events: boolean;
    readonly state: boolean;
    readonly checks: boolean;
  };
}

interface Envelope extends FrameIdentity {
  readonly protocol: typeof FRAME_PROTOCOL;
  readonly version: number;
}

export interface FrameHello extends Envelope {
  readonly kind: 'hello';
}

export interface FrameConnect extends Envelope {
  readonly kind: 'connect';
}

export type FrameRequest =
  | (Envelope & {
      readonly kind: 'mount';
      readonly id: number;
      readonly payload: FrameMountPayload;
    })
  | (Envelope & {
      readonly kind: 'specimen';
      readonly id: number;
      readonly payload: FrameSpecimenPayload;
    })
  | (Envelope & { readonly kind: 'set'; readonly id: number; readonly payload: FrameSetPayload })
  | (Envelope & { readonly kind: 'slot'; readonly id: number; readonly payload: FrameSlotPayload })
  | (Envelope & { readonly kind: 'reset'; readonly id: number })
  | (Envelope & { readonly kind: 'dispose'; readonly id: number })
  | (Envelope & {
      readonly kind: 'theme';
      readonly id: number;
      readonly payload: FrameThemePayload;
    })
  | (Envelope & { readonly kind: 'settings'; readonly id: number; readonly payload: FrameSettings })
  | (Envelope & {
      readonly kind: 'inspect';
      readonly id: number;
      readonly payload: InspectPreviewRequest;
    });

export interface FrameReply extends Envelope {
  readonly kind: 'reply';
  readonly replyTo: number;
  readonly payload?: JsonValue;
  readonly error?: { readonly code: string; readonly message: string };
}

export interface FrameNotification extends Envelope {
  readonly kind: 'event' | 'error' | 'state' | 'size';
  readonly payload?: JsonValue;
}

export type FrameRequestPayload = Extract<FrameRequest, { readonly payload: unknown }>['payload'];

export type FrameMessage =
  FrameHello | FrameConnect | FrameRequest | FrameReply | FrameNotification;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** True only for finite, acyclic data that can be transferred as plain JSON without coercion. */
export function isJsonValue(value: unknown): value is JsonValue {
  const active = new WeakSet<object>();
  const stack: { value: unknown; exit: boolean }[] = [{ value, exit: false }];
  while (stack.length) {
    const item = stack.pop()!;
    const current = item.value;
    if (
      current === null ||
      typeof current === 'string' ||
      typeof current === 'boolean' ||
      (typeof current === 'number' && Number.isFinite(current))
    )
      continue;
    if (typeof current !== 'object') return false;
    if (item.exit) {
      active.delete(current);
      continue;
    }
    if (active.has(current)) return false;
    const array = Array.isArray(current);
    if (array ? Object.getPrototypeOf(current) !== Array.prototype : !isRecord(current))
      return false;
    if (!array) {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return false;
    }
    active.add(current);
    stack.push({ value: current, exit: true });
    const keys = Reflect.ownKeys(current);
    if (array) {
      const list = current as unknown[];
      if (keys.length !== list.length + 1 || !keys.includes('length')) return false;
      for (let i = 0; i < list.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(list, String(i));
        if (!descriptor?.enumerable || !('value' in descriptor)) return false;
        stack.push({ value: descriptor.value, exit: false });
      }
      continue;
    }
    for (const key of keys) {
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor?.enumerable || !('value' in descriptor)) return false;
      stack.push({ value: descriptor.value, exit: false });
    }
  }
  return true;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
/** A CSS custom property name: `--` and at least one more character, no spaces or colons. */
export const isCustomPropertyName = (value: unknown): value is string =>
  typeof value === 'string' && /^--[^\s:;{}]+$/.test(value);
export const isExampleId = (value: unknown): value is ExampleId =>
  typeof value === 'string' && /^example:[^/]+\/[^/]+$/.test(value);
const isEventId = (value: unknown): value is EventId =>
  typeof value === 'string' && /^event:[^#]+#[^#]+$/.test(value);

function isFrameSettings(value: unknown): value is FrameSettings {
  if (!isRecord(value)) return false;
  if (
    value['direction'] !== undefined &&
    value['direction'] !== 'ltr' &&
    value['direction'] !== 'rtl'
  )
    return false;
  if (value['mode'] !== undefined && value['mode'] !== 'light' && value['mode'] !== 'dark')
    return false;
  for (const key of ['density', 'product', 'profile'])
    if (value[key] !== undefined && typeof value[key] !== 'string') return false;
  for (const key of ['viewport', 'container']) {
    const size = value[key];
    if (size === undefined) continue;
    if (
      !isRecord(size) ||
      typeof size['width'] !== 'number' ||
      !Number.isFinite(size['width']) ||
      size['width'] <= 0
    )
      return false;
    if (
      size['height'] !== undefined &&
      (typeof size['height'] !== 'number' ||
        !Number.isFinite(size['height']) ||
        size['height'] <= 0)
    )
      return false;
  }
  return true;
}

export function isFrameMountPayload(value: unknown): value is FrameMountPayload {
  if (
    !isRecord(value) ||
    typeof value['tag'] !== 'string' ||
    typeof value['registration'] !== 'string' ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(value['tag']) ||
    !isExampleId(value['example']) ||
    !value['example'].startsWith(`example:${value['tag']}/`)
  )
    return false;
  if (value['properties'] !== undefined && !isJsonValue(value['properties'])) return false;
  if (value['attributes'] !== undefined) {
    const attributes = value['attributes'];
    if (
      !isRecord(attributes) ||
      !Object.values(attributes).every((item) => item === null || typeof item === 'string')
    )
      return false;
  }
  if (value['slots'] !== undefined && !isStringRecord(value['slots'])) return false;
  if (value['fixture'] !== undefined && typeof value['fixture'] !== 'string') return false;
  if (
    value['styles'] !== undefined &&
    (!isStringRecord(value['styles']) || !Object.keys(value['styles']).every(isCustomPropertyName))
  )
    return false;
  if (
    value['events'] !== undefined &&
    (!Array.isArray(value['events']) || !value['events'].every((item) => typeof item === 'string'))
  )
    return false;
  if (
    value['sync'] !== undefined &&
    (!Array.isArray(value['sync']) ||
      !value['sync'].every(
        (pair) =>
          isRecord(pair) &&
          typeof pair['property'] === 'string' &&
          typeof pair['event'] === 'string',
      ))
  )
    return false;
  return value['settings'] === undefined || isFrameSettings(value['settings']);
}

export function isFrameSpecimenPayload(value: unknown): value is FrameSpecimenPayload {
  return (
    isRecord(value) &&
    Array.isArray(value['items']) &&
    value['items'].every(
      (item) =>
        isFrameMountPayload(item) &&
        typeof (item as unknown as Record<string, unknown>)['role'] === 'string' &&
        typeof (item as unknown as Record<string, unknown>)['label'] === 'string',
    ) &&
    (value['settings'] === undefined || isFrameSettings(value['settings']))
  );
}

/** Validates the common envelope and its JSON payload, without accepting a specific version. */
export function isFrameMessage(value: unknown): value is FrameMessage {
  if (!isRecord(value)) return false;
  if (
    value['protocol'] !== FRAME_PROTOCOL ||
    !Number.isSafeInteger(value['version']) ||
    typeof value['frame'] !== 'string' ||
    value['frame'].length === 0 ||
    !isPositiveInteger(value['generation']) ||
    typeof value['kind'] !== 'string'
  )
    return false;
  const hasPayload = Object.hasOwn(value, 'payload');
  if (hasPayload && !isJsonValue(value['payload'])) return false;
  switch (value['kind']) {
    case 'hello':
    case 'connect':
      return !Object.hasOwn(value, 'id') && !Object.hasOwn(value, 'replyTo');
    case 'mount':
    case 'specimen':
    case 'set':
    case 'slot':
    case 'reset':
    case 'theme':
    case 'settings':
    case 'dispose':
    case 'inspect':
      return isPositiveInteger(value['id']) && !Object.hasOwn(value, 'replyTo');
    case 'reply':
      return (
        isPositiveInteger(value['replyTo']) &&
        !(Object.hasOwn(value, 'payload') && Object.hasOwn(value, 'error')) &&
        (!Object.hasOwn(value, 'error') ||
          (isRecord(value['error']) &&
            typeof value['error']['code'] === 'string' &&
            typeof value['error']['message'] === 'string'))
      );
    case 'event':
    case 'error':
    case 'state':
    case 'size':
      return !Object.hasOwn(value, 'id') && !Object.hasOwn(value, 'replyTo');
    default:
      return false;
  }
}

export function isCompatibleFrameMessage(value: unknown): value is FrameMessage {
  return isFrameMessage(value) && value.version === FRAME_PROTOCOL_VERSION;
}

export const isFrameHello = (value: unknown): value is FrameHello =>
  isCompatibleFrameMessage(value) && value.kind === 'hello';

export function isInspectPreviewRequest(value: unknown): value is InspectPreviewRequest {
  if (!isRecord(value) || !isExampleId(value['example'])) return false;
  if (
    (value['settings'] !== undefined && !isFrameSettings(value['settings'])) ||
    (value['properties'] !== undefined && !isJsonValue(value['properties'])) ||
    (value['slots'] !== undefined && !isStringRecord(value['slots']))
  )
    return false;
  const limits = value['limits'];
  if (
    limits !== undefined &&
    (!isRecord(limits) ||
      !['errors', 'events', 'state', 'checks'].every((key) => {
        const limit = limits[key];
        return (
          limit === undefined ||
          (typeof limit === 'number' && Number.isSafeInteger(limit) && limit >= 0)
        );
      }))
  )
    return false;
  const interactions = value['interactions'];
  return (
    interactions === undefined ||
    (Array.isArray(interactions) &&
      interactions.every(
        (item) =>
          isRecord(item) &&
          isEventId(item['id']) &&
          typeof item['event'] === 'string' &&
          (item['target'] === undefined || typeof item['target'] === 'string'),
      ))
  );
}

export function isFrameRequest(value: unknown): value is FrameRequest {
  if (!isCompatibleFrameMessage(value)) return false;
  if (
    ![
      'mount',
      'specimen',
      'set',
      'slot',
      'reset',
      'theme',
      'settings',
      'dispose',
      'inspect',
    ].includes(value.kind)
  )
    return false;
  const request = value as FrameRequest;
  switch (request.kind) {
    case 'mount':
      return isFrameMountPayload(request.payload);
    case 'specimen':
      return isFrameSpecimenPayload(request.payload);
    case 'set': {
      if (!isRecord(request.payload)) return false;
      const hasProperty = typeof request.payload['property'] === 'string';
      const hasAttribute = typeof request.payload['attribute'] === 'string';
      const hasCss = request.payload['cssProperty'] !== undefined;
      if (Number(hasProperty) + Number(hasAttribute) + Number(hasCss) !== 1) return false;
      if (hasCss)
        return (
          isCustomPropertyName(request.payload['cssProperty']) &&
          (request.payload['cssValue'] === null || typeof request.payload['cssValue'] === 'string')
        );
      return hasProperty
        ? (request.payload['unset'] === true ||
            (Object.hasOwn(request.payload, 'value') && isJsonValue(request.payload['value']))) &&
            (request.payload['unset'] !== true || !Object.hasOwn(request.payload, 'value'))
        : request.payload['attributeValue'] === null ||
            typeof request.payload['attributeValue'] === 'string';
    }
    case 'slot':
      return (
        isRecord(request.payload) &&
        typeof request.payload['name'] === 'string' &&
        typeof request.payload['text'] === 'string'
      );
    case 'reset':
    case 'dispose':
      return !Object.hasOwn(request, 'payload');
    case 'theme':
      return isRecord(request.payload) && typeof request.payload['cssText'] === 'string';
    case 'settings':
      return isFrameSettings(request.payload);
    case 'inspect':
      return isInspectPreviewRequest(request.payload);
  }
}

export const isFrameReply = (value: unknown): value is FrameReply =>
  isCompatibleFrameMessage(value) && value.kind === 'reply';

export function frameEnvelope<T extends FrameMessage['kind']>(
  identity: FrameIdentity,
  kind: T,
): Envelope & { readonly kind: T } {
  return {
    protocol: FRAME_PROTOCOL,
    version: FRAME_PROTOCOL_VERSION,
    frame: identity.frame,
    generation: identity.generation,
    kind,
  };
}
