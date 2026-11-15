import { splitTrailingWhitespace } from "insync/from-words";
import { newWordId, withSplitIds } from "@/domain/word/id";
import type { WordTiming } from "@/domain/word/timing";

// -- Field policy for WordTiming creation flows -------------------------------
//
//   text, sep        per-word, comes from source/import context; a split piece
//                    takes its own trailing whitespace as sep
//   begin, end       positional, computed from context
//   explicit         source-positional: copied from the source word in matched/split flows;
//                    set explicitly when user marks
//   syllableGroupId  structural: inherited from bracket sibling in LCS new-slot;
//                    copied from source in split; regenerated on alt-duplicate
//   transliterationJoinerAfter
//                    structural: assigned and transferred by syllable splitting;
//                    consumed when the complete syllable group is merged
//
//   id               identity: kept by every transform (spread); the first split piece keeps it,
//                    other pieces and copies into the same track take a new id
//
// When adding a new WordTiming field, decide its policy and update the relevant
// factory below. Default policy ("rides along via spread") requires no factory
// change: every code path that spreads an existing word ({ ...word, ...overrides })
// automatically carries new fields.

// -- Types --------------------------------------------------------------------

interface BracketedSynthesisInput {
  text: string;
  sep: string;
  begin: number;
  end: number;
  leftBracket?: WordTiming;
  rightBracket?: WordTiming;
  explicit?: boolean;
}

interface SubPartition {
  text: string;
  begin: number;
  end: number;
}

// -- Factories ----------------------------------------------------------------

function cloneWord(source: WordTiming, overrides: Partial<WordTiming>): WordTiming {
  return { ...source, ...overrides };
}

function synthesizeBracketedWord(input: BracketedSynthesisInput): WordTiming {
  const { text, sep, begin, end, leftBracket, rightBracket, explicit } = input;
  const leftId = leftBracket?.syllableGroupId;
  const rightId = rightBracket?.syllableGroupId;
  const inheritedGroupId =
    leftId !== undefined && (rightId === undefined || rightId === leftId)
      ? leftId
      : rightId !== undefined && leftBracket === undefined
        ? rightId
        : undefined;
  const result: WordTiming = { id: newWordId(), text, sep, begin, end };
  if (explicit) result.explicit = true;
  if (inheritedGroupId !== undefined) result.syllableGroupId = inheritedGroupId;
  return result;
}

function splitSourceWord(source: WordTiming, subPartitions: SubPartition[]): WordTiming[] {
  return withSplitIds(
    subPartitions.map((sub) => ({
      ...source,
      ...splitTrailingWhitespace(sub.text),
      begin: sub.begin,
      end: sub.end,
    })),
  );
}

// -- Exports ------------------------------------------------------------------

export { cloneWord, splitSourceWord, synthesizeBracketedWord };
export type { SubPartition };
