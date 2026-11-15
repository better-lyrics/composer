import type { LyricCommand } from "@/domain/commands/command";
import { withLineUpdates } from "@/domain/commands/line-edits";
import { applied, refused } from "@/domain/commands/outcome";
import { withAlignedWords } from "insync/language-align";
import { regroupedLanguages } from "insync/language-pieces";
import type { LineUpdate, LyricLine } from "insync/line";
import { fieldRole, fieldWords, type TrackField, trackField } from "insync/line-track";
import { withFieldWords } from "insync/line-word-track-edits";
import type { SyllableAddress } from "insync/selection-model";
import { resolveAddresses } from "@/domain/selection/resolve";
import { mergeWordRun } from "insync/word-merge-run";

// -- Helpers ------------------------------------------------------------------

function mergedFieldUpdate(
  line: LyricLine,
  field: TrackField,
  indices: number[],
  splitChar: string,
): LineUpdate | null {
  const aligned = withAlignedWords(line, splitChar);
  const words = fieldWords(aligned, field);
  const merged = words && mergeWordRun(words, indices);
  if (!merged) return null;
  const languages = regroupedLanguages(line, aligned, fieldRole(field), words, merged);
  const { tracks } = withFieldWords(line, field, merged, splitChar);
  return { id: line.id, updates: { tracks, languages } };
}

// -- Commands -----------------------------------------------------------------

// The addresses name one run of words on one track of one line. Other instances of a group line merge the same text
// through its template.
function mergeWords(addresses: readonly SyllableAddress[]): LyricCommand {
  return {
    note: { command: "merge words", args: addresses.map((address) => address.syllableId) },
    copiesSharedTiming: true,
    run: (root, ctx) => {
      const resolved = resolveAddresses(root.lines, addresses, ctx.splitChar);
      if (resolved.length === 0 || resolved.length !== addresses.length) {
        return addresses[0] ? refused({ reason: "word-gone", address: addresses[0] }) : applied(root, []);
      }
      const source = root.lines[resolved[0].lineIndex];
      const update = mergedFieldUpdate(
        source,
        trackField(resolved[0].type),
        resolved.map((word) => word.wordIndex),
        ctx.splitChar,
      );
      return update ? withLineUpdates(root, [update]) : refused({ reason: "word-gone", address: addresses[0] });
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { mergeWords };
