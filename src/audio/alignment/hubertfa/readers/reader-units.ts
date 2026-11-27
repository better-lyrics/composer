import { readArabic } from "@/audio/alignment/hubertfa/readers/arabic";
import { readFrench } from "@/audio/alignment/hubertfa/readers/french";
import { readGerman } from "@/audio/alignment/hubertfa/readers/german";
import { readIndonesian } from "@/audio/alignment/hubertfa/readers/indonesian";
import { readItalian } from "@/audio/alignment/hubertfa/readers/italian";
import { readKorean } from "@/audio/alignment/hubertfa/readers/korean";
import { readPortuguese } from "@/audio/alignment/hubertfa/readers/portuguese";
import { readSpanish } from "@/audio/alignment/hubertfa/readers/spanish";
import type { WordReading } from "@/audio/alignment/hubertfa/readers/spelling";
import { readTurkish } from "@/audio/alignment/hubertfa/readers/turkish";
import { isHangulBlock } from "@/domain/alignment/cjk";
import type { LatinReader } from "@/domain/alignment/language";
import { detectNonLatinLanguage, hasLatinLetter } from "@/domain/language/script-detection";

// Which reader reads each word. The project language picks the reader for
// Latin-script words; Hangul and Arabic script always go to their own readers,
// so a K-pop line mixes Korean and English units. Anything else is left to the
// English, Mandarin and Japanese path.

// -- Types --------------------------------------------------------------------

type ReaderLanguage = LatinReader | "ko" | "ar";

/** A unit read by a language reader: the sounds sung on its parts. */
interface ReaderUnit {
  /** Indices into the line's flattened parts. */
  parts: number[];
  reader: ReaderLanguage;
  sounds: string[];
  guessed: boolean;
}

/** A word's parts split by who reads them: a reader's units, or a run of parts for the English path. */
type WordSegment = { kind: "read"; units: ReaderUnit[] } | { kind: "english"; parts: number[] };

// -- Constants ----------------------------------------------------------------

const LATIN_READERS: Readonly<Record<LatinReader, (word: string) => WordReading>> = {
  es: readSpanish,
  pt: readPortuguese,
  fr: readFrench,
  de: readGerman,
  it: readItalian,
  tr: readTurkish,
  id: readIndonesian,
};
const DIGIT = /\p{N}/u;

// -- Functions ----------------------------------------------------------------

// Numbers are left to the number reader (numbers/number-unit.ts), which picks their language from the line.
function readerFor(text: string, latinReader: LatinReader | null): ReaderLanguage | null {
  const script = detectNonLatinLanguage(text);
  if (script === "ko" || script === "ar") return script;
  if (script === null && latinReader && hasLatinLetter(text) && !DIGIT.test(text)) return latinReader;
  return null;
}

/** The sounds of a word read by one reader. Korean words read as one run of blocks. */
function readWord(reader: ReaderLanguage, word: string): WordReading {
  if (reader === "ar") return readArabic(word);
  if (reader === "ko") {
    const { blocks, guessed } = readKorean(word);
    return { sounds: blocks.flat(), guessed };
  }
  return LATIN_READERS[reader](word);
}

// Korean: the sound rules run across the run's blocks, then each part gets the
// sounds of the blocks written in it.
function koreanUnits(parts: readonly { index: number; text: string }[]): ReaderUnit[] {
  const { blocks, guessed } = readKorean(parts.map((part) => part.text).join(""));
  let next = 0;
  return parts.map((part) => {
    const count = [...part.text].filter(isHangulBlock).length;
    const sounds = blocks.slice(next, next + count).flat();
    next += count;
    return { parts: [part.index], reader: "ko", sounds, guessed };
  });
}

/**
 * One word's parts, split into runs by reader: Korean parts are a unit each,
 * a run any other reader takes is one unit, and the rest is left for English.
 */
function segmentWord(
  parts: readonly { index: number; text: string }[],
  latinReader: LatinReader | null,
): WordSegment[] {
  const runs: { reader: ReaderLanguage | null; parts: { index: number; text: string }[] }[] = [];
  for (const part of parts) {
    const korean = detectNonLatinLanguage(part.text) === "ko";
    const previous = runs[runs.length - 1];
    if (previous && (previous.reader === "ko") === korean) previous.parts.push(part);
    else runs.push({ reader: korean ? "ko" : null, parts: [part] });
  }
  return runs.map((run): WordSegment => {
    if (run.reader === "ko") return { kind: "read", units: koreanUnits(run.parts) };
    const text = run.parts.map((part) => part.text).join("");
    const reader = readerFor(text, latinReader);
    const indices = run.parts.map((part) => part.index);
    if (!reader) return { kind: "english", parts: indices };
    const { sounds, guessed } = readWord(reader, text);
    return { kind: "read", units: [{ parts: indices, reader, sounds, guessed }] };
  });
}

// -- Exports ------------------------------------------------------------------

export { readWord, segmentWord };
export type { ReaderLanguage, ReaderUnit };
