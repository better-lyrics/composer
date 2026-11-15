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
//   joinsNext        structural: set by whoever creates syllables; split pieces join
//                    except the last, which keeps the source word's join
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
  joinsNext: boolean;
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
  const { text, sep, begin, end, joinsNext, explicit } = input;
  return { id: newWordId(), text, sep, begin, end, joinsNext, ...(explicit && { explicit: true }) };
}

function splitSourceWord(source: WordTiming, subPartitions: SubPartition[]): WordTiming[] {
  return withSplitIds(
    subPartitions.map((sub, index) => ({
      ...source,
      ...splitTrailingWhitespace(sub.text),
      begin: sub.begin,
      end: sub.end,
      ...(index < subPartitions.length - 1 && { joinsNext: true }),
    })),
  );
}

// -- Exports ------------------------------------------------------------------

export { cloneWord, splitSourceWord, synthesizeBracketedWord };
export type { SubPartition };
