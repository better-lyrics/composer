import { isLineSynced, isWordSynced } from "@/domain/line/predicates";
import type { LyricLine } from "@/stores/project";

// -- Types --------------------------------------------------------------------

type LineClass = "line-synced" | "word-synced" | "untimed";

// -- Functions ----------------------------------------------------------------

function classify(line: LyricLine): LineClass {
  if (isWordSynced(line)) return "word-synced";
  if (isLineSynced(line)) return "line-synced";
  return "untimed";
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

// -- Exports ------------------------------------------------------------------

export { assertNever, classify };
export type { LineClass };
