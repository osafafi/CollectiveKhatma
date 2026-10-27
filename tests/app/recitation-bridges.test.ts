import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectMediaSession,
  connectWakeLock,
  type MediaAction,
  type MediaSessionPorts,
  type WakeLockHandle,
} from '@/app/member/recitation/recitationBridges';
import {
  createRecitationEngine,
  type RecitationEngine,
} from '@/app/member/recitation/recitationEngine';
import {
  previewPlaylist,
  staticPlaylist,
  type RecitationItem,
} from '@/app/member/recitation/recitationPlaylist';
import {
  createFakeRecitationEnvironment,
  type FakeRecitationEnvironment,
} from '../support/fakeRecitationEnvironment';

const ayat: RecitationItem[] = [1, 2].map((ayah) => ({
  kind: 'ayah',
  surah: 2,
  ayah,
  page: 2,
}));

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let fake: FakeRecitationEnvironment;
let engine: RecitationEngine;

function startReader(): void {
  engine.start({
    owner: 'reader',
    kind: 'reader',
    qariId: 'alafasy',
    playlist: staticPlaylist(ayat),
  });
}

beforeEach(() => {
  fake = createFakeRecitationEnvironment();
  engine = createRecitationEngine(fake.env);
});

describe('screen wake lock bridge', () => {
  function wakeLock() {
    let visible = true;
    let onVisibility: (() => void) | undefined;
    const handles: { release: ReturnType<typeof vi.fn> }[] = [];
    const request = vi.fn((): Promise<WakeLockHandle> => {
      const handle = { release: vi.fn(() => Promise.resolve()) };
      handles.push(handle);
      return Promise.resolve(handle);
    });
    const ports = {
      request,
      isVisible: () => visible,
      onVisibilityChange(listener: () => void) {
        onVisibility = listener;
        return () => {
          onVisibility = undefined;
        };
      },
    };
    return {
      ports,
      request,
      handles,
      setVisible(value: boolean) {
        visible = value;
        onVisibility?.();
      },
    };
  }

  it('holds the screen awake while a reader recites and lets go when it pauses', async () => {
    const lock = wakeLock();
    const disconnect = connectWakeLock(engine, lock.ports);

    startReader();
    fake.audio.startPlaying();
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(1);

    engine.pause();
    await settle();
    expect(lock.handles[0]!.release).toHaveBeenCalled();
    disconnect();
  });

  it('asks again when the page becomes visible, and never for previews', async () => {
    const lock = wakeLock();
    connectWakeLock(engine, lock.ports);

    engine.start({
      owner: 'preview',
      kind: 'preview',
      qariId: 'alafasy',
      playlist: previewPlaylist(),
    });
    fake.audio.startPlaying();
    await settle();
    expect(lock.request).not.toHaveBeenCalled();

    startReader();
    fake.audio.startPlaying();
    await settle();
    lock.setVisible(false);
    await settle();
    expect(lock.handles[0]!.release).toHaveBeenCalled();
    lock.setVisible(true);
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(2);
  });

  it('swallows a refused or missing wake lock', async () => {
    const ports = {
      request: vi.fn(() => Promise.reject(new DOMException('no', 'NotAllowedError'))),
      isVisible: () => true,
      onVisibilityChange: () => () => undefined,
    };
    connectWakeLock(engine, ports);
    startReader();
    fake.audio.startPlaying();
    await settle();
    expect(engine.getSnapshot().status).toBe('playing');

    const missing = { ...ports, request: () => undefined };
    expect(() => connectWakeLock(engine, missing)).not.toThrow();
  });
});

describe('media session bridge', () => {
  function mediaSession() {
    const handlers = new Map<MediaAction, (() => void) | null>();
    const ports: MediaSessionPorts & {
      metadata: unknown;
      state: string;
    } = {
      metadata: undefined,
      state: 'none',
      setMetadata(metadata) {
        ports.metadata = metadata;
      },
      setPlaybackState(state) {
        ports.state = state;
      },
      setActionHandler(action, handler) {
        handlers.set(action, handler);
      },
    };
    return { ports, handlers };
  }

  const describeItem = (item: RecitationItem) => ({
    title: `${item.surah}:${item.ayah}`,
    artist: 'qari',
    album: 'app',
  });

  it('mirrors a reader session onto the lock screen controls', () => {
    const session = mediaSession();
    const disconnect = connectMediaSession(engine, session.ports, describeItem);

    startReader();
    fake.audio.startPlaying();
    expect(session.ports.metadata).toEqual({
      title: '2:1',
      artist: 'qari',
      album: 'app',
    });
    expect(session.ports.state).toBe('playing');
    expect(session.handlers.get('seekto')).toBeNull();
    expect(session.handlers.get('seekbackward')).toBeNull();
    expect(session.handlers.get('seekforward')).toBeNull();

    session.handlers.get('nexttrack')!();
    expect(fake.audio.src).toMatch(/002002\.mp3$/);
    expect(session.ports.metadata).toMatchObject({ title: '2:2' });

    session.handlers.get('pause')!();
    expect(session.ports.state).toBe('paused');

    engine.stop();
    expect(session.ports.metadata).toBeNull();
    expect(session.ports.state).toBe('none');
    expect(session.handlers.get('play')).toBeNull();
    disconnect();
  });

  it('ignores previews and survives a platform that throws', () => {
    const session = mediaSession();
    session.ports.setActionHandler = () => {
      throw new TypeError('unsupported action');
    };
    connectMediaSession(engine, session.ports, describeItem);

    engine.start({
      owner: 'preview',
      kind: 'preview',
      qariId: 'alafasy',
      playlist: previewPlaylist(),
    });
    fake.audio.startPlaying();
    expect(session.ports.metadata).toBeUndefined();

    expect(() => {
      startReader();
      fake.audio.startPlaying();
    }).not.toThrow();
    expect(session.ports.state).toBe('playing');
  });

  it('does nothing where the platform has no media session', () => {
    expect(() => connectMediaSession(engine, undefined, describeItem)()).not.toThrow();
  });
});
