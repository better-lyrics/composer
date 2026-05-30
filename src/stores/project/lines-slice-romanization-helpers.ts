import { type LyricLine, reconcileLine, type RomanizationData } from "@/domain/line/model";
import { commitHistory } from "@/stores/project/history-helpers";
import type { ProjectState } from "@/stores/project/types";

// -- Types --------------------------------------------------------------------

type RomanizationStateChange = Partial<ProjectState>;

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

function computeRomanizationUpdate(
  state: ProjectState,
  lineId: string,
  romanization: RomanizationData | undefined,
): { next: LyricLine[]; unchanged: boolean } {
  const next = writeRomanization(state.lines, lineId, romanization);
  return { next, unchanged: next === state.lines };
}

// -- Slice actions ------------------------------------------------------------

function applyRomanization(
  state: ProjectState,
  lineId: string,
  romanization: RomanizationData | undefined,
): RomanizationStateChange | ProjectState {
  const { next, unchanged } = computeRomanizationUpdate(state, lineId, romanization);
  if (unchanged) return state;
  return { lines: next, isDirty: true, isDirtySinceHistory: true };
}

function applyRomanizationWithHistory(
  state: ProjectState,
  lineId: string,
  romanization: RomanizationData | undefined,
): RomanizationStateChange | ProjectState {
  const { next, unchanged } = computeRomanizationUpdate(state, lineId, romanization);
  if (unchanged) return state;
  return commitHistory(state, { lines: next });
}

// -- Exports ------------------------------------------------------------------

export { applyRomanization, applyRomanizationWithHistory };
