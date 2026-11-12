import type { AlignmentReview } from "@/domain/alignment/review-state";
import type { LyricLine } from "@/domain/line/model";
import { isSyncableLine, type SyncGap, syncGaps } from "@/domain/line/sync-progress";
import { type ZeroLengthWordIssue, zeroLengthWordIssues } from "@/domain/line/zero-length-words";
import { namedArtists } from "@/domain/project/display-title";
import { normalizeLanguageTag } from "@/domain/project/language";
import { type UnisonTtmlProblem, precheckUnisonTtml } from "@/domain/unison/ttml-precheck";
import { isValidIsrc } from "@/utils/isrc";
import { validateTtml } from "@/utils/lyrics-parsers/validate-ttml";

// -- Types ---------------------------------------------------------------------

type SubmitCheckStatus = "pass" | "fail" | "note";
type VideoProblem = "no-video" | "no-duration" | "duration-out-of-range";
type SongProblem = "no-title" | "no-artist";
type SubmitMode = "new" | "update";
type TtmlCheckProblem = UnisonTtmlProblem | "malformed";

type LineIssue = SyncGap | ZeroLengthWordIssue;
type CheckField = "title" | "artist" | "isrc" | "language" | "album";
type CheckFix =
  | { kind: "lines"; issues: readonly LineIssue[] }
  | { kind: "field"; field: CheckField }
  | { kind: "video" }
  | { kind: "action"; action: "load-audio" | "review-alignment" | "regenerate" }
  | { kind: "none" };

interface SubmitCheckInput {
  mode: SubmitMode;
  videoId: string | undefined;
  durationSeconds: number;
  title: string;
  artists: readonly string[];
  lines: readonly LyricLine[];
  alignmentTier: AlignmentReview["tier"];
  content: string;
  contentIsEdited: boolean;
  isrc: string | undefined;
  language: string | undefined;
}

// Every failing variant names its fix, so a check that cannot tell the user where to look does not compile.
type SubmitCheck =
  | { id: "video"; status: "pass"; videoId: string; durationSeconds: number }
  | { id: "video"; status: "fail"; problem: VideoProblem; fix: CheckFix }
  | { id: "song"; status: "pass" }
  | { id: "song"; status: "fail"; problem: SongProblem; fix: CheckFix }
  | { id: "synced"; status: "pass"; syncedLineCount: number; lineCount: number }
  | { id: "synced"; status: "fail"; syncedLineCount: number; lineCount: number; fix: CheckFix }
  | { id: "alignment"; status: "pass" }
  | { id: "alignment"; status: "fail"; fix: CheckFix }
  | { id: "ttml"; status: "pass" }
  | { id: "ttml"; status: "fail"; problem: TtmlCheckProblem; edited: boolean; fix: CheckFix }
  | { id: "isrc"; status: "pass" | "note" }
  | { id: "isrc"; status: "fail"; problem: "invalid"; fix: CheckFix }
  | { id: "language"; status: "pass"; tag: string }
  | { id: "language"; status: "fail"; problem: "invalid"; fix: CheckFix };

interface SubmitChecks {
  checks: SubmitCheck[];
  canSubmit: boolean;
}

// -- Constants -----------------------------------------------------------------

// Unison's `config.validation.duration`, in whole seconds.
const UNISON_DURATION_RANGE = { min: 1, max: 60 * 60 };
// Unison's `submission.maxVariantsPerUserPerVideo`.
const UNISON_VARIANT_CAP = 3;

// -- Functions -----------------------------------------------------------------

function submitDurationSeconds(durationSeconds: number): number {
  return Math.round(durationSeconds);
}

function videoCheck({ videoId, durationSeconds }: SubmitCheckInput): SubmitCheck {
  if (!videoId) return { id: "video", status: "fail", problem: "no-video", fix: { kind: "video" } };
  if (!(durationSeconds > 0)) {
    return { id: "video", status: "fail", problem: "no-duration", fix: { kind: "action", action: "load-audio" } };
  }
  const seconds = submitDurationSeconds(durationSeconds);
  if (seconds < UNISON_DURATION_RANGE.min || seconds > UNISON_DURATION_RANGE.max) {
    return { id: "video", status: "fail", problem: "duration-out-of-range", fix: { kind: "none" } };
  }
  return { id: "video", status: "pass", videoId, durationSeconds: seconds };
}

function songCheck({ title, artists }: SubmitCheckInput): SubmitCheck {
  if (!title.trim()) return { id: "song", status: "fail", problem: "no-title", fix: { kind: "field", field: "title" } };
  if (namedArtists(artists).length === 0) {
    return { id: "song", status: "fail", problem: "no-artist", fix: { kind: "field", field: "artist" } };
  }
  return { id: "song", status: "pass" };
}

function syncedCheck({ lines }: SubmitCheckInput): SubmitCheck {
  const gaps = syncGaps(lines);
  const lineCount = lines.filter(isSyncableLine).length;
  const linesWithGaps = new Set(gaps.flatMap((gap) => (gap.kind === "background-only" ? [] : [gap.lineId]))).size;
  const syncedLineCount = lineCount - linesWithGaps;
  if (lineCount > 0 && gaps.length === 0) return { id: "synced", status: "pass", syncedLineCount, lineCount };
  return { id: "synced", status: "fail", syncedLineCount, lineCount, fix: { kind: "lines", issues: gaps } };
}

function alignmentCheck({ alignmentTier }: SubmitCheckInput): SubmitCheck {
  if (alignmentTier !== "untouched") return { id: "alignment", status: "pass" };
  return { id: "alignment", status: "fail", fix: { kind: "action", action: "review-alignment" } };
}

function ttmlProblem({ content, contentIsEdited }: SubmitCheckInput): TtmlCheckProblem | null {
  if (contentIsEdited && !validateTtml(content).ok) return "malformed";
  const precheck = precheckUnisonTtml(content);
  return precheck.ok ? null : precheck.problem;
}

function ttmlFix(problem: TtmlCheckProblem, input: SubmitCheckInput): CheckFix {
  if (input.contentIsEdited) return { kind: "action", action: "regenerate" };
  // Generated word timing comes from the user's own words; other generated format problems are Composer's to fix.
  if (problem === "zero-length-words") return { kind: "lines", issues: zeroLengthWordIssues(input.lines) };
  return { kind: "none" };
}

function ttmlCheck(input: SubmitCheckInput): SubmitCheck {
  const problem = ttmlProblem(input);
  if (problem === null) return { id: "ttml", status: "pass" };
  return { id: "ttml", status: "fail", problem, edited: input.contentIsEdited, fix: ttmlFix(problem, input) };
}

function isrcCheck({ isrc }: SubmitCheckInput): SubmitCheck {
  const value = isrc?.trim();
  if (!value) return { id: "isrc", status: "note" };
  if (isValidIsrc(value)) return { id: "isrc", status: "pass" };
  return { id: "isrc", status: "fail", problem: "invalid", fix: { kind: "field", field: "isrc" } };
}

function languageChecks({ language }: SubmitCheckInput): SubmitCheck[] {
  if (!language?.trim()) return [];
  const tag = normalizeLanguageTag(language);
  if (tag) return [{ id: "language", status: "pass", tag }];
  return [{ id: "language", status: "fail", problem: "invalid", fix: { kind: "field", field: "language" } }];
}

function submitChecks(input: SubmitCheckInput): SubmitChecks {
  const checks: SubmitCheck[] = [
    ...(input.mode === "new" ? [videoCheck(input), songCheck(input)] : []),
    syncedCheck(input),
    alignmentCheck(input),
    ttmlCheck(input),
    isrcCheck(input),
    ...languageChecks(input),
  ];
  return { checks, canSubmit: !checks.some((check) => check.status === "fail") };
}

// -- Exports -------------------------------------------------------------------

export type {
  CheckField,
  CheckFix,
  LineIssue,
  SubmitCheck,
  SubmitCheckInput,
  SubmitCheckStatus,
  SubmitChecks,
  SubmitMode,
  TtmlCheckProblem,
};
export { submitChecks, submitDurationSeconds, UNISON_VARIANT_CAP };
