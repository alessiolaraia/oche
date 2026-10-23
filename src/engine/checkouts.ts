import type { Dart, Multiplier, OutMode } from './types';

export const BULL = 25;

export function dartValue(d: Dart): number {
  return d.segment * d.multiplier;
}

export function dartLabel(d: Dart): string {
  if (d.segment === 0) return '0';
  if (d.segment === BULL) return d.multiplier === 2 ? 'Bull' : '25';
  const prefix = d.multiplier === 3 ? 'T' : d.multiplier === 2 ? 'D' : 'S';
  return `${prefix}${d.segment}`;
}

export function parseDartLabel(label: string): Dart {
  if (label === 'Bull') return { segment: BULL, multiplier: 2 };
  if (label === '25') return { segment: BULL, multiplier: 1 };
  const m = /^([SDT])(\d{1,2})$/.exec(label);
  if (!m) throw new Error(`Ungültiges Dart-Label: ${label}`);
  const multiplier: Multiplier = m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1;
  return { segment: Number(m[2]), multiplier };
}

/** Alle treffbaren Darts (ohne Fehlwurf). */
export const ALL_DARTS: readonly Dart[] = [
  ...[1, 2, 3].flatMap((multiplier) =>
    Array.from({ length: 20 }, (_, i) => ({ segment: i + 1, multiplier: multiplier as Multiplier })),
  ),
  { segment: BULL, multiplier: 1 },
  { segment: BULL, multiplier: 2 },
];

export function isFinishingDart(d: Dart, out: OutMode): boolean {
  if (d.segment === 0) return false;
  if (out === 'straight') return true;
  if (out === 'double') return d.multiplier === 2;
  return d.multiplier >= 2;
}

/** Höchster Rest, der mit drei Darts noch auscheckbar ist. */
export function maxCheckout(out: OutMode): number {
  return out === 'double' ? 170 : 180;
}

/**
 * Standard-Wege (Double-Out, 3 Darts) für 41–170, wie sie auf gängigen Profi-Checkout-Tabellen stehen.
 * Unter 41 werden die Wege berechnet (gerade: direktes Doppel, ungerade: Single auf ein „gutes“ Doppel).
 */
const DOUBLE_OUT_CHART: Record<number, string> = {
  170: 'T20 T20 Bull',
  167: 'T20 T19 Bull',
  164: 'T20 T18 Bull',
  161: 'T20 T17 Bull',
  160: 'T20 T20 D20',
  158: 'T20 T20 D19',
  157: 'T20 T19 D20',
  156: 'T20 T20 D18',
  155: 'T20 T19 D19',
  154: 'T20 T18 D20',
  153: 'T20 T19 D18',
  152: 'T20 T20 D16',
  151: 'T20 T17 D20',
  150: 'T20 T18 D18',
  149: 'T20 T19 D16',
  148: 'T20 T20 D14',
  147: 'T20 T17 D18',
  146: 'T20 T18 D16',
  145: 'T20 T15 D20',
  144: 'T20 T20 D12',
  143: 'T20 T17 D16',
  142: 'T20 T14 D20',
  141: 'T20 T19 D12',
  140: 'T20 T20 D10',
  139: 'T20 T13 D20',
  138: 'T20 T18 D12',
  137: 'T20 T19 D10',
  136: 'T20 T20 D8',
  135: 'T20 T17 D12',
  134: 'T20 T14 D16',
  133: 'T20 T19 D8',
  132: 'T20 T16 D12',
  131: 'T20 T13 D16',
  130: 'T20 T18 D8',
  129: 'T19 T16 D12',
  128: 'T18 T14 D16',
  127: 'T20 T17 D8',
  126: 'T19 T19 D6',
  125: '25 T20 D20',
  124: 'T20 T16 D8',
  123: 'T19 T16 D9',
  122: 'T18 T20 D4',
  121: 'T20 T11 D14',
  120: 'T20 S20 D20',
  119: 'T19 T12 D13',
  118: 'T20 S18 D20',
  117: 'T20 S17 D20',
  116: 'T20 S16 D20',
  115: 'T20 S15 D20',
  114: 'T20 S14 D20',
  113: 'T20 S13 D20',
  112: 'T20 S12 D20',
  111: 'T20 S11 D20',
  110: 'T20 Bull',
  109: 'T20 S9 D20',
  108: 'T20 S16 D16',
  107: 'T19 Bull',
  106: 'T20 S10 D18',
  105: 'T20 S13 D16',
  104: 'T18 Bull',
  103: 'T19 S10 D18',
  102: 'T20 S10 D16',
  101: 'T17 Bull',
  100: 'T20 D20',
  99: 'T19 S10 D16',
  98: 'T20 D19',
  97: 'T19 D20',
  96: 'T20 D18',
  95: 'T19 D19',
  94: 'T18 D20',
  93: 'T19 D18',
  92: 'T20 D16',
  91: 'T17 D20',
  90: 'T20 D15',
  89: 'T19 D16',
  88: 'T16 D20',
  87: 'T17 D18',
  86: 'T18 D16',
  85: 'T15 D20',
  84: 'T20 D12',
  83: 'T17 D16',
  82: 'Bull D16',
  81: 'T19 D12',
  80: 'T20 D10',
  79: 'T13 D20',
  78: 'T18 D12',
  77: 'T19 D10',
  76: 'T20 D8',
  75: 'T17 D12',
  74: 'T14 D16',
  73: 'T19 D8',
  72: 'T16 D12',
  71: 'T13 D16',
  70: 'T18 D8',
  69: 'T19 D6',
  68: 'T20 D4',
  67: 'T17 D8',
  66: 'T10 D18',
  65: 'T19 D4',
  64: 'T16 D8',
  63: 'T13 D12',
  62: 'T10 D16',
  61: 'T15 D8',
  60: 'S20 D20',
  59: 'S19 D20',
  58: 'S18 D20',
  57: 'S17 D20',
  56: 'S16 D20',
  55: 'S15 D20',
  54: 'S14 D20',
  53: 'S13 D20',
  52: 'S12 D20',
  51: 'S11 D20',
  50: 'S10 D20',
  49: 'S9 D20',
  48: 'S16 D16',
  47: 'S15 D16',
  46: 'S6 D20',
  45: 'S13 D16',
  44: 'S12 D16',
  43: 'S3 D20',
  42: 'S10 D16',
  41: 'S9 D16',
};

/** Reihenfolge der Lieblingsdoppel – entscheidet bei berechneten Wegen. */
const DOUBLE_PREFERENCE = [20, 16, 18, 12, 10, 8, 19, 14, 17, 15, 13, 11, 9, 6, 4, 7, 5, 3, 2, 1, BULL];

function finishRank(d: Dart): number {
  const i = DOUBLE_PREFERENCE.indexOf(d.segment);
  // Doppel vor Triple vor Single; innerhalb nach Lieblingsdoppel
  const mult = d.multiplier === 2 ? 0 : d.multiplier === 3 ? 100 : 200;
  return mult + (i < 0 ? 50 : i);
}

/** Setup-Darts: dicke Triples zuerst, dann Singles; Bull zuletzt. */
function setupRank(d: Dart): number {
  if (d.segment === BULL) return 500 + (d.multiplier === 2 ? 0 : 1);
  const mult = d.multiplier === 3 ? 0 : d.multiplier === 1 ? 100 : 200;
  return mult + (20 - d.segment);
}

const SETUP_DARTS = [...ALL_DARTS].sort((a, b) => setupRank(a) - setupRank(b));

function finishingDarts(out: OutMode): Dart[] {
  return ALL_DARTS.filter((d) => isFinishingDart(d, out)).sort((a, b) => finishRank(a) - finishRank(b));
}

const finishCache = new Map<OutMode, Dart[]>();
function finishersFor(out: OutMode): Dart[] {
  let list = finishCache.get(out);
  if (!list) {
    list = finishingDarts(out);
    finishCache.set(out, list);
  }
  return list;
}

/** Bester Weg mit genau `n` Darts (oder null). */
function searchExact(rest: number, out: OutMode, n: number): Dart[] | null {
  const finishers = finishersFor(out);
  if (n === 1) {
    const f = finishers.find((d) => dartValue(d) === rest);
    return f ? [f] : null;
  }
  for (const f of finishers) {
    const before = rest - dartValue(f);
    if (before <= 0) continue;
    if (n === 2) {
      const s = SETUP_DARTS.find((d) => dartValue(d) === before);
      if (s) return [s, f];
    } else {
      for (const s1 of SETUP_DARTS) {
        const r = before - dartValue(s1);
        if (r <= 0) continue;
        const s2 = SETUP_DARTS.find((d) => dartValue(d) === r);
        if (s2) return [s1, s2, f];
      }
    }
  }
  return null;
}

function oddDoubleOutRoute(rest: number): Dart[] | null {
  for (const d of [32, 16, 8, 4, 2]) {
    const single = rest - d;
    if (single >= 1 && single <= 20)
      return [
        { segment: single, multiplier: 1 },
        { segment: d / 2, multiplier: 2 },
      ];
  }
  return null;
}

/**
 * Empfohlener Checkout-Weg für `rest` mit höchstens `dartsLeft` Darts, oder null wenn nicht möglich.
 */
const routeCache = new Map<string, Dart[] | null>();

export function checkoutRoute(rest: number, out: OutMode = 'double', dartsLeft = 3): Dart[] | null {
  const key = `${out}:${dartsLeft}:${rest}`;
  if (!routeCache.has(key)) routeCache.set(key, computeRoute(rest, out, dartsLeft));
  const r = routeCache.get(key)!;
  return r ? [...r] : null;
}

/** Höchste Punktzahl, die mit n Darts auscheckbar ist. */
function maxWith(out: OutMode, n: number): number {
  return out === 'double' ? ([0, 50, 110, 170][n] ?? 170) : 60 * n;
}

function computeRoute(rest: number, out: OutMode, dartsLeft: number): Dart[] | null {
  if (rest > maxWith(out, Math.min(3, dartsLeft))) return null;
  if (rest < 1 || dartsLeft < 1) return null;
  if (out === 'double') {
    if (rest < 2) return null;
    if (rest <= 40 && rest % 2 === 0) return [{ segment: rest / 2, multiplier: 2 }];
    if (rest === 50 && dartsLeft === 1) return [{ segment: BULL, multiplier: 2 }];
    const charted = DOUBLE_OUT_CHART[rest];
    if (charted) {
      const route = charted.split(' ').map(parseDartLabel);
      if (route.length <= dartsLeft) return route;
    } else if (rest < 41 && dartsLeft >= 2) {
      return oddDoubleOutRoute(rest);
    }
  }
  for (let n = 1; n <= dartsLeft; n++) {
    const route = searchExact(rest, out, n);
    if (route) return route;
  }
  return null;
}

export function isFinishable(rest: number, out: OutMode = 'double', dartsLeft = 3): boolean {
  return checkoutRoute(rest, out, dartsLeft) !== null;
}

/** Reste ≤ 170, die mit Double-Out nicht in drei Darts gecheckt werden können. */
export const BOGEY_NUMBERS: readonly number[] = [159, 162, 163, 165, 166, 168, 169];

export function formatRoute(route: Dart[]): string {
  return route.map(dartLabel).join(' ');
}
