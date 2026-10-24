// Linien-Icons (18–20 px, Strich 1.8) im Soft-Glass-Stil.
const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  settings:
    'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 01-2.2 1.3l-.3 2h-3.6l-.3-2a7 7 0 01-2.2-1.3l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 010-2.6L3 9.6l1.8-3.1 1.9.7A7 7 0 018.9 6l.3-2h3.6l.3 2a7 7 0 012.2 1.2l1.9-.7 1.8 3.1-1.6 1.3a7 7 0 010 2.6z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
  mic: 'M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zM6 11a6 6 0 0012 0M12 17v4',
  micOff:
    'M4 4l16 16M9 9v3a3 3 0 004.5 2.6M15 11V6a3 3 0 00-5.6-1.5M6 11a6 6 0 009.5 4.9M18 11a6 6 0 01-.5 2.4M12 17v4',
  pause: 'M9 6v12M15 6v12',
  keypad: 'M6 5h.01M12 5h.01M18 5h.01M6 11h.01M12 11h.01M18 11h.01M6 17h.01M12 17h.01M18 17h.01',
  chart: 'M5 19V11M12 19V5M19 19v-6',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  play: 'M8 5l11 7-11 7V5z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  const round = name === 'keypad';
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={round ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
