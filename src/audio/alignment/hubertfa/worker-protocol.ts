import type { AlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import type { Backend } from "@/audio/ort-runtime";
import type { HanReading, LatinReader } from "@/domain/alignment/language";
import type { PartSplit, WordInterval } from "@/domain/alignment/words";

// The messages between the alignment worker and its host.

// -- Types --------------------------------------------------------------------

type AlignOutcome =
  | {
      kind: "aligned";
      intervals: WordInterval[];
      guessed: string[];
      splits: PartSplit[];
      /** Where the anchor word landed, when one was sent. */
      anchor: WordInterval | null;
    }
  | { kind: "unknown"; words: string[] }
  | { kind: "no-path" };

interface LineRequest {
  samples: Float32Array;
  sampleRate: number;
  words: string[][];
  hanReading: HanReading;
  latinReader: LatinReader | null;
  transliteration: string | null;
  /** The previous and next lyric lines' words, for a model that finds lines. */
  context?: { previous: string[][]; next: string[][] };
  /** The begin tap, in seconds from the first sample. */
  tap?: number;
  /** The window reaches well past the line on both sides: a model that finds lines aligns it among its neighbours. */
  wide?: boolean;
  /** No tap starts these words: a model that finds lines gates on the frames it says are theirs, with no tap hint. */
  gated?: boolean;
}

type InboundMessage =
  | { type: "init"; assets: AlignmentAssets; forceWasm?: boolean; japanese?: boolean }
  | ({ type: "align"; anchor: string[] | null } & LineRequest)
  | ({ type: "locate" } & LineRequest)
  | { type: "cancel" };

type OutboundMessage =
  | { type: "init-progress"; loaded: number; total: number }
  | { type: "init-done"; backend: Backend; findsLines: boolean }
  | { type: "align-done"; outcome: AlignOutcome }
  | { type: "locate-done"; bounds: WordInterval | null }
  | { type: "cancelled" }
  | { type: "error"; code: string; message: string };

// -- Exports ------------------------------------------------------------------

export type { AlignOutcome, InboundMessage, LineRequest, OutboundMessage };
