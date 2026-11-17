import { extractionSlot, scanParenGroups } from "insync/background-vocal-extraction";
import { extractBackgroundVocalsOnLines } from "insync/background-vocal-typed-extraction";
import { type ShownEditText, shownEditText } from "insync/edit-text-shown-row";
import type { LyricLine } from "insync/line";
import { shownWithRewrittenRows } from "@/domain/edit-text/background-ranges";
import { rowAt, rowCount } from "@/domain/edit-text/text-rows";
import { useSettingsStore } from "@/stores/settings";
import { settingsExtractOptions } from "@/stores/settings-extract-options";

// -- Types --------------------------------------------------------------------

// The text as typed and where the caret is in it.
interface TypingAt {
  text: string;
  caret: number;
}

interface TypedEdit {
  finalLines: LyricLine[];
  shown: ShownEditText;
  // The line whose bracket group waits because the caret is still typing inside it.
  heldLineId?: string;
}

// -- Functions ----------------------------------------------------------------

const rowsMatchLines = (typed: TypedEdit) => rowCount(typed.shown.text) === typed.finalLines.length;

// Rows the commit left alone stay as typed; only rows it rewrote show the committed line.
function shownAfterCommit(typed: TypedEdit, committed: readonly LyricLine[], splitCharacter: string): ShownEditText {
  if (!rowsMatchLines(typed) || committed.length !== typed.finalLines.length) {
    return shownEditText(committed, splitCharacter);
  }
  return shownWithRewrittenRows(typed.shown, typed.finalLines, committed, splitCharacter);
}

// The row the caret is typing in, when it sits inside a bracket group: that group is still being typed.
function rowTypingInGroup(typing: TypingAt): number | null {
  const row = rowAt(typing.text, typing.caret);
  const rowStart = typing.text.lastIndexOf("\n", typing.caret - 1) + 1;
  const rowEnd = typing.text.indexOf("\n", typing.caret);
  const offset = typing.caret - rowStart;
  const { groups } = scanParenGroups(typing.text.slice(rowStart, rowEnd === -1 ? undefined : rowEnd));
  return groups.some((group) => group.start < offset && offset <= group.end) ? row : null;
}

// Brackets typed on a row become its background as soon as they close, as a paste extracts them; only the lines the
// keystroke changed are read, and only their rows are shown again. A group the caret is still typing inside waits with
// every linked instance of its line, which extract together, so a space typed there is never trimmed under the caret.
function withTypedBackgroundsExtracted(
  before: readonly LyricLine[],
  typed: TypedEdit,
  splitCharacter: string,
  songEnd: number,
  typing: TypingAt,
): TypedEdit {
  if (!useSettingsStore.getState().autoExtractBackgroundVocals) return typed;
  if (!rowsMatchLines(typed)) return typed;
  const held = new Set(before);
  const typingRow = rowTypingInGroup(typing);
  const typingSlot = typingRow === null ? null : extractionSlot(typed.finalLines[typingRow]);
  const waits = (line: LyricLine, index: number) =>
    index === typingRow || (typingSlot !== null && extractionSlot(line) === typingSlot);
  const changedIds = new Set(
    typed.finalLines.flatMap((line, index) => (held.has(line) || waits(line, index) ? [] : [line.id])),
  );
  const waiting = typingRow === null ? typed : { ...typed, heldLineId: typed.finalLines[typingRow].id };
  if (changedIds.size === 0) return waiting;
  const finalLines = extractBackgroundVocalsOnLines(
    typed.finalLines,
    changedIds,
    settingsExtractOptions(),
    splitCharacter,
    songEnd,
  );
  if (finalLines === typed.finalLines) return waiting;
  const shown = shownWithRewrittenRows(typed.shown, typed.finalLines, finalLines, splitCharacter);
  return { ...waiting, finalLines, shown };
}

// -- Exports ------------------------------------------------------------------

export type { TypedEdit };
export { rowTypingInGroup, shownAfterCommit, withTypedBackgroundsExtracted };
