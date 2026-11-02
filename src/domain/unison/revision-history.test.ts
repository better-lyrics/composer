import {
  historyStatus,
  initialRevision,
  makeLiveRefusal,
  revisionDiffBase,
  revisionSummaryLine,
} from "@/domain/unison/revision-history";
import type { RevisionStatus, RevisionSummary } from "@/lib/unison/revision-types";
import { describe, expect, it } from "vitest";

// -- Fixtures ------------------------------------------------------------------

function revision(revNo: number, status: RevisionStatus, extra: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    id: 40 + revNo,
    revNo,
    status,
    pendingReason: status === "pending" ? "large_text_drift" : null,
    isAnchor: false,
    textDrift: 0,
    timingDrift: 0,
    revertsRevNo: null,
    author: { displayName: "Paper Ferries" },
    reviewNote: null,
    createdAt: 1_730_000_000 + revNo * 86_400,
    reviewedAt: null,
    ...extra,
  };
}

const HISTORY: RevisionSummary[] = [
  revision(6, "pending"),
  revision(5, "live"),
  revision(4, "rejected", { reviewNote: "Timing drifts late in the bridge." }),
  revision(3, "past"),
  revision(2, "withdrawn"),
  revision(1, "past"),
];

// -- Tests ---------------------------------------------------------------------

describe("historyStatus", () => {
  it("names every server status the way the history list shows it", () => {
    expect(historyStatus("live")).toBe("live");
    expect(historyStatus("pending")).toBe("pending");
    expect(historyStatus("rejected")).toBe("declined");
    expect(historyStatus("past")).toBe("earlier");
    expect(historyStatus("withdrawn")).toBe("withdrawn");
    expect(historyStatus("superseded")).toBe("replaced");
  });
});

describe("makeLiveRefusal", () => {
  it("allows only a revision that was live before, for the submitter", () => {
    expect(makeLiveRefusal(revision(3, "past"), true)).toBeNull();
  });

  it("refuses the live and the pending revision", () => {
    expect(makeLiveRefusal(revision(5, "live"), true)).toBe("live");
    expect(makeLiveRefusal(revision(6, "pending"), true)).toBe("pending");
  });

  it("refuses revisions that never went live, because the server only restores live ones", () => {
    expect(makeLiveRefusal(revision(4, "rejected"), true)).toBe("never-live");
    expect(makeLiveRefusal(revision(2, "withdrawn"), true)).toBe("never-live");
    expect(makeLiveRefusal(revision(2, "superseded"), true)).toBe("never-live");
  });

  it("refuses everyone but the submitter", () => {
    expect(makeLiveRefusal(revision(3, "past"), false)).toBe("not-owner");
  });
});

describe("revisionDiffBase", () => {
  it("compares every other revision with the live one", () => {
    expect(revisionDiffBase(HISTORY[0], HISTORY)).toBe(HISTORY[1].id);
    expect(revisionDiffBase(HISTORY[3], HISTORY)).toBe(HISTORY[1].id);
  });

  it("lets the server pick the previous live revision for the live one", () => {
    expect(revisionDiffBase(HISTORY[1], HISTORY)).toBeNull();
  });

  it("falls back to the server's choice when no revision is live", () => {
    expect(revisionDiffBase(HISTORY[0], [HISTORY[0], HISTORY[2]])).toBeNull();
  });
});

describe("revisionSummaryLine", () => {
  it("says which revision a restore brought back", () => {
    expect(revisionSummaryLine(revision(7, "live", { revertsRevNo: 3 }))).toBe("Brings back revision 3");
  });

  it("calls the first revision the first upload", () => {
    expect(revisionSummaryLine(revision(1, "past"))).toBe("First upload");
  });

  it("shows the council's note for a declined revision", () => {
    expect(revisionSummaryLine(HISTORY[2])).toBe("Timing drifts late in the bridge.");
  });

  it("names the author of any other edit", () => {
    expect(revisionSummaryLine(revision(3, "past"))).toBe("Edit by Paper Ferries");
    expect(revisionSummaryLine(revision(3, "past", { author: null }))).toBe("Edit");
  });
});

describe("initialRevision", () => {
  it("opens at the requested revision", () => {
    expect(initialRevision(HISTORY, 4)?.revNo).toBe(4);
  });

  it("opens at the newest revision when none or an unknown one is requested", () => {
    expect(initialRevision(HISTORY, null)?.revNo).toBe(6);
    expect(initialRevision(HISTORY, 99)?.revNo).toBe(6);
  });

  it("has nothing to open in an empty history", () => {
    expect(initialRevision([], 4)).toBeUndefined();
  });
});
