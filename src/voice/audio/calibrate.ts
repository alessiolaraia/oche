import { useSettings } from '../../store/settings';
import { forwardLevels, getPipeline, onLevel } from '../control';
import { AudioPipeline } from './pipeline';

export { computeCalibration, SPEECH_TARGET_DB, MAX_GAIN_DB, type CalibrationResult } from './calibrationMath';

/** Sammelt Pegel für `ms` Millisekunden. */
export function collectLevels(
  ms: number,
  onTick?: (remainingMs: number, db: number) => void,
): Promise<number[]> {
  return new Promise((resolve) => {
    const values: number[] = [];
    const end = Date.now() + ms;
    const off = onLevel((l) => {
      values.push(l.db);
      onTick?.(Math.max(0, end - Date.now()), l.db);
    });
    setTimeout(() => {
      off();
      resolve(values);
    }, ms);
  });
}

/**
 * Stellt sicher, dass eine Pipeline läuft (bei Web-Speech-Engine gibt es keine eigene),
 * und liefert eine Aufräumfunktion.
 */
export async function ensurePipeline(): Promise<() => void> {
  if (getPipeline()) return () => {};
  const v = useSettings.getState().voice;
  const temp = await AudioPipeline.create({
    gainDb: v.gainDb,
    gateDb: v.gateDb,
    noiseSuppression: v.noiseSuppression,
    autoGainControl: v.autoGainControl,
  });
  temp.onLevel = forwardLevels;
  return () => temp.stop();
}
