// Lexikon (S6): Varianten und Fehlhörer, Füllwörter und die Hilfe „Was kann ich sagen?“.
// Zahlwörter selbst kommen aus numbers.de.ts, Befehle aus commands.ts – beide nutzen dieses Lexikon.

/** Eingebaute Aliase: gesprochenes Wort → kanonisches Wort (vor dem Parsen ersetzt). */
export const BUILTIN_ALIASES: Readonly<Record<string, string>> = {
  zwo: 'zwei', // deutlicher als „zwei“, darf man so sagen
};

/** Füllwörter werden ignoriert („Wurf äh sechzig“). */
export const FILLERS: readonly string[] = ['äh', 'ähm', 'also'];

/** Wörter für 0 Punkte (nach dem Triggerwort). */
export const ZERO_WORDS: readonly string[] = ['null', 'nichts', 'nix', 'vorbei', 'daneben'];

/** „[Triggerwort] zurück“: letzte Aufnahme rückgängig. */
export const UNDO_WORDS: readonly string[] = ['zurück'];

/** Tokens normalisieren: Füllwörter raus, Aliase (eingebaut + gelernt) ersetzen. */
export function normalizeTokens(
  tokens: readonly string[],
  learned: Readonly<Record<string, string>> = {},
): string[] {
  return tokens
    .filter((t) => !FILLERS.includes(t))
    .map((t) => learned[t] ?? BUILTIN_ALIASES[t] ?? t)
    .flatMap((t) => t.split(' ')); // gelernte Aliase dürfen mehrere Wörter ergeben („sehen“ → „zehn“)
}

export interface HelpEntry {
  say: string;
  does: string;
}

/** Hilfe-Seite – aus derselben Quelle wie Grammatik und Parser. */
export function helpEntries(trigger: string): HelpEntry[] {
  const T = trigger.charAt(0).toUpperCase() + trigger.slice(1);
  return [
    { say: `${T} sechzig, ${T} hundertachtzig`, does: 'Punkte der Aufnahme eintragen' },
    { say: `${T} hundert einundvierzig`, does: 'Zahlen über 100 auch in zwei Teilen' },
    {
      say: `${T} null, ${T} nichts, ${T} daneben`,
      does: '0 Punkte (zu viel geworfen? Die App erkennt Bust selbst)',
    },
    { say: `${T} zwo`, does: '2 – „zwo“ ist deutlicher als „zwei“' },
    { say: `${T} … (kurze Pause) … sechzig`, does: 'Triggerwort und Zahl dürfen getrennt kommen' },
    { say: `${T} zurück`, does: 'Letzte Aufnahme rückgängig' },
  ];
}
