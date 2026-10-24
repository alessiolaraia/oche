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

/** Umgebungslautstärke, vom Nutzer gewählt. */
export type Environment = 'veryQuiet' | 'quiet' | 'medium' | 'loud' | 'veryLoud';

export const ENVIRONMENTS: readonly Environment[] = ['veryQuiet', 'quiet', 'medium', 'loud', 'veryLoud'];

/** Geschätztes Raumrauschen am Mikro (dBFS, vor der Verstärkung). */
const NOISE_DB: Record<Environment, number> = {
  veryQuiet: -72,
  quiet: -64,
  medium: -56,
  loud: -48,
  veryLoud: -42,
};

/** Geschätzter Sprachpegel (laut gesprochen) bei 0,5 m Abstand, dBFS vor der Verstärkung. */
const SPEECH_AT_HALF_METER = -26;

export interface PresetResult {
  gainDb: number;
  gateDb: number;
  minConfidence: number;
  noiseSuppression: boolean;
}

/**
 * Einstellungen aus Entfernung (Meter) und Umgebung – ohne Messung.
 * Sprache fällt mit 6 dB pro Entfernungs-Verdopplung; Verstärkung bringt sie auf ca. −20 dBFS,
 * das Gate liegt zwischen Raumrauschen und Stimme (näher am Rauschen).
 */
export function presetCalibration(distanceM: number, env: Environment): PresetResult {
  const d = Math.max(0.3, Math.min(6, distanceM));
  const speech = SPEECH_AT_HALF_METER - 20 * Math.log10(d / 0.5);
  const gainDb = Math.round(Math.max(0, Math.min(MAX_GAIN_DB, SPEECH_TARGET_DB - speech)));
  const noise = NOISE_DB[env] + gainDb;
  const voice = speech + gainDb;
  const gap = Math.max(0, voice - noise);
  const gateDb = Math.round(Math.max(-75, Math.min(-25, noise + Math.max(4, gap * 0.4))));
  const loudness = ENVIRONMENTS.indexOf(env);
  return {
    gainDb,
    gateDb,
    // in lauter Umgebung strenger, damit Gerede seltener als Zahl durchgeht
    minConfidence: [0.5, 0.52, 0.55, 0.62, 0.68][loudness]!,
    noiseSuppression: true,
  };
}
