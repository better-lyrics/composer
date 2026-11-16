import type { SuggestionDecider } from "@/lib/unison/api-types";
import type { RevisionSummary } from "@/lib/unison/revision-types";

// -- Types ---------------------------------------------------------------------

type SuggestionOutcome =
  | { kind: "approved"; revNo: number; decidedBy: SuggestionDecider }
  | { kind: "rejected"; revNo: number; decidedBy: SuggestionDecider; note: string | null }
  | { kind: "withdrawn" | "superseded"; revNo: number };

// -- Derivations ---------------------------------------------------------------

function newestFirst(history: readonly RevisionSummary[]): RevisionSummary[] {
  return [...history].sort((a, b) => b.revNo - a.revNo);
}

function suggestionOutcome(history: readonly RevisionSummary[], keyId: string): SuggestionOutcome | null {
  const [latest, previous] = newestFirst(history);
  if (!latest) return null;
  if (latest.authorKeyId !== keyId) {
    const superseded = previous?.authorKeyId === keyId && previous.status === "superseded";
    return superseded ? { kind: "superseded", revNo: previous.revNo } : null;
  }
  if (latest.status === "withdrawn") return { kind: "withdrawn", revNo: latest.revNo };
  if (!latest.decidedBy) return null;
  if (latest.status === "rejected") {
    return { kind: "rejected", revNo: latest.revNo, decidedBy: latest.decidedBy, note: latest.reviewNote };
  }
  return latest.status === "live" ? { kind: "approved", revNo: latest.revNo, decidedBy: latest.decidedBy } : null;
}

// -- Exports -------------------------------------------------------------------

export { suggestionOutcome };
export type { SuggestionOutcome };
