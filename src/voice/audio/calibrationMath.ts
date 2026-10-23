// Reine Berechnung – ohne DOM, damit sie unit-testbar ist.
export const SPEECH_TARGET_DB = -20;
export const MAX_GAIN_DB = 30;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return -100;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

export interface CalibrationResult {
  gainDb: number;
  gateDb: number;
  noiseDb: number;
  speechDb: number;
  /** Abstand Stimme zu Raum nach der Verstärkung. */
  marginDb: number;
  warning: string | null;
}

/**
 * Aus gemessenen Pegeln (dBFS, nach aktueller Verstärkung) neue Werte berechnen:
 * Verstärkung so, dass die Stimme bei ca. −20 dBFS ankommt; Gate ein gutes Stück über dem Raumrauschen.
 */
export function computeCalibration(
  noise: number[],
  speech: number[],
  currentGainDb: number,
): CalibrationResult {
  const noiseDb = percentile(noise, 0.5);
  const speechDb = percentile(speech, 0.9);
  const gainDb = Math.round(
    Math.max(0, Math.min(MAX_GAIN_DB, currentGainDb + (SPEECH_TARGET_DB - speechDb))),
  );
  const applied = gainDb - currentGainDb;
  const n = noiseDb + applied;
  const s = speechDb + applied;
  const margin = s - n;
  const gateDb = Math.round(Math.max(-75, Math.min(-25, n + Math.max(6, margin * 0.35))));
  let warning: string | null = null;
  if (margin < 8)
    warning = 'Deine Stimme ist kaum lauter als der Raum. Leg das Gerät näher ans Board oder sprich lauter.';
  else if (s < SPEECH_TARGET_DB - 10)
    warning = 'Auch mit maximaler Verstärkung ist die Stimme leise. Gerät näher heranstellen.';
  return { gainDb, gateDb, noiseDb, speechDb, marginDb: margin, warning };
}
