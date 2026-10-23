import { db, type StoredMatch } from './db';
import type { Settings } from '../settings/types';

export interface ExportFile {
  app: 'oche';
  version: 1;
  exportedAt: number;
  settings: Settings;
  matches: StoredMatch[];
}

export async function buildExport(settings: Settings): Promise<ExportFile> {
  const matches = await db.matches.toArray();
  return { app: 'oche', version: 1, exportedAt: Date.now(), settings, matches };
}

export function parseExport(text: string): ExportFile {
  const data: unknown = JSON.parse(text);
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { app?: unknown }).app !== 'oche' ||
    !Array.isArray((data as { matches?: unknown }).matches)
  ) {
    throw new Error('Keine Oche-Exportdatei');
  }
  return data as ExportFile;
}

/** Fügt Matches hinzu (gleiche IDs werden überschrieben). Gibt die Anzahl importierter Matches zurück. */
export async function importMatches(file: ExportFile): Promise<number> {
  await db.matches.bulkPut(file.matches);
  return file.matches.length;
}
