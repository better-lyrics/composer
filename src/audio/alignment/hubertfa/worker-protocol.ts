import type { DraftLineRequest } from "@/audio/alignment/types";
import type { AlignmentAssets } from "@/audio/alignment/hubertfa/model-registry";
import type { Backend } from "@/audio/ort-runtime";
import type { DraftPlacement } from "@/domain/alignment/draft-timing";
import type { HanReading } from "@/domain/alignment/language";
import type { PartSplit, WordInterval } from "@/domain/alignment/words";

// The messages between the alignment worker and its host.

// -- Types --------------------------------------------------------------------

type AlignOutcome =
  | { kind: "aligned"; intervals: WordInterval[]; guessed: string[]; splits: PartSplit[] }
  | { kind: "unknown"; words: string[] }
  | { kind: "no-path" };

type InboundMessage =
  | { type: "init"; assets: AlignmentAssets; forceWasm?: boolean; japanese?: boolean }
  | {
      type: "align";
      samples: Float32Array;
      sampleRate: number;
      words: string[][];
      hanReading: HanReading;
      transliteration: string | null;
    }
  | { type: "draft"; samples: Float32Array; sampleRate: number; lines: DraftLineRequest[]; hanReading: HanReading }
  | { type: "cancel" };

type OutboundMessage =
  | { type: "init-progress"; loaded: number; total: number }
  | { type: "init-done"; backend: Backend }
  | { type: "align-done"; outcome: AlignOutcome }
  | { type: "draft-progress"; done: number; total: number }
  | { type: "draft-done"; placements: (DraftPlacement | null)[] }
  | { type: "cancelled" }
  | { type: "error"; code: string; message: string };

// -- Exports ------------------------------------------------------------------

export type { AlignOutcome, InboundMessage, OutboundMessage };
