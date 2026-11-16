import type { ExtractOptions } from "insync/background-vocal-extraction";
import { extractBackgroundVocalsOnLines } from "insync/background-vocal-typed-extraction";
import type { ShownEditText } from "insync/edit-text-shown-row";
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

// Brackets typed on a row become its background as soon as they close, as a paste extracts them; only the lines the
// keystroke changed are read, and only their rows are shown again.
function withTypedBackgroundsExtracted(
  before: readonly LyricLine[],
  typed: TypedEdit,
  splitCharacter: string,
  songEnd: number,
): TypedEdit {
  if (!useSettingsStore.getState().autoExtractBackgroundVocals) return typed;
  if (typed.shown.text.split("\n").length !== typed.finalLines.length) return typed;
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

export { settingsExtractOptions, withTypedBackgroundsExtracted };
