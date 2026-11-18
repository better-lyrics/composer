import { pluralWord, pluralize } from "insync/pluralize";
import type { ParsedLine } from "@/views/edit/parse-lyrics";

// -- Functions ----------------------------------------------------------------

function linesKeepingBracketsAsText(parsed: readonly ParsedLine[]): ParsedLine[] {
  return parsed.filter((line) => line.backgroundBracketRefusal);
}

function bracketsStatus(extractableCount: number, keptAsTextCount: number): string {
  if (extractableCount > 0) {
    return `${pluralize(extractableCount, "line")} ${pluralWord(extractableCount, "still has", "still have")} ( )`;
  }
  if (keptAsTextCount > 0) {
    return `${pluralize(keptAsTextCount, "line")} ${pluralWord(keptAsTextCount, "keeps", "keep")} ( ) as text`;
  }
  return "No ( ) left in the lyrics";
}

// -- Exports ------------------------------------------------------------------

export { bracketsStatus, linesKeepingBracketsAsText };
