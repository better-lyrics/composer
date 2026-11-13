import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SLICE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../stores/project");

const HISTORY_WRITERS =
  /\b(amendCurrentStep|commitCommand|commitHistory|commitSnapPointEdit|commitPendingEdit|undoState|redoState)\b/;
const SNAPSHOT_FIELD_WRITE = /(?<![.\w])(lines|groups|agents|customSnapPoints|beatGrid)\s*[:,}]/;
const OPAQUE_SPREAD = /\.\.\.(?!state\b)[A-Za-z_]\w*/;

const ALLOWED: Record<string, string> = {
  previewLines: "gesture preview; the caller restores or commits through history before the gesture ends",
  restorePreviewLines: "puts back the pre-gesture lines a preview replaced, which history already holds",
  moveCustomSnapPoint: "drag preview; commitSnapPointDrag records the drag as one entry",
  setCustomSnapPoints: "project load, which starts from an empty history",
  reset: "a fresh project starts from an empty history",
  setMetadata: "spreads metadata only, which history does not snapshot",
};

const LYRIC_FIELD_WRITE = /(?<![.\w])(lines|groups)\s*[:,}]/;
const LYRIC_HISTORY_WRITE = /\b(commitCommand|undoState|redoState)\b/;

const LYRIC_WRITERS: Record<string, string> = {
  commit: "runs a named command, the one write path for lyric edits",
  undo: "swaps in a history root, recording no command",
  redo: "swaps in a history root, recording no command",
  restoreLyrics: "loads and restores, which start from an empty or cleared history",
  previewLines: "gesture preview; the caller restores or commits through history before the gesture ends",
  restorePreviewLines: "puts back the pre-gesture lines a preview replaced, which history already holds",
  replaceLyricsWithHistory: "commits the replace-lyrics command and its song details in one write",
  applyEditedLyricsWithHistory: "commits the edited-lyrics command and its song details in one write",
};

interface SliceAction {
  name: string;
  body: string;
}

function sliceActions(): SliceAction[] {
  const actions: SliceAction[] = [];
  for (const file of readdirSync(SLICE_DIR)) {
    if (!file.endsWith("-slice.ts")) continue;
    const src = readFileSync(join(SLICE_DIR, file), "utf8");
    const starts = [...src.matchAll(/^ {2}(\w+):/gm)];
    starts.forEach((match, index) => {
      const end = starts[index + 1]?.index ?? src.length;
      actions.push({ name: `${file}:${match[1]}`, body: src.slice(match.index, end) });
    });
  }
  return actions;
}

function writesSnapshotOutsideHistory({ body }: SliceAction): boolean {
  if (!/\bset\(/.test(body) || HISTORY_WRITERS.test(body)) return false;
  return SNAPSHOT_FIELD_WRITE.test(body) || OPAQUE_SPREAD.test(body);
}

const actionName = (action: SliceAction) => action.name.split(":")[1];

function writesLyrics({ body }: SliceAction): boolean {
  if (!/\b_?set\(/.test(body)) return false;
  return LYRIC_FIELD_WRITE.test(body) || LYRIC_HISTORY_WRITE.test(body);
}

describe("snapshot writes outside history flag the pending snapshot", () => {
  it("every slice write of lines, groups, agents or snap points outside history sets isDirtySinceHistory", () => {
    const offenders = sliceActions()
      .filter(writesSnapshotOutsideHistory)
      .filter((action) => !(actionName(action) in ALLOWED) && !/isDirtySinceHistory:\s*true/.test(action.body))
      .map((action) => action.name);
    expect(offenders).toEqual([]);
  });

  it("every allowlisted action still exists and still writes outside history", () => {
    const flagged = new Set(sliceActions().filter(writesSnapshotOutsideHistory).map(actionName));
    expect(Object.keys(ALLOWED).filter((name) => !flagged.has(name))).toEqual([]);
  });
});

describe("lines and groups change only through commit, restores and previews", () => {
  it("no other slice action writes lines or groups", () => {
    const offenders = sliceActions()
      .filter(writesLyrics)
      .filter((action) => !(actionName(action) in LYRIC_WRITERS))
      .map((action) => action.name);
    expect(offenders).toEqual([]);
  });

  it("every allowlisted lyric writer still exists and still writes lyrics", () => {
    const writers = new Set(sliceActions().filter(writesLyrics).map(actionName));
    expect(Object.keys(LYRIC_WRITERS).filter((name) => !writers.has(name))).toEqual([]);
  });
});
