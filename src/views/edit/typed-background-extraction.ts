import type { ExtractOptions } from "insync/background-vocal-extraction";
import { extractBackgroundVocalsOnLines } from "insync/background-vocal-typed-extraction";
import { type ShownEditText, shownEditText } from "insync/edit-text-shown-row";
import type { LyricLine } from "insync/line";
import { shownWithRewrittenRows } from "@/domain/edit-text/background-ranges";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface TypedEdit {
  finalLines: LyricLine[];
  shown: ShownEditText;
}

// -- Functions ----------------------------------------------------------------

function settingsExtractOptions(): ExtractOptions {
  const settings = useSettingsStore.getState();
  return {
    mergeStandaloneLines: settings.mergeStandaloneBackgroundLines,
    preserveBrackets: settings.preserveBracketsOnExtraction,
  };
}

const rowsMatchLines = (typed: TypedEdit) => typed.shown.text.split("\n").length === typed.finalLines.length;

// Rows the commit left alone stay as typed; only rows it rewrote show the committed line.
function shownAfterCommit(typed: TypedEdit, committed: readonly LyricLine[], splitCharacter: string): ShownEditText {
  if (!rowsMatchLines(typed) || committed.length !== typed.finalLines.length) {
    return shownEditText(committed, splitCharacter);
  }
  return shownWithRewrittenRows(typed.shown, typed.finalLines, committed, splitCharacter);
}

// Brackets typed on a row become its background as soon as they close, as a paste extracts them; only the lines the
// keystroke changed are read, and only their rows are shown again.
function withTypedBackgroundsExtracted(
  before: readonly LyricLine[],
  typed: TypedEdit,
  splitCharacter: string,
  songEnd: number,
): TypedEdit {
  if (!useSettingsStore.getState().autoExtractBackgroundVocals) return typed;
  if (!rowsMatchLines(typed)) return typed;
  const held = new Set(before);
  const changedIds = new Set(typed.finalLines.flatMap((line) => (held.has(line) ? [] : [line.id])));
  if (changedIds.size === 0) return typed;
  const finalLines = extractBackgroundVocalsOnLines(
    typed.finalLines,
    changedIds,
    settingsExtractOptions(),
    splitCharacter,
    songEnd,
  );
  if (finalLines === typed.finalLines) return typed;
  return { finalLines, shown: shownWithRewrittenRows(typed.shown, typed.finalLines, finalLines, splitCharacter) };
}

// -- Exports ------------------------------------------------------------------

export type { TypedEdit };
export { settingsExtractOptions, shownAfterCommit, withTypedBackgroundsExtracted };
