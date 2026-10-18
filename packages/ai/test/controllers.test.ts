import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAPABILITY_NAMES,
  intersectCapabilities,
  normalizeMessage,
  normalizeSnapshot,
  pickDeclared,
} from '../src/contracts/normalize.js';
import { MessageModel } from '../src/contracts/models.js';
import { ComposerController, matchesAccept } from '../src/controllers/composer.js';
import { diffLines, diffWords } from '../src/controllers/diff.js';
import {
  DocumentSession,
  captureSelection,
  fromCodePointOffset,
  isValidRange,
  toCodePointOffset,
} from '../src/controllers/document.js';
import { VoiceController, createScriptedVoiceAdapter } from '../src/controllers/voice.js';
import {
  ATTEMPT_TRANSITIONS,
  TOOL_TRANSITIONS,
  applyStopOutcome,
  canTransition,
} from '../src/controllers/transitions.js';

describe('contracts', () => {
  it('validates at the boundary and keeps only declared fields', () => {
    const result = normalizeMessage({
      id: 'm',
      role: 'assistant',
      providerMetadata: { secret: 1 },
      parts: [
        { type: 'text', id: 't', text: 'hi', extra: true },
        { type: 'later-kind', id: 'z' },
        { type: 'file', id: 'f' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      id: 'm',
      role: 'assistant',
      parts: [
        { type: 'text', id: 't', text: 'hi' },
        { type: 'unsupported', id: 'z', originalType: 'later-kind' },
        { type: 'unsupported', id: 'f', originalType: 'file' },
      ],
    });
    expect(result.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['ai.part.unsupported', 'ai.part.invalid', 'model.property.unknown']),
    );
    expect(normalizeMessage({ id: '', role: 'robot', parts: [] }).ok).toBe(false);
    expect(
      pickDeclared(MessageModel.schema, { id: 'x', role: 'user', parts: [], junk: 1 }),
    ).toEqual({ id: 'x', role: 'user', parts: [] });
  });

  it('rejects snapshots with invalid messages and accepts valid history', () => {
    expect(
      normalizeSnapshot({ conversationId: 'c', messages: [{ id: 'm', role: 'user' }] }).ok,
    ).toBe(false);
    expect(
      normalizeSnapshot({ conversationId: 'c', messages: [], hasMoreHistory: true }).value,
    ).toEqual({
      conversationId: 'c',
      messages: [],
      hasMoreHistory: true,
    });
  });

  it('application capabilities narrow but never widen what the adapter supports', () => {
    const merged = intersectCapabilities(
      { send: { available: true }, stop: { available: false, reason: 'No stop endpoint' } },
      {
        send: { available: false, reason: 'Read only' },
        stop: { available: true },
        voice: { available: true },
      },
    );
    expect(merged).toEqual({
      send: { available: false, reason: 'Read only' },
      stop: { available: false, reason: 'No stop endpoint' },
      voice: { available: false },
    });
    expect(CAPABILITY_NAMES).toHaveLength(16);
  });
});

describe('transition tables', () => {
  it('reject invalid transitions and apply stop outcomes truthfully', () => {
    expect(canTransition(ATTEMPT_TRANSITIONS, 'completed', 'cancelled')).toBe(false);
    expect(canTransition(ATTEMPT_TRANSITIONS, 'interrupted', 'streaming')).toBe(true);
    expect(canTransition(TOOL_TRANSITIONS, 'input-streaming', 'output-available')).toBe(false);
    expect(applyStopOutcome('streaming', 'cancelled')).toEqual({
      status: 'cancelled',
      stop: 'confirmed',
    });
    expect(applyStopOutcome('completed', 'cancelled')).toEqual({
      status: 'completed',
      stop: 'too-late',
    });
    expect(applyStopOutcome('streaming', 'not-found')).toEqual({
      status: 'streaming',
      stop: 'unknown',
    });
    expect(applyStopOutcome('streaming', 'rejected')).toEqual({
      status: 'streaming',
      stop: 'failed',
    });
  });
});

describe('ComposerController', () => {
  const file = (name: string, size: number, type: string) =>
    new File([new Uint8Array(size)], name, { type });

  it('A02: acknowledging an older submission keeps newer edits', () => {
    const composer = new ComposerController();
    composer.setText('first');
    const submission = composer.beginSubmit();
    expect(submission).toMatchObject({ text: 'first' });
    expect(composer.beginSubmit()).toBeUndefined();
    composer.setText('first, then more');
    expect(composer.acknowledge(submission?.submissionId as string)).toBe(true);
    expect(composer.getSnapshot()).toMatchObject({
      text: 'first, then more',
      submission: undefined,
    });
    const second = composer.beginSubmit();
    expect(composer.acknowledge('unknown')).toBe(false);
    expect(composer.acknowledge(second?.submissionId as string)).toBe(true);
    expect(composer.getSnapshot().text).toBe('');
  });

  it('A02: a failed submission preserves the draft and attachments', () => {
    const composer = new ComposerController({ previews: false });
    composer.setText('keep me');
    composer.addFiles([file('a.txt', 3, 'text/plain')]);
    const submission = composer.beginSubmit();
    composer.fail(submission?.submissionId as string, { code: 'net', message: 'Offline' });
    expect(composer.getSnapshot()).toMatchObject({
      text: 'keep me',
      attachments: [{ name: 'a.txt', status: 'selected' }],
      submission: { status: 'failed', error: { message: 'Offline' } },
    });
    expect(composer.beginSubmit()).toBeDefined();
  });

  it('validates type, size, and count, and blocks sending while uploads run', () => {
    const composer = new ComposerController({
      accept: ['image/*', '.pdf'],
      maxFileSize: 10,
      maxFiles: 2,
      previews: false,
    });
    const added = composer.addFiles([
      file('a.png', 5, 'image/png'),
      file('b.exe', 5, 'application/x-msdownload'),
      file('c.pdf', 50, 'application/pdf'),
      file('d.pdf', 5, 'application/pdf'),
      file('e.png', 5, 'image/png'),
    ]);
    expect(added.map((a) => a.name)).toEqual(['a.png', 'd.pdf']);
    expect(composer.getSnapshot().issues.map((i) => i.code)).toEqual([
      'ai.attachment.type',
      'ai.attachment.size',
      'ai.attachment.count',
    ]);
    composer.updateAttachment(added[0]?.id as string, { status: 'uploading', progress: 0.5 });
    expect(composer.blocker()).toBe('attachments-busy');
    composer.updateAttachment(added[0]?.id as string, { status: 'ready' });
    expect(composer.blocker()).toBeUndefined();
    expect(matchesAccept({ name: 'x.PDF', type: '' }, ['.pdf'])).toBe(true);
  });

  it('revokes only the object URLs it created', () => {
    const revoked: string[] = [];
    const spy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation((url) => void revoked.push(url));
    try {
      const composer = new ComposerController();
      const [image] = composer.addFiles([file('a.png', 1, 'image/png')]);
      composer.updateAttachment(image?.id as string, { url: 'https://cdn.example/a.png' });
      expect(composer.ownedUrlCount).toBe(1);
      composer.releasePreviews();
      expect(composer.ownedUrlCount).toBe(0);
      composer.restorePreviews();
      expect(composer.ownedUrlCount).toBe(1);
      composer.removeAttachment(image?.id as string);
      expect(composer.ownedUrlCount).toBe(0);
      expect(revoked).toHaveLength(2);
      expect(revoked.every((u) => u.startsWith('blob:'))).toBe(true);
      composer.dispose();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('DocumentSession and text ranges', () => {
  it('uses UTF-16 offsets that never split surrogate pairs, with code point conversion', () => {
    const text = 'a🌍b';
    expect(isValidRange(text, { start: 1, end: 3 })).toBe(true);
    expect(isValidRange(text, { start: 2, end: 3 })).toBe(false);
    expect(toCodePointOffset(text, 3)).toBe(2);
    expect(fromCodePointOffset(text, 2)).toBe(3);
    expect(captureSelection({ value: text, selectionStart: 1, selectionEnd: 3 }, 'r1')).toEqual({
      revision: 'r1',
      start: 1,
      end: 3,
      text: '🌍',
    });
  });

  it('A17: a stale proposal cannot overwrite newer content; undo is distinct', () => {
    const doc = new DocumentSession('The quick fox.');
    const base = doc.getSnapshot().revision;
    const proposal = {
      proposalId: 'p1',
      baseRevision: base,
      range: { start: 4, end: 9 },
      original: 'quick',
      replacement: 'swift',
    };
    doc.propose(proposal);
    doc.propose({ ...proposal, proposalId: 'p2', replacement: 'rapid' });
    expect(doc.accept('p1')).toMatchObject({ ok: true });
    expect(doc.getSnapshot().text).toBe('The swift fox.');
    expect(doc.getSnapshot().proposals.find((p) => p.proposalId === 'p2')?.status).toBe('stale');
    expect(doc.accept('p2')).toEqual({ ok: false, reason: 'stale' });
    expect(doc.undo('p1')).toMatchObject({ ok: true });
    expect(doc.getSnapshot().text).toBe('The quick fox.');
    expect(doc.getSnapshot().proposals.find((p) => p.proposalId === 'p1')?.status).toBe('undone');
    doc.propose({ ...proposal, proposalId: 'p3', baseRevision: doc.getSnapshot().revision });
    doc.setText('The quick brown fox.');
    expect(doc.accept('p3')).toEqual({ ok: false, reason: 'stale' });
    expect(doc.getSnapshot().text).toBe('The quick brown fox.');
    expect(
      doc.propose({
        ...proposal,
        proposalId: 'p4',
        baseRevision: doc.getSnapshot().revision,
        original: 'slow',
      }).status,
    ).toBe('failed');
  });

  it('diffs words and lines and reproduces both inputs', () => {
    const words = diffWords('the quick brown fox', 'the slow brown dog');
    expect(
      words
        .filter((s) => s.kind !== 'insert')
        .map((s) => s.text)
        .join(''),
    ).toBe('the quick brown fox');
    expect(
      words
        .filter((s) => s.kind !== 'delete')
        .map((s) => s.text)
        .join(''),
    ).toBe('the slow brown dog');
    expect(diffLines('a\nb\nc\n', 'a\nB\nc\n')).toEqual([
      { kind: 'equal', text: 'a\n' },
      { kind: 'delete', text: 'b\n' },
      { kind: 'insert', text: 'B\n' },
      { kind: 'equal', text: 'c\n' },
    ]);
  });
});

describe('VoiceController (scripted adapter)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('A19: interim then final results; stop keeps the transcript and releases resources', async () => {
    const adapter = createScriptedVoiceAdapter([
      { after: 10, interim: 'hel' },
      { after: 10, final: 'hello' },
      { after: 10, interim: 'wor' },
    ]);
    const voice = new VoiceController(adapter);
    voice.start();
    expect(voice.getSnapshot().status).toBe('requesting-permission');
    await vi.advanceTimersByTimeAsync(10);
    expect(voice.getSnapshot()).toMatchObject({ status: 'recording', interim: 'hel' });
    await vi.advanceTimersByTimeAsync(20);
    expect(voice.getSnapshot()).toMatchObject({
      interim: 'wor',
      segments: [{ text: 'hello', final: true }],
    });
    voice.stop();
    expect(voice.getSnapshot().status).toBe('processing');
    await vi.advanceTimersByTimeAsync(1);
    expect(voice.getSnapshot()).toMatchObject({ status: 'idle', interim: '' });
    expect(adapter.openResources).toBe(0);
  });

  it('A19: denial, missing device, interruption, and cancel', async () => {
    const denied = new VoiceController(createScriptedVoiceAdapter([], { denyPermission: true }));
    denied.start();
    await vi.advanceTimersByTimeAsync(1);
    expect(denied.getSnapshot()).toMatchObject({ status: 'denied', error: 'permission-denied' });
    const none = new VoiceController(createScriptedVoiceAdapter([], { noDevice: true }));
    none.start();
    await vi.advanceTimersByTimeAsync(1);
    expect(none.getSnapshot().status).toBe('unavailable');
    const interrupted = new VoiceController(
      createScriptedVoiceAdapter([{ after: 5, error: 'interrupted' }]),
    );
    interrupted.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(interrupted.getSnapshot().status).toBe('interrupted');
    const adapter = createScriptedVoiceAdapter([{ after: 50, final: 'never' }]);
    const cancelled = new VoiceController(adapter);
    cancelled.start();
    await vi.advanceTimersByTimeAsync(10);
    cancelled.cancel();
    await vi.advanceTimersByTimeAsync(100);
    expect(cancelled.getSnapshot()).toMatchObject({ status: 'idle', segments: [] });
    expect(adapter.openResources).toBe(0);
    expect(new VoiceController().getSnapshot().status).toBe('unsupported');
  });
});
