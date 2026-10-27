import { vi } from 'vitest';
import type {
  RecitationAudio,
  RecitationAudioEvent,
  RecitationEnvironment,
} from '@/app/member/recitation/recitationEngine';

export type FakePlayBehaviour = 'resolve' | 'hang' | { reject: string };

/**
 * Scriptable stand-in for `HTMLAudioElement` (jsdom implements no playback).
 * Events fire synchronously when a test calls the helpers below, in the order
 * real browsers use.
 */
export class FakeAudio implements RecitationAudio {
  readonly srcHistory: string[] = [];
  /** Every fade the engine asked for, oldest first. */
  readonly fades: { level: number; seconds: number }[] = [];
  currentTime = 0;
  duration = Number.NaN;
  /** The level the last fade is heading to. */
  gain = 1;
  paused = true;
  ended = false;
  playBehaviour: FakePlayBehaviour = 'resolve';
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  private source = '';
  private readonly listeners = new Map<RecitationAudioEvent, Set<() => void>>();

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    this.srcHistory.push(value);
    this.currentTime = 0;
    this.ended = false;
  }

  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    this.ended = false;
    const behaviour = this.playBehaviour;
    if (behaviour === 'resolve') return Promise.resolve();
    if (behaviour === 'hang') return new Promise<void>(() => undefined);
    return Promise.reject(new DOMException('play() refused', behaviour.reject));
  }

  pause(): void {
    this.pauseCalls += 1;
    if (this.paused) return;
    this.paused = true;
    this.emit('pause');
  }

  load(): void {
    this.loadCalls += 1;
  }

  removeAttribute(): void {
    this.source = '';
  }

  fadeTo(level: number, seconds: number): void {
    this.fades.push({ level, seconds });
    this.gain = level;
  }

  addEventListener(type: RecitationAudioEvent, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  emit(type: RecitationAudioEvent): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  /** The current source starts sounding. */
  startPlaying(): void {
    this.paused = false;
    this.emit('playing');
  }

  /** The file reaches its end: `pause` then `ended`, as the spec orders them. */
  finish(): void {
    this.ended = true;
    this.paused = true;
    this.emit('pause');
    this.emit('ended');
  }

  /** Something outside the app pauses playback (the OS, a call). */
  interrupt(): void {
    this.paused = true;
    this.emit('pause');
  }

  fail(): void {
    this.emit('error');
  }
}

export function audioResponse(type = 'audio/mpeg'): Response {
  return new Response(new Blob(['mp3'], { type }), { headers: { 'content-type': type } });
}

export function createFakeRecitationEnvironment() {
  // The engine's two channels, in creation order. Without an overlapped
  // handoff only the first is ever used, so most tests just read `audio`.
  const channels = [new FakeAudio(), new FakeAudio()] as const;
  const audio = channels[0];
  let online = true;
  let saveData = false;
  let objectUrls = 0;
  let created = 0;
  const interruptions = new Set<() => void>();

  const createAudio = vi.fn(() => channels[created++ % 2]!);
  const unlock = vi.fn();
  // Prefetches hang unless a test answers them.
  const fetch = vi.fn(
    (_url: string, _init: { signal: AbortSignal }): Promise<Response> =>
      new Promise<Response>(() => undefined),
  );
  const createObjectURL = vi.fn((_blob: Blob) => `blob:fake-${(objectUrls += 1)}`);
  const revokeObjectURL = vi.fn((_url: string) => undefined);

  const env: RecitationEnvironment = {
    createAudio,
    unlock,
    onInterrupted: (listener) => {
      interruptions.add(listener);
    },
    fetch: (url, init) => fetch(url, init),
    createObjectURL: (blob) => createObjectURL(blob),
    revokeObjectURL: (url) => revokeObjectURL(url),
    isOnline: () => online,
    savesData: () => saveData,
  };

  return {
    env,
    audio,
    channels,
    createAudio,
    unlock,
    fetch,
    createObjectURL,
    revokeObjectURL,
    setOnline(value: boolean) {
      online = value;
    },
    setSaveData(value: boolean) {
      saveData = value;
    },
    /** The platform silences the audio mixer (an iOS lock screen, a call). */
    interruptMixer() {
      for (const listener of interruptions) listener();
    },
  };
}

export type FakeRecitationEnvironment = ReturnType<
  typeof createFakeRecitationEnvironment
>;
