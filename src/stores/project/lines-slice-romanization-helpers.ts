import { type LyricLine, reconcileLine, type RomanizationData } from "@/domain/line/model";
import { commitHistory } from "@/stores/project/history-helpers";
import type { LinesState, ProjectState } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

type RomanizationStateChange = Partial<LinesState & { isDirty: boolean; isDirtySinceHistory: boolean }>;

// -- Internal -----------------------------------------------------------------

function writeRomanization(
  lines: LyricLine[],
  lineId: string,
  romanization: RomanizationData | undefined,
): LyricLine[] {
  let changed = false;
  const next = lines.map((line) => {
    if (line.id !== lineId) return line;
    if (line.romanization === romanization) return line;
    changed = true;
    return reconcileLine({ ...line, romanization });
  });
  return changed ? next : lines;
}

function assertRomanizationText(romanization: RomanizationData | undefined): void {
  if (romanization && !romanization.text) {
    throw new Error("Romanization text cannot be empty");
  }
}

// -- Slice actions ------------------------------------------------------------

function applyRomanization(
  state: ProjectState,
  lineId: string,
  romanization: RomanizationData | undefined,
): RomanizationStateChange | ProjectState {
  assertRomanizationText(romanization);
  const next = writeRomanization(state.lines, lineId, romanization);
  if (next === state.lines) return state;
  return { lines: next, isDirty: true, isDirtySinceHistory: true };
}

function applyRomanizationWithHistory(
  state: ProjectState,
  lineId: string,
  romanization: RomanizationData | undefined,
): RomanizationStateChange | ProjectState {
  assertRomanizationText(romanization);
  const next = writeRomanization(state.lines, lineId, romanization);
  if (next === state.lines) return state;
  return commitHistory(state, { lines: next });
}

// -- Exports ------------------------------------------------------------------

export { applyRomanization, applyRomanizationWithHistory };
