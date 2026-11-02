import type { RevisionStatus, RevisionSummary } from "@/lib/unison/revision-types";

// -- Types ---------------------------------------------------------------------

type HistoryStatus = "live" | "pending" | "declined" | "earlier" | "withdrawn" | "replaced";

type MakeLiveRefusal = "live" | "pending" | "never-live" | "not-owner";

// -- Constants -----------------------------------------------------------------

const HISTORY_STATUSES: Record<RevisionStatus, HistoryStatus> = {
  live: "live",
  pending: "pending",
  rejected: "declined",
  past: "earlier",
  withdrawn: "withdrawn",
  superseded: "replaced",
};

// -- Functions -----------------------------------------------------------------

function historyStatus(status: RevisionStatus): HistoryStatus {
  return HISTORY_STATUSES[status];
}

// Unison restores only revisions that were live once (`live` or `past`), and only for the submitter.
function makeLiveRefusal(revision: RevisionSummary, canEdit: boolean): MakeLiveRefusal | null {
  if (revision.status === "live") return "live";
  if (revision.status === "pending") return "pending";
  if (revision.status !== "past") return "never-live";
  return canEdit ? null : "not-owner";
}

// Null asks Unison for its default base, the revision that was live before this one.
function revisionDiffBase(revision: RevisionSummary, revisions: readonly RevisionSummary[]): number | null {
  if (revision.status === "live") return null;
  return revisions.find((candidate) => candidate.status === "live")?.id ?? null;
}

function revisionSummaryLine(revision: RevisionSummary): string {
  if (revision.revertsRevNo !== null) return `Brings back revision ${revision.revertsRevNo}`;
  if (revision.revNo === 1) return "First upload";
  if (revision.status === "rejected" && revision.reviewNote) return revision.reviewNote;
  return revision.author ? `Edit by ${revision.author.displayName}` : "Edit";
}

function initialRevision(
  revisions: readonly RevisionSummary[],
  requestedRevNo: number | null,
): RevisionSummary | undefined {
  return revisions.find((revision) => revision.revNo === requestedRevNo) ?? revisions[0];
}

// -- Exports -------------------------------------------------------------------

export type { HistoryStatus, MakeLiveRefusal };
export { historyStatus, initialRevision, makeLiveRefusal, revisionDiffBase, revisionSummaryLine };
