import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import { projectStage } from "@/domain/project/progress";
import { type UnisonLyricSnapshot, type UnisonStatus, unisonStatus } from "@/domain/unison/lyric-status";

// -- Types ---------------------------------------------------------------------

interface UnisonLibraryLyric extends UnisonLyricSnapshot {
  score: number;
  voteCount: number;
}

interface UnisonLibraryLyrics {
  byId: ReadonlyMap<string, UnisonLibraryLyric>;
  complete: boolean;
  otherAccountIds: ReadonlySet<string>;
  unresolvedIds: ReadonlySet<string>;
}

type ProjectUnisonState =
  | { kind: "linked"; status: UnisonStatus; score: number | null; voteCount: number }
  | { kind: "other-account" }
  | { kind: "unknown" }
  | { kind: "ready" }
  | { kind: "not-submitted" };

type ProjectUnisonFields = Pick<ProjectIndexEntry, "unisonLyricId" | "lineCount" | "syncedLineCount">;

// -- Derivations ---------------------------------------------------------------

function projectUnisonState(project: ProjectUnisonFields, lyrics: UnisonLibraryLyrics | null): ProjectUnisonState {
  if (!project.unisonLyricId) return projectStage(project) === "synced" ? { kind: "ready" } : { kind: "not-submitted" };
  const lyric = lyrics?.byId.get(project.unisonLyricId);
  if (lyric) return { kind: "linked", status: unisonStatus(lyric), score: lyric.score, voteCount: lyric.voteCount };
  if (lyrics?.otherAccountIds.has(project.unisonLyricId)) return { kind: "other-account" };
  if (lyrics?.complete && !lyrics.unresolvedIds.has(project.unisonLyricId))
    return { kind: "linked", status: "removed", score: null, voteCount: 0 };
  return { kind: "unknown" };
}

// -- Exports -------------------------------------------------------------------

export { projectUnisonState };
export type { UnisonLibraryLyrics };
