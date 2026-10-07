import type { WordInterval } from "@/domain/alignment/words";

// -- Types --------------------------------------------------------------------

/** One line's worth of audio and text, cut around the user's rough line taps. */
interface AlignmentSegment {
  /** Whole words in sung order, as written in the lyrics. */
  words: string[];
  /** The user's tapped line timing, in song seconds. */
  taps: WordInterval;
  /** Song time of `samples[0]`. */
  windowBegin: number;
  /** Mono separated vocals for the window. */
  samples: Float32Array;
  sampleRate: number;
}

interface SegmentAlignment {
  /** Song-time intervals, one per input word, in order. */
  intervals: WordInterval[];
  /** True when the model couldn't place this line and it was split evenly instead. */
  fellBack: boolean;
  /** Words the aligner couldn't pronounce, which caused a fallback. */
  unknownWords: string[];
}

/**
 * Turns rough line timing into word timing. Implementations range from a
 * text-only split to a forced-alignment model.
 */
interface Aligner {
  readonly id: string;
  /** False when the aligner ignores the audio. */
  readonly listensToAudio: boolean;
  /** Downloads and loads whatever the aligner needs. Resolves immediately when there is nothing to load. */
  prepare: (onProgress: (loaded: number, total: number) => void, signal: AbortSignal) => Promise<void>;
  align: (segment: AlignmentSegment, signal: AbortSignal) => Promise<SegmentAlignment>;
  /** Frees the model. The next run prepares again from the download cache. */
  release: () => void;
}

// -- Exports ------------------------------------------------------------------

export type { AlignmentSegment, Aligner };
