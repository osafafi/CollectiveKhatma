import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRecitationEngine,
  HANDOFF_POLL_MS,
  LOAD_TIMEOUT_MS,
  STALL_TIMEOUT_MS,
  VERSE_FADE_IN_SECONDS,
  VERSE_OVERLAP_SECONDS,
  type RecitationEngine,
} from '@/app/member/recitation/recitationEngine';
import {
  staticPlaylist,
  type RecitationItem,
  type RecitationPlaylist,
} from '@/app/member/recitation/recitationPlaylist';
import type { QariId } from '@/content/quran/recitation';
import {
  audioResponse,
  createFakeRecitationEnvironment,
  type FakeRecitationEnvironment,
} from '../support/fakeRecitationEnvironment';

const PRIMARY = 'https://everyayah.com/data/Alafasy_128kbps/';
const MIRROR = 'https://mirrors.quranicaudio.com/everyayah/Alafasy_128kbps/';

const ayat: RecitationItem[] = [1, 2, 3].map((ayah) => ({
  kind: 'ayah',
  surah: 2,
  ayah,
  page: 2,
}));

/** Real macrotask turns, so fetch/blob promise chains settle under fake timers. */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe('recitation engine', () => {
  let fake: FakeRecitationEnvironment;
  let engine: RecitationEngine;

  const start = (
    options: {
      qariId?: QariId;
      playlist?: RecitationPlaylist;
      startIndex?: number;
      overlapSeconds?: number;
    } = {},
  ): void =>
    engine.start({
      owner: 'reader-1',
      kind: 'reader',
      qariId: options.qariId ?? 'alafasy',
      playlist: options.playlist ?? staticPlaylist(ayat),
      startIndex: options.startIndex,
      overlapSeconds: options.overlapSeconds,
    });

  const status = () => engine.getSnapshot().status;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    fake = createFakeRecitationEnvironment();
    engine = createRecitationEngine(fake.env);
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  it('plays synchronously from start and reuses its two channels across sessions', () => {
    expect(fake.createAudio).not.toHaveBeenCalled();
    start();

    expect(fake.audio.src).toBe(`${PRIMARY}002001.mp3`);
    expect(fake.audio.playCalls).toBe(1);
    expect(status()).toBe('loading');

    fake.audio.startPlaying();
    expect(engine.getSnapshot()).toMatchObject({
      status: 'playing',
      owner: 'reader-1',
      index: 0,
      item: ayat[0],
    });

    engine.stop();
    expect(status()).toBe('idle');
    expect(fake.audio.src).toBe('');
    expect(fake.audio.loadCalls).toBe(1);

    start({ startIndex: 2 });
    expect(fake.audio.src).toBe(`${PRIMARY}002003.mp3`);
    expect(fake.createAudio).toHaveBeenCalledTimes(2);
    expect(fake.unlock).toHaveBeenCalled();
  });

  it('falls back to the mirror on an error and keeps it for later ayat', () => {
    start();
    fake.audio.fail();
    expect(fake.audio.src).toBe(`${MIRROR}002001.mp3`);
    expect(status()).toBe('loading');

    fake.audio.startPlaying();
    fake.audio.finish();
    expect(fake.audio.src).toBe(`${MIRROR}002002.mp3`);
  });

  it('tries the next host when one never starts, then reports unavailable', () => {
    fake.audio.playBehaviour = 'hang';
    start();

    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(fake.audio.src).toBe(`${MIRROR}002001.mp3`);

    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(status()).toBe('unavailable');

    // Nothing ever played, so closing the dialog returns to idle.
    engine.acknowledgeUnavailable();
    expect(status()).toBe('idle');
    expect(fake.audio.src).toBe('');
  });

  it('gives up after one error for a voice the mirror does not carry', () => {
    start({ qariId: 'maher' });
    expect(fake.audio.src).toBe(
      'https://everyayah.com/data/MaherAlMuaiqly128kbps/002001.mp3',
    );
    fake.audio.fail();
    expect(status()).toBe('unavailable');
  });

  it('reports offline as unavailable without touching the audio element', () => {
    fake.setOnline(false);
    start();
    expect(status()).toBe('unavailable');
    expect(fake.createAudio).not.toHaveBeenCalled();
  });

  it('holds paused when the browser refuses playback and ignores aborts', async () => {
    fake.audio.playBehaviour = { reject: 'NotAllowedError' };
    start();
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', interrupted: false });

    fake.audio.playBehaviour = 'resolve';
    engine.resume();
    expect(status()).toBe('loading');
    fake.audio.startPlaying();
    expect(status()).toBe('playing');

    engine.stop();
    fake.audio.playBehaviour = { reject: 'AbortError' };
    start();
    await flush();
    expect(status()).toBe('loading');
  });

  it('advances through the playlist and ends after the last ayah', () => {
    start();
    for (const ayah of ['002001', '002002', '002003']) {
      expect(fake.audio.src).toBe(`${PRIMARY}${ayah}.mp3`);
      fake.audio.startPlaying();
      fake.audio.finish();
    }
    expect(engine.getSnapshot()).toMatchObject({ status: 'ended', index: 2 });
  });

  it('waits for a lazily resolved next item before loading it', async () => {
    const items = [ayat[0]!];
    let release: (() => void) | undefined;
    const playlist: RecitationPlaylist = {
      items,
      complete: false,
      ensure: (index) =>
        index < items.length
          ? Promise.resolve(items[index])
          : new Promise((resolve) => {
              release = () => {
                items.push(ayat[1]!);
                resolve(items[index]);
              };
            }),
    };
    start({ playlist });
    fake.audio.startPlaying();
    fake.audio.finish();
    expect(status()).toBe('loading');
    expect(engine.getSnapshot().index).toBe(0);

    release?.();
    await flush();
    expect(fake.audio.src).toBe(`${PRIMARY}002002.mp3`);
    expect(engine.getSnapshot().index).toBe(1);
  });

  it('treats an outside pause as an interruption, not the end of a file', () => {
    start();
    fake.audio.startPlaying();
    fake.audio.interrupt();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', interrupted: true });

    engine.resume();
    fake.audio.startPlaying();
    expect(engine.getSnapshot()).toMatchObject({ status: 'playing', interrupted: false });

    engine.pause();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', interrupted: false });
  });

  it('turns a mid-play error into unavailable, then holds the same ayah paused', () => {
    start();
    fake.audio.startPlaying();
    fake.audio.finish();
    fake.audio.startPlaying();
    fake.audio.fail();
    expect(engine.getSnapshot()).toMatchObject({ status: 'unavailable', index: 1 });

    engine.acknowledgeUnavailable();
    expect(engine.getSnapshot()).toMatchObject({ status: 'paused', index: 1 });

    engine.resume();
    expect(fake.audio.src).toBe(`${PRIMARY}002002.mp3`);
    expect(
      fake.audio.srcHistory.filter((src) => src.endsWith('002002.mp3')),
    ).toHaveLength(2);
  });

  it('treats a long stall as unavailable but not one that recovers', () => {
    start();
    fake.audio.startPlaying();
    fake.audio.emit('waiting');
    vi.advanceTimersByTime(STALL_TIMEOUT_MS - 1);
    fake.audio.currentTime = 1;
    fake.audio.emit('timeupdate');
    vi.advanceTimersByTime(STALL_TIMEOUT_MS);
    expect(status()).toBe('playing');

    fake.audio.emit('waiting');
    vi.advanceTimersByTime(STALL_TIMEOUT_MS);
    expect(status()).toBe('unavailable');
  });

  it('steps back early in an ayah and restarts it later on', () => {
    start({ startIndex: 1 });
    fake.audio.startPlaying();
    fake.audio.currentTime = 5;
    engine.previous();
    expect(fake.audio.src).toBe(`${PRIMARY}002002.mp3`);
    expect(fake.audio.currentTime).toBe(0);
    expect(engine.getSnapshot().index).toBe(1);

    fake.audio.currentTime = 1.5;
    engine.previous();
    expect(fake.audio.src).toBe(`${PRIMARY}002001.mp3`);
    expect(engine.getSnapshot().index).toBe(0);

    // On the first ayah, early "previous" restarts it.
    fake.audio.startPlaying();
    engine.previous();
    expect(engine.getSnapshot().index).toBe(0);
  });

  it('ends playback when next is pressed on the last ayah', () => {
    start({ startIndex: 2 });
    fake.audio.startPlaying();
    engine.next();
    expect(status()).toBe('ended');
    expect(fake.audio.paused).toBe(true);
  });

  it('plays the next ayah from a prefetched blob and then releases it', async () => {
    fake.fetch.mockImplementation(() => Promise.resolve(audioResponse()));
    start();
    fake.audio.startPlaying();
    await flush();
    expect(fake.fetch).toHaveBeenCalledWith(`${PRIMARY}002002.mp3`, expect.anything());
    expect(fake.createObjectURL).toHaveBeenCalledTimes(1);

    fake.audio.finish();
    expect(fake.audio.src).toBe('blob:fake-1');
    fake.audio.startPlaying();
    await flush();
    fake.audio.finish();
    expect(fake.audio.src).toBe('blob:fake-2');
    expect(fake.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');

    engine.stop();
    expect(fake.revokeObjectURL).toHaveBeenCalledWith('blob:fake-2');
  });

  it('discards a prefetch that is not audio and streams instead', async () => {
    fake.fetch.mockImplementation(() => Promise.resolve(audioResponse('text/html')));
    start();
    fake.audio.startPlaying();
    await flush();
    expect(fake.createObjectURL).not.toHaveBeenCalled();
    fake.audio.finish();
    expect(fake.audio.src).toBe(`${PRIMARY}002002.mp3`);
  });

  it('skips prefetching under Data Saver and aborts it on stop', () => {
    fake.setSaveData(true);
    start();
    fake.audio.startPlaying();
    expect(fake.fetch).not.toHaveBeenCalled();
    engine.stop();

    fake.setSaveData(false);
    start();
    fake.audio.startPlaying();
    return flush().then(() => {
      const signal = fake.fetch.mock.calls[0]?.[1].signal;
      expect(signal?.aborted).toBe(false);
      engine.stop();
      expect(signal?.aborted).toBe(true);
    });
  });

  describe('overlapped handoff', () => {
    const [first, second] = [0, 1] as const;

    /** Play the current channel up to just inside the overlap window. */
    function nearEnd(channel: 0 | 1, duration = 5): void {
      const audio = fake.channels[channel];
      audio.duration = duration;
      audio.currentTime = duration - VERSE_OVERLAP_SECONDS + 0.05;
      vi.advanceTimersByTime(HANDOFF_POLL_MS);
    }

    it('starts the next ayah on the other channel while the tail fades out', () => {
      start();
      fake.channels[first].startPlaying();
      fake.channels[first].duration = 5;
      fake.channels[first].currentTime = 3;
      vi.advanceTimersByTime(HANDOFF_POLL_MS * 4);
      expect(fake.channels[second].src).toBe('');

      nearEnd(first);
      expect(fake.channels[second].src).toBe(`${PRIMARY}002002.mp3`);
      expect(engine.getSnapshot()).toMatchObject({ status: 'loading', index: 1 });
      // The incoming ayah starts silent; the outgoing tail is still sounding.
      expect(fake.channels[second].gain).toBe(0);
      expect(fake.channels[first].paused).toBe(false);
      expect(fake.channels[first].fades.at(-1)!.level).toBe(0);
      expect(fake.channels[first].fades.at(-1)!.seconds).toBeLessThanOrEqual(
        VERSE_OVERLAP_SECONDS,
      );

      fake.channels[second].startPlaying();
      expect(fake.channels[second].fades.at(-1)).toEqual({
        level: 1,
        seconds: VERSE_FADE_IN_SECONDS,
      });
      expect(engine.getSnapshot()).toMatchObject({ status: 'playing', index: 1 });

      // The tail's own end changes nothing.
      fake.channels[first].finish();
      expect(engine.getSnapshot()).toMatchObject({ status: 'playing', index: 1 });

      // And the chain carries on back onto the first channel.
      nearEnd(second);
      expect(fake.channels[first].src).toBe(`${PRIMARY}002003.mp3`);
      expect(fake.channels[first].gain).toBe(0);
    });

    it('waits for the end instead when the next ayah is not known yet', async () => {
      const items = [ayat[0]!];
      const playlist: RecitationPlaylist = {
        items,
        complete: false,
        ensure: () => new Promise(() => undefined),
      };
      start({ playlist });
      fake.channels[first].startPlaying();
      nearEnd(first);
      expect(fake.channels[second].src).toBe('');
      expect(engine.getSnapshot()).toMatchObject({ status: 'playing', index: 0 });
    });

    it('never overlaps the opening of a very short file', () => {
      start();
      fake.channels[first].startPlaying();
      fake.channels[first].duration = VERSE_OVERLAP_SECONDS;
      fake.channels[first].currentTime = 0.05;
      vi.advanceTimersByTime(HANDOFF_POLL_MS);
      expect(fake.channels[second].src).toBe('');
    });

    it('cuts the fading tail when the member pauses, skips, or stops', () => {
      start();
      fake.channels[first].startPlaying();
      nearEnd(first);
      engine.pause();
      expect(fake.channels[first].paused).toBe(true);
      expect(fake.channels[first].src).toBe('');
      expect(fake.channels[second].paused).toBe(true);

      engine.resume();
      expect(fake.channels[second].gain).toBe(1);
      fake.channels[second].startPlaying();
      engine.stop();
      expect(fake.channels[second].src).toBe('');

      // A fresh session starts on the first channel at full volume.
      start();
      expect(fake.channels[first].src).toBe(`${PRIMARY}002001.mp3`);
      expect(fake.channels[first].gain).toBe(1);
    });

    it("uses the voice's own overlap, retunes live, and can turn it off", () => {
      start({ overlapSeconds: 0.5 });
      fake.channels[first].startPlaying();
      fake.channels[first].duration = 5;
      fake.channels[first].currentTime = 4.6;
      vi.advanceTimersByTime(HANDOFF_POLL_MS);
      expect(fake.channels[second].src).toBe(`${PRIMARY}002002.mp3`);
      fake.channels[second].startPlaying();

      engine.setOverlap(0);
      fake.channels[second].duration = 5;
      fake.channels[second].currentTime = 4.99;
      vi.advanceTimersByTime(HANDOFF_POLL_MS * 2);
      expect(fake.channels[first].src).not.toBe(`${PRIMARY}002003.mp3`);
      // With no overlap the plain end of the file moves on.
      fake.channels[second].finish();
      expect(fake.channels[second].src).toBe(`${PRIMARY}002003.mp3`);
    });

    it('holds paused when the platform silences the mixer', () => {
      start();
      fake.channels[first].startPlaying();
      fake.interruptMixer();
      expect(engine.getSnapshot()).toMatchObject({ status: 'paused', interrupted: true });
      expect(fake.channels[first].paused).toBe(true);

      fake.unlock.mockClear();
      engine.resume();
      expect(fake.unlock).toHaveBeenCalled();
      fake.channels[first].startPlaying();
      expect(engine.getSnapshot()).toMatchObject({
        status: 'playing',
        interrupted: false,
      });
    });
  });

  it('ignores a stop from anyone other than the session owner', () => {
    start();
    engine.stop('settings-preview');
    expect(status()).toBe('loading');
    engine.stop('reader-1');
    expect(status()).toBe('idle');
  });
});
