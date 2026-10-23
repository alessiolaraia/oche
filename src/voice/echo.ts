// Kein Selbst-Triggern: Während die App spricht, bekommt der Erkenner kein Audio (+ 300 ms Puffer).
const TAIL_MS = 300;
let speaking = 0;
let mutedUntil = 0;
const listeners = new Set<(muted: boolean) => void>();

export function onEchoMute(l: (muted: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function notify() {
  const m = isEchoMuted();
  for (const l of listeners) l(m);
}

export function beginSpeaking(): void {
  speaking++;
  notify();
}

let tailTimer: ReturnType<typeof setTimeout> | undefined;

export function endSpeaking(): void {
  speaking = Math.max(0, speaking - 1);
  if (speaking === 0) {
    mutedUntil = Date.now() + TAIL_MS;
    clearTimeout(tailTimer);
    tailTimer = setTimeout(notify, TAIL_MS + 10);
  }
  notify();
}

export function isEchoMuted(): boolean {
  return speaking > 0 || Date.now() < mutedUntil;
}
