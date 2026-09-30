import type { LyricLine } from "@/domain/line/model";
import type { TtmlEditState } from "@/stores/project/types";
import { type LineKeyIds, lineKeyIds, pickLineKeyIds, renumberLineKeys } from "@/utils/ttml-line-keys";

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
  if (previous?.lineKeyIds === null) return { source: generated, content, lineKeyIds: null };
  const continued = previous?.source === generated ? previous.lineKeyIds : undefined;
  return { source: generated, content, lineKeyIds: continued ?? lineKeyIds(lines) };
}

function keptTtmlEdits(edit: TtmlEdit, generated: string, lines: readonly LyricLine[]): TtmlEdit {
  const from = recordedLineKeyIds(edit, generated, lines);
  if (from === null || edit.source === generated) {
    return { source: generated, content: edit.content, lineKeyIds: from };
  }
  const to = lineKeyIds(lines);
  const knownIds = new Set(Object.values(from));
  return {
    source: generated,
    content: renumberLineKeys(edit.content, from, to),
    lineKeyIds: pickLineKeyIds(to, (id) => knownIds.has(id)),
  };
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
