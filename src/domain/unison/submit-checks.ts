import type { AlignmentReview } from "@/domain/alignment/review-state";
import { namedArtists } from "@/domain/project/display-title";
import { type UnisonTtmlProblem, precheckUnisonTtml } from "@/domain/unison/ttml-precheck";

// -- Types ---------------------------------------------------------------------

type SubmitCheckStatus = "pass" | "fail" | "note";
type VideoProblem = "no-video" | "no-duration" | "duration-out-of-range";
type SongProblem = "no-title" | "no-artist";
type SubmitMode = "new" | "update";

interface SubmitCheckInput {
  mode: SubmitMode;
  videoId: string | undefined;
  durationSeconds: number;
  title: string;
  artists: readonly string[];
  syncedLineCount: number;
  lineCount: number;
  fullySynced: boolean;
  alignmentTier: AlignmentReview["tier"];
  content: string;
  contentIsEdited: boolean;
  isrc: string | undefined;
}

type SubmitCheck =
  | { id: "video"; status: "pass"; videoId: string; durationSeconds: number }
  | { id: "video"; status: "fail"; problem: VideoProblem }
  | { id: "song"; status: "pass" }
  | { id: "song"; status: "fail"; problem: SongProblem }
  | { id: "synced"; status: "pass" | "fail"; syncedLineCount: number; lineCount: number }
  | { id: "alignment"; status: "pass" | "fail" }
  | { id: "ttml"; status: "pass" }
  | { id: "ttml"; status: "fail"; problem: UnisonTtmlProblem; edited: boolean }
  | { id: "isrc"; status: "pass" | "note" };

interface SubmitChecks {
  checks: SubmitCheck[];
  canSubmit: boolean;
}

// -- Constants -----------------------------------------------------------------

// Unison's `config.validation.duration`, in whole seconds.
const UNISON_DURATION_RANGE = { min: 1, max: 60 * 60 };

// -- Functions -----------------------------------------------------------------

function submitDurationSeconds(durationSeconds: number): number {
  return Math.round(durationSeconds);
}

function videoCheck({ videoId, durationSeconds }: SubmitCheckInput): SubmitCheck {
  if (!videoId) return { id: "video", status: "fail", problem: "no-video" };
  if (!(durationSeconds > 0)) return { id: "video", status: "fail", problem: "no-duration" };
  const seconds = submitDurationSeconds(durationSeconds);
  if (seconds < UNISON_DURATION_RANGE.min || seconds > UNISON_DURATION_RANGE.max) {
    return { id: "video", status: "fail", problem: "duration-out-of-range" };
  }
  return { id: "video", status: "pass", videoId, durationSeconds: seconds };
}

function songCheck({ title, artists }: SubmitCheckInput): SubmitCheck {
  if (!title.trim()) return { id: "song", status: "fail", problem: "no-title" };
  if (namedArtists(artists).length === 0) return { id: "song", status: "fail", problem: "no-artist" };
  return { id: "song", status: "pass" };
}

function ttmlCheck({ content, contentIsEdited }: SubmitCheckInput): SubmitCheck {
  const precheck = precheckUnisonTtml(content);
  if (precheck.ok) return { id: "ttml", status: "pass" };
  return { id: "ttml", status: "fail", problem: precheck.problem, edited: contentIsEdited };
}

function submitChecks(input: SubmitCheckInput): SubmitChecks {
  const checks: SubmitCheck[] = [
    ...(input.mode === "new" ? [videoCheck(input), songCheck(input)] : []),
    {
      id: "synced",
      status: input.fullySynced ? "pass" : "fail",
      syncedLineCount: input.syncedLineCount,
      lineCount: input.lineCount,
    },
    { id: "alignment", status: input.alignmentTier === "untouched" ? "fail" : "pass" },
    ttmlCheck(input),
    { id: "isrc", status: input.isrc?.trim() ? "pass" : "note" },
  ];
  return { checks, canSubmit: !checks.some((check) => check.status === "fail") };
}

// -- Exports -------------------------------------------------------------------

export type { SubmitCheck, SubmitCheckInput, SubmitChecks, SubmitCheckStatus, SubmitMode };
export { submitChecks, submitDurationSeconds };
