import type { PendingReason, UnisonLyricsFormat } from "@/lib/unison/api-types";

// -- Types ---------------------------------------------------------------------

type RevisionStatus = "live" | "past" | "pending" | "superseded" | "rejected" | "withdrawn";

interface RevisionSummary {
  id: number;
  revNo: number;
  status: RevisionStatus;
  pendingReason: PendingReason | null;
  isAnchor: boolean;
  textDrift: number;
  timingDrift: number;
  revertsRevNo: number | null;
  author: { displayName: string } | null;
  reviewNote: string | null;
  createdAt: number;
  reviewedAt: number | null;
}

type RevisionMetadataField = "language" | "isrc" | "album";
type RevisionDiffPart = ["=" | "+" | "-", string];

interface RevisionSyllableChange {
  before: string | null;
  after: string | null;
  moved: number;
}

interface RevisionHeadTextRef {
  kind: "translation" | "transliteration" | "credit";
  lang: string | null;
  line: number | null;
}

type RevisionDiffRow =
  | { kind: "same" | "add" | "del"; lineNo: number; startMs: number | null; text: string; head?: RevisionHeadTextRef }
  | { kind: "word"; lineNo: number; startMs: number | null; parts: RevisionDiffPart[]; head?: RevisionHeadTextRef }
  | {
      kind: "timing";
      lineNo: number;
      startMs: number;
      deltaMs: number;
      text: string;
      syllables?: RevisionSyllableChange;
    }
  | ({ kind: "syllable"; lineNo: number; startMs: number | null; text: string } & RevisionSyllableChange)
  | { kind: "gap"; count: number; section?: "head" }
  | { kind: "field"; field: RevisionMetadataField; before: string | null; after: string | null };

interface RevisionDiff {
  rows: RevisionDiffRow[];
  againstRevNo: number | null;
}

interface RevisionDetail extends RevisionSummary {
  lyrics: string;
  format: UnisonLyricsFormat;
  language: string | null;
  isrc: string | null;
  album: string | null;
}

interface RevisionInput {
  lyrics: string;
  format: UnisonLyricsFormat;
  language?: string | null;
  isrc?: string | null;
  album?: string | null;
}

interface RevisionFieldCheck {
  field: "lyrics" | RevisionMetadataField;
  status: "ok" | "warn" | "bad";
  message: string;
  line?: number;
}

interface RevisionPreview {
  checks: RevisionFieldCheck[];
  drift: {
    text: number;
    timing: number;
    timingOffsetMs: number;
    textLimit: number;
    timingLimit: number;
    anchorRevNo: number | null;
  };
  outcome: { goesLive: boolean; reason: PendingReason | null };
  noChanges: boolean;
  rateLimit: { lyricRemaining: number; lyricLimit: number; userRemaining: number; userLimit: number };
  diff: RevisionDiff;
}

// -- Exports -------------------------------------------------------------------

export type {
  RevisionDetail,
  RevisionDiff,
  RevisionDiffRow,
  RevisionInput,
  RevisionPreview,
  RevisionStatus,
  RevisionSummary,
};
