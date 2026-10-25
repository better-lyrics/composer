import type { Icon } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type NoticeKindId = "brackets" | "explicit" | "grouping" | "sharing";

interface NoticeAction {
  label: string;
  icon?: Icon;
  run: () => void;
}

interface NoticeRow {
  key: string;
  fingerprints: readonly string[];
  title: React.ReactNode;
  detail?: React.ReactNode;
  preview?: React.ReactNode;
  accept?: NoticeAction;
  dismissedLabel: string;
}

interface NoticeKind {
  id: NoticeKindId;
  icon: Icon;
  tone: "accent" | "warn";
  summary: string;
  singleSummary?: string;
  singleAction?: NoticeAction;
  rows: readonly NoticeRow[];
  acceptAll?: NoticeAction;
  dismiss?: (fingerprints: readonly string[]) => void;
  restore?: (fingerprints: readonly string[]) => void;
  dismissedFingerprints: readonly string[];
  modalTitle: string;
}

// -- Constants ----------------------------------------------------------------

const KIND_ORDER: readonly NoticeKindId[] = ["brackets", "explicit", "grouping", "sharing"];

// -- Functions ----------------------------------------------------------------

function orderedKinds(kinds: readonly (NoticeKind | null)[]): NoticeKind[] {
  return kinds
    .filter((kind): kind is NoticeKind => kind !== null && kind.rows.length > 0)
    .toSorted((a, b) => KIND_ORDER.indexOf(a.id) - KIND_ORDER.indexOf(b.id));
}

function noticeItemCount(kinds: readonly NoticeKind[]): number {
  return kinds.reduce((sum, kind) => sum + kind.rows.length, 0);
}

function hiddenByDismissal<T extends { fingerprint: string }>(
  suggestions: readonly T[],
  dismissed: readonly string[],
): { visible: T[]; dismissedFingerprints: string[] } {
  const dismissedSet = new Set(dismissed);
  const visible: T[] = [];
  const dismissedFingerprints: string[] = [];
  for (const suggestion of suggestions) {
    if (dismissedSet.has(suggestion.fingerprint)) dismissedFingerprints.push(suggestion.fingerprint);
    else visible.push(suggestion);
  }
  return { visible, dismissedFingerprints };
}

// -- Exports ------------------------------------------------------------------

export type { NoticeAction, NoticeKind, NoticeKindId, NoticeRow };
export { hiddenByDismissal, noticeItemCount, orderedKinds };
