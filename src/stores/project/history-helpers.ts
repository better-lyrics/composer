import type { LyricLine } from "@/domain/line/model";
import { withDerivedText } from "@/domain/line/reconstruct-text";
import type { LinkGroup } from "@/domain/group/template";
import type { ProjectState } from "@/stores/project/types";
import { getSplitCharacter } from "@/utils/split-character";

// -- Constants ----------------------------------------------------------------

const MAX_HISTORY_SIZE = 100;

// -- History Helper -----------------------------------------------------------

function commitHistory(state: ProjectState, changes: { lines?: LyricLine[]; groups?: LinkGroup[] }) {
  const splitChar = getSplitCharacter();
  const nextLines = changes.lines ? changes.lines.map((line) => withDerivedText(line, splitChar)) : state.lines;
  const nextGroups = changes.groups ?? state.groups;

  const newHistory = state.history.slice(0, state.historyIndex + 1);
  if (newHistory.length === 0 || state.isDirtySinceHistory) {
    newHistory.push({
      lines: structuredClone(state.lines),
      groups: structuredClone(state.groups),
      timestamp: Date.now(),
    });
  }
  newHistory.push({
    lines: structuredClone(nextLines),
    groups: structuredClone(nextGroups),
    timestamp: Date.now(),
  });
  if (newHistory.length > MAX_HISTORY_SIZE) newHistory.shift();
  return {
    lines: nextLines,
    groups: nextGroups,
    isDirty: true,
    isDirtySinceHistory: false,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

// -- Exports ------------------------------------------------------------------

export { MAX_HISTORY_SIZE, commitHistory };
