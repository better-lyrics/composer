import type { HanReading } from "@/domain/alignment/language";
import type { AlignmentWord, PartSplit, WordInterval } from "@/domain/alignment/words";

// -- Types --------------------------------------------------------------------

/** One line's worth of audio and text, cut around the user's rough line taps. */
interface AlignmentSegment {
  /** Words in sung order, each with the parts it's timed in. */
  words: AlignmentWord[];
  /** Whether Han characters are read as Mandarin or as Japanese kanji. */
  hanReading: HanReading;
  /** The line's romanization when it differs from the line; its syllables are what's sung. */
  transliteration: string | null;
  /** The user's tapped line timing, in song seconds. */
  taps: WordInterval;
  /** Song time of `samples[0]`. */
  windowBegin: number;
  /** Mono separated vocals for the window. */
  samples: Float32Array;
  sampleRate: number;
  /**
   * The parts of a word sung just before the line (the previous line's last),
   * aligned ahead of the line's own words and left out of `intervals`.
   */
  anchor?: string[];
}

interface SegmentAlignment {
  /** Song-time intervals, one per part across all words, in order. */
  intervals: WordInterval[];
  /** True when the model couldn't place this line and it was split evenly instead. */
  fellBack: boolean;
  /** Words the aligner couldn't pronounce, which caused a fallback. */
  unknownWords: string[];
  /** Words aligned on a pronunciation guessed from their spelling. */
  guessedWords: string[];
  /** Unsplit parts worth splitting into syllables, in song time. Only applied to new word timing. */
  splits: PartSplit[];
  /** Where the segment's anchor word landed, in song time; null without one or when the line fell back. */
  anchor: WordInterval | null;
}

/**
 * Turns rough line timing into word timing. Implementations range from a
 * text-only split to a forced-alignment model.
 */
interface Aligner {
  readonly id: string;
  /** False when the aligner ignores the audio. */
  readonly listensToAudio: boolean;
  /**
   * Downloads and loads whatever the aligner needs, including the kanji
   * dictionary when `japanese`. `modelId` picks the checkpoint for aligners
   * that offer more than one.
   */
  prepare: (
    onProgress: (loaded: number, total: number) => void,
    signal: AbortSignal,
    options: { japanese: boolean; modelId: string },
  ) => Promise<void>;
  align: (segment: AlignmentSegment, signal: AbortSignal) => Promise<SegmentAlignment>;
  /**
   * Where the line's phones are in the segment's audio, in song time: a fast
   * first look the line's window is then narrowed to. Null when the aligner
   * can't tell.
   */
  locate: (segment: AlignmentSegment, signal: AbortSignal) => Promise<WordInterval | null>;
  /** Whether a model that fits these options is already in memory, so a run needs no load. */
  isLoaded: (options: { japanese: boolean; modelId: string }) => boolean;
  /** Frees the model. The next run prepares again from the download cache. */
  release: () => void;
}

// -- Exports ------------------------------------------------------------------

export type { AlignmentSegment, Aligner, SegmentAlignment };
