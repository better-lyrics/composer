import type { LyricLine } from "@/domain/line/model";
import { reconcileLine } from "@/domain/line/model";

// -- Types --------------------------------------------------------------------

interface V1RomanizationShape {
  text: string;
  words?: Array<{ text: string }>;
  wordTexts?: string[];
  source: "manual" | "generated";
}

type LineWithLegacyRomanization = Omit<LyricLine, "romanization"> & { romanization?: V1RomanizationShape };

interface SavedProjectShape {
  lines?: LineWithLegacyRomanization[];
}

// -- Migration ----------------------------------------------------------------

function migrateSavedProjectRomanization<T extends SavedProjectShape>(project: T): T {
  const inputLines = project.lines;
  if (!inputLines || inputLines.length === 0) return project;

  let changed = false;
  const migrated = inputLines.map((line) => {
    const r = line.romanization;
    if (!r) return line;
    if (r.wordTexts !== undefined) return line;
    if (r.words === undefined) return line;

    changed = true;
    const wordTexts = r.words.map((w) => w.text);
    const { words: _legacyWords, ...rest } = r;
    return reconcileLine({ ...line, romanization: { ...rest, wordTexts } }) as LineWithLegacyRomanization;
  });

  if (!changed) return project;
  return { ...project, lines: migrated };
}

// -- Exports ------------------------------------------------------------------

export { migrateSavedProjectRomanization };
