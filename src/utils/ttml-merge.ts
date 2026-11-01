import { diff3Merge } from "node-diff3";

// -- Types --------------------------------------------------------------------

type RebaseResult = { status: "clean"; content: string } | { status: "conflict" };

// -- Functions ----------------------------------------------------------------

function rebaseTtmlEdits(base: string, mine: string, next: string): RebaseResult {
  const regions = diff3Merge(mine, base, next, {
    stringSeparator: "\n",
    excludeFalseConflicts: true,
  });

  if (regions.some((region) => region.conflict !== undefined)) {
    return { status: "conflict" };
  }

  const lines = regions.flatMap((region) => region.ok ?? []);
  return { status: "clean", content: lines.join("\n") };
}

// -- Exports ------------------------------------------------------------------

export { rebaseTtmlEdits };
