import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginSpeaking, endSpeaking, isEchoMuted, onEchoMute } from '../../src/voice/echo';

describe('Echo-Schutz', () => {
  afterEach(() => vi.useRealTimers());

  it('stumm während der Ansage und 300 ms danach', () => {
    vi.useFakeTimers();
    const seen: boolean[] = [];
    const off = onEchoMute((m) => seen.push(m));
    expect(isEchoMuted()).toBe(false);
    beginSpeaking();
    expect(isEchoMuted()).toBe(true);
    endSpeaking();
    expect(isEchoMuted()).toBe(true);
    vi.advanceTimersByTime(250);
    expect(isEchoMuted()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(isEchoMuted()).toBe(false);
    expect(seen.at(-1)).toBe(false);
    off();
  });

  it('überlappende Ausgaben (Effekt + Sprache) zählen mit', () => {
    vi.useFakeTimers();
    beginSpeaking();
    beginSpeaking();
    endSpeaking();
    vi.advanceTimersByTime(1000);
    expect(isEchoMuted()).toBe(true);
    endSpeaking();
    vi.advanceTimersByTime(400);
    expect(isEchoMuted()).toBe(false);
  });
});
