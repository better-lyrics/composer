import type { ReadingUnit } from "@/audio/alignment/hubertfa/g2p";
import { pinyinSyllables, plainWords, romajiLine } from "@/audio/alignment/hubertfa/romanization";
import type { HanReading } from "@/domain/alignment/language";

// -- Functions ----------------------------------------------------------------

/**
 * The transliteration says what's sung; the dictionaries only say which
 * characters sing it. Line the transliteration's syllables up with the
 * dictionary readings (an edit-distance alignment, with English words as
 * anchors) and give each Chinese/Japanese unit the syllables that landed on
 * it. Where they agree nothing changes; where they differ (運命 sung as
 * "sadame", a kanji the tokenizer couldn't read) the transliteration wins.
 * Per-part transliterations aren't trusted on their own: imported lyrics
 * often pair them with the wrong characters, while the line as a whole reads
 * correctly.
 */
function applyLineTransliteration(
  units: ReadingUnit[],
  text: string,
  hanReading: HanReading,
  isMora: (key: string) => boolean,
) {
  const english = new Set(units.filter((u) => u.language === "en").flatMap((u) => plainWords(u.text)));
  const target: string[] = [];
  const words =
    hanReading === "zh" ? pinyinSyllables(text).map((word) => ({ word, morae: [word] })) : romajiLine(text, isMora);
  for (const { word, morae } of words) {
    const plain = word.replaceAll("'", "");
    if (english.has(plain)) target.push(`en:${plain}`);
    else if (morae) target.push(...morae);
  }
  const source: { token: string; unit: number }[] = [];
  units.forEach((unit, u) => {
    // A language reader's units are read from their own spelling and take no syllables.
    if (unit.language === "reader") return;
    if (unit.language === "en") {
      for (const token of plainWords(unit.text)) source.push({ token: `en:${token}`, unit: u });
    } else if (unit.reading) {
      for (const token of unit.reading) source.push({ token, unit: u });
    } else {
      // Unknown reading: one placeholder, so the alignment hands it whatever is opposite.
      source.push({ token: "\u0000", unit: u });
    }
  });
  if (target.length === 0 || source.length === 0) return;

  // Edit-distance table, then walk back assigning each target token to a unit.
  const n = source.length;
  const m = target.length;
  const cost = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = source[i - 1].token === target[j - 1] ? 0 : 1;
      cost[i][j] = Math.min(cost[i - 1][j - 1] + same, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const assigned: string[][] = units.map(() => []);
  let i = n;
  let j = m;
  while (j > 0) {
    if (i > 0 && cost[i][j] === cost[i - 1][j - 1] + (source[i - 1].token === target[j - 1] ? 0 : 1)) {
      assigned[source[i - 1].unit].unshift(target[j - 1]);
      i--;
      j--;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      i--;
    } else {
      // Extra transliteration syllable: it belongs to the unit before (or the first).
      assigned[source[Math.max(0, i - 1)].unit].unshift(target[j - 1]);
      j--;
    }
  }
  units.forEach((unit, u) => {
    const reading = assigned[u].filter((t) => !t.startsWith("en:"));
    if (unit.language !== "en" && reading.length > 0) unit.reading = reading;
  });
}

// -- Exports ------------------------------------------------------------------

export { applyLineTransliteration };
