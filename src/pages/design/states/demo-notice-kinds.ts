import { type NoticeKind, hiddenByDismissal } from "@/ui/notices/notice-model";
import { pluralize } from "@/utils/pluralize";
import { IconAlertTriangle, IconBulb, IconLink } from "@tabler/icons-react";
import { useState } from "react";

// -- Interfaces ----------------------------------------------------------------

interface GroupingSeed {
  fingerprint: string;
  starts: readonly number[];
  length: number;
}

interface ExplicitSeed {
  fingerprint: string;
  word: string;
  line: number;
}

interface DemoNoticeActions {
  dismiss: (fingerprints: readonly string[]) => void;
  restore: (fingerprints: readonly string[]) => void;
  resolve: (fingerprints: readonly string[]) => void;
}

// -- Constants -----------------------------------------------------------------

const GROUPING_SEEDS: readonly GroupingSeed[] = [
  { fingerprint: "chorus", starts: [8, 24, 40], length: 4 },
  { fingerprint: "pre-chorus", starts: [4, 20], length: 4 },
  { fingerprint: "hook", starts: [44, 48], length: 2 },
  { fingerprint: "outro", starts: [52, 56], length: 2 },
];

const EXPLICIT_SEEDS: readonly ExplicitSeed[] = [{ fingerprint: "damn-12", word: "damn", line: 12 }];

const ALL_FINGERPRINTS = [...GROUPING_SEEDS, ...EXPLICIT_SEEDS].map((seed) => seed.fingerprint);

// -- Functions -----------------------------------------------------------------

function runLabel(seed: GroupingSeed): string {
  return `${seed.starts.length} runs of ${pluralize(seed.length, "line")}`;
}

function groupingKind(
  seeds: readonly GroupingSeed[],
  dismissed: readonly string[],
  actions: DemoNoticeActions,
): NoticeKind | null {
  const { visible, dismissedFingerprints } = hiddenByDismissal(seeds, dismissed);
  if (visible.length === 0 && dismissedFingerprints.length === 0) return null;
  return {
    id: "grouping",
    icon: IconBulb,
    tone: "accent",
    summary: pluralize(visible.length, "grouping suggestion"),
    rows: visible.map((seed) => ({
      key: seed.fingerprint,
      fingerprints: [seed.fingerprint],
      title: `${seed.starts.length} runs · ${pluralize(seed.length, "line")} each`,
      detail: `At lines ${seed.starts.map((start) => `${start + 1} to ${start + seed.length}`).join(", ")}`,
      accept: { label: "Group", icon: IconLink, run: () => actions.resolve([seed.fingerprint]) },
      dismissedLabel: runLabel(seed),
    })),
    acceptAll: {
      label: "Group all",
      icon: IconLink,
      run: () => actions.resolve(visible.map((seed) => seed.fingerprint)),
    },
    dismiss: actions.dismiss,
    restore: actions.restore,
    dismissedFingerprints,
    modalTitle: "Grouping suggestions",
  };
}

function explicitKind(
  seeds: readonly ExplicitSeed[],
  dismissed: readonly string[],
  actions: DemoNoticeActions,
): NoticeKind | null {
  const { visible, dismissedFingerprints } = hiddenByDismissal(seeds, dismissed);
  if (visible.length === 0 && dismissedFingerprints.length === 0) return null;
  const only = visible.length === 1 ? visible[0] : undefined;
  return {
    id: "explicit",
    icon: IconAlertTriangle,
    tone: "warn",
    summary: pluralize(visible.length, "possibly explicit word"),
    singleSummary: only && `Possibly explicit: "${only.word}"`,
    singleAction: only && {
      label: "Mark explicit",
      icon: IconAlertTriangle,
      run: () => actions.resolve([only.fingerprint]),
    },
    rows: visible.map((seed) => ({
      key: seed.fingerprint,
      fingerprints: [seed.fingerprint],
      title: `"${seed.word}" · main`,
      detail: `line ${seed.line}`,
      accept: { label: "Mark", icon: IconAlertTriangle, run: () => actions.resolve([seed.fingerprint]) },
      dismissedLabel: `"${seed.word}" on line ${seed.line}`,
    })),
    dismiss: actions.dismiss,
    restore: actions.restore,
    dismissedFingerprints,
    modalTitle: "Explicit-word suggestions",
  };
}

// -- Hooks ---------------------------------------------------------------------

function useDemoNoticeKinds() {
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [resolved, setResolved] = useState<readonly string[]>([]);
  const [cleared, setCleared] = useState(false);

  const actions: DemoNoticeActions = {
    dismiss: (fingerprints) => setDismissed((previous) => [...previous, ...fingerprints]),
    restore: (fingerprints) => {
      const restored = new Set(fingerprints);
      setDismissed((previous) => previous.filter((print) => !restored.has(print)));
    },
    resolve: (fingerprints) => setResolved((previous) => [...previous, ...fingerprints]),
  };
  const resolvedSet = new Set(resolved);
  const open = <T extends { fingerprint: string }>(seeds: readonly T[]) =>
    seeds.filter((seed) => !resolvedSet.has(seed.fingerprint));
  const kinds = cleared
    ? []
    : [groupingKind(open(GROUPING_SEEDS), dismissed, actions), explicitKind(open(EXPLICIT_SEEDS), dismissed, actions)];

  const restart = (nextDismissed: readonly string[], nextCleared: boolean) => {
    setDismissed(nextDismissed);
    setResolved([]);
    setCleared(nextCleared);
  };

  return {
    kinds,
    reset: () => restart([], false),
    dismissAll: () => restart(ALL_FINGERPRINTS, false),
    clear: () => restart([], true),
  };
}

// -- Exports -------------------------------------------------------------------

export { useDemoNoticeKinds };
