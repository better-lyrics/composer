import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SLICE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../stores/project");

const HISTORY_WRITERS = /\b(commitHistory|commitSnapPointEdit|commitPendingEdit|undoState|redoState)\b/;
const SNAPSHOT_FIELD_WRITE = /(?<![.\w])(lines|groups|agents|customSnapPoints)\s*[:,}]/;
const OPAQUE_SPREAD = /\.\.\.(?!state\b)[A-Za-z_]\w*/;

const ALLOWED: Record<string, string> = {
  setTransientLines: "gesture preview; the caller restores or commits through history before the gesture ends",
  moveCustomSnapPoint: "drag preview; commitSnapPointDrag records the drag as one entry",
  setCustomSnapPoints: "project load, which starts from an empty history",
  reset: "a fresh project starts from an empty history",
  setMetadata: "spreads metadata only, which history does not snapshot",
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
