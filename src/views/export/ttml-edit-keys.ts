import type { LyricLine } from "@/domain/line/model";
import type { TtmlEditState } from "@/stores/project/types";
import { type LineKeyIds, lineKeyIds, renumberLineKeys } from "@/utils/ttml-line-keys";

// -- Types --------------------------------------------------------------------

type TtmlEdit = NonNullable<TtmlEditState>;

// -- Helpers ------------------------------------------------------------------

function recordedLineKeyIds(edit: TtmlEdit, generated: string, lines: readonly LyricLine[]): LineKeyIds | null {
  if (edit.lineKeyIds !== undefined) return edit.lineKeyIds;
  return edit.source === generated ? lineKeyIds(lines) : null;
}

// -- Functions ----------------------------------------------------------------

function startedTtmlEdit(
  previous: TtmlEditState,
  generated: string,
  content: string,
  lines: readonly LyricLine[],
): TtmlEdit {
  return { source: generated, content, lineKeyIds: previous?.lineKeyIds === null ? null : lineKeyIds(lines) };
}

function keptTtmlEdits(edit: TtmlEdit, generated: string, lines: readonly LyricLine[]): TtmlEdit {
  const from = recordedLineKeyIds(edit, generated, lines);
  if (from === null || edit.source === generated) {
    return { source: generated, content: edit.content, lineKeyIds: from };
  }
  const to = lineKeyIds(lines);
  return { source: generated, content: renumberLineKeys(edit.content, from, to), lineKeyIds: to };
}

function contentLineKeyIds(
  edit: TtmlEditState,
  content: string,
  lines: readonly LyricLine[],
  generated: string,
): LineKeyIds | null {
  if (edit?.lineKeyIds === null) return null;
  if (!edit || edit.content !== content) return lineKeyIds(lines);
  return recordedLineKeyIds(edit, generated, lines);
}

// -- Exports ------------------------------------------------------------------

export { contentLineKeyIds, keptTtmlEdits, startedTtmlEdit };
