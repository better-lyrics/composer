import { type ReadableLine, rawLineOf } from "@/domain/line/effective-words";
import { fieldsOfLine, type LineFields, lineFromFields } from "@/domain/line/line-from-fields";
import type { LineUpdate, LyricLine } from "@/domain/line/model";
import { hasAnyTiming } from "@/domain/line/predicates";
import { mainTrack } from "@/domain/line/track";
import { withMainTrack, withRoleWords, withTrackText } from "@/domain/line/track-writes";
import { withUntimedIdsOf } from "@/domain/line/untimed-ids";
import { useProjectStore } from "@/stores/project";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

// Tests spell line patches the way version 3 records spell lines: flat text, words and background fields.
type FieldPatch = Partial<Omit<LineFields, "id">>;

interface FieldUpdate {
  id: string;
  updates: FieldPatch;
}

// -- Functions ----------------------------------------------------------------

// Text patched without words is typed text: it is read against the timed syllables, as Edit reads it.
// Words patched without their text are a word write: the untimed rest stays, as every word writer keeps it.
function withFields(line: LyricLine, patch: FieldPatch): LyricLine {
  const typesMain = "text" in patch && !("words" in patch) && !("begin" in patch) && hasAnyTiming(line);
  const writesMain = !!patch.words?.length && !("text" in patch);
  const writesBackground = !!patch.backgroundWords?.length && !("backgroundText" in patch);
  const { text, words, backgroundWords, ...rest } = patch;
  const fields = {
    ...rest,
    ...(!typesMain && "text" in patch && { text }),
    ...(!writesMain && "words" in patch && { words }),
    ...(!writesBackground && "backgroundWords" in patch && { backgroundWords }),
  };
  let next = withUntimedIdsOf(lineFromFields({ ...fieldsOfLine(line), ...fields }), line);
  if (typesMain) next = withMainTrack(next, withTrackText(mainTrack(next), text ?? ""));
  if (writesMain && words) next = withRoleWords(next, "main", words);
  if (writesBackground && backgroundWords) next = withRoleWords(next, "bg", backgroundWords);
  return next;
}

// The track update a writer makes for a flat patch, against the lines it lands on (the store by default).
function fieldUpdates(
  patches: readonly FieldUpdate[],
  lines: readonly LyricLine[] = useProjectStore.getState().lines,
): LineUpdate[] {
  return patches.map(({ id, updates }) => {
    const line = lines.find((candidate) => candidate.id === id);
    if (!line) throw new Error(`fieldUpdates: no line ${id}`);
    const { tracks, languages } = withFields(line, updates);
    return { id, updates: { tracks, ...("languages" in updates && { languages }) } };
  });
}

// The line an update writes, read from the whole tracks it carries; nothing when it writes no tracks.
function updatedLine(updates: Partial<LyricLine> | undefined): LyricLine | undefined {
  return updates?.tracks && { id: "updated", tracks: updates.tracks };
}

// A line update read back as flat fields, after it lands on its line.
function fieldsAfter(update: LineUpdate, lines: readonly LyricLine[]): LineFields {
  const line = lines.find((candidate) => candidate.id === update.id);
  if (!line) throw new Error(`fieldsAfter: no line ${update.id}`);
  return fieldsOfLine({ ...line, ...update.updates });
}

// Line updates read back as the flat fields they change, the way version 3 writers spelled their patches.
function changedFields(updates: readonly LineUpdate[], lines: readonly LyricLine[]): FieldUpdate[] {
  return updates.map((update) => {
    const line = lines.find((candidate) => candidate.id === update.id);
    if (!line) throw new Error(`changedFields: no line ${update.id}`);
    const before: Record<string, unknown> = { ...fieldsOfLine(line) };
    const after: Record<string, unknown> = { ...fieldsAfter(update, lines) };
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changed = [...keys].filter((key) => !isStructurallyEqual(before[key], after[key]));
    return { id: update.id, updates: Object.fromEntries(changed.map((key) => [key, after[key]])) };
  });
}

// The flat fields one write changes on the stored line behind the line it was made for.
function patchOf(updates: Partial<LyricLine> | null | undefined, line: ReadableLine): FieldPatch {
  if (!updates) throw new Error("patchOf: no write");
  const raw = rawLineOf(line);
  return changedFields([{ id: raw.id, updates }], [raw])[0].updates;
}

// -- Exports ------------------------------------------------------------------

export type { FieldPatch };
export { changedFields, fieldUpdates, patchOf, updatedLine, withFields };
