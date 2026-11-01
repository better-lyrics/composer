import { type SharedTimingSuggestion, sharedTimingSuggestions } from "@/domain/group/shared-timing-suggestions";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { type NoticeKind, hiddenByDismissal } from "@/ui/notices/notice-model";
import { showKeptOwnTimingToast, showReplacedOwnTimingToast } from "@/utils/group-toast";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { songEndOrUnbounded } from "@/utils/timing/song-end";
import { shareGroupTimingWithUndo } from "@/views/timeline/share-group-timing";
import { IconClock } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Functions ----------------------------------------------------------------

function detailText(suggestion: SharedTimingSuggestion): string {
  const { sourceName, changingCount, replacedCount } = suggestion;
  const ask = `${sourceName} is synced. Share its timing with ${pluralize(changingCount, "instance")}?`;
  if (replacedCount === 0) return ask;
  return `${ask} ${replacedCount} of them ${pluralWord(replacedCount, "loses its", "lose their")} own timing.`;
}

function shareAll(visible: readonly SharedTimingSuggestion[]): void {
  const { duration } = useAudioStore.getState();
  const outcomes = visible.map((suggestion) =>
    useProjectStore.getState().shareGroupTiming(suggestion.groupId, duration),
  );
  showKeptOwnTimingToast(
    outcomes.flatMap((outcome) => outcome.keptOwnTiming),
    "timeline",
  );
  showReplacedOwnTimingToast(outcomes.reduce((sum, outcome) => sum + outcome.replaced.length, 0));
}

function dismissFingerprints(fingerprints: readonly string[]): void {
  const { dismissSuggestion } = useProjectStore.getState();
  for (const fingerprint of fingerprints) dismissSuggestion(fingerprint);
}

// -- Hook ---------------------------------------------------------------------

function useSharedTimingNotice(): NoticeKind | null {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const dismissed = useProjectStore((s) => s.dismissedSuggestions);
  const duration = useAudioStore((s) => s.duration);

  const suggestions = useMemo(
    () => sharedTimingSuggestions(lines, groups, songEndOrUnbounded(duration)),
    [lines, groups, duration],
  );
  const { visible, dismissedFingerprints } = useMemo(
    () => hiddenByDismissal(suggestions, dismissed),
    [suggestions, dismissed],
  );

  if (visible.length === 0 && dismissedFingerprints.length === 0) return null;
  const only = visible.length === 1 ? visible[0] : undefined;

  return {
    id: "sharing",
    icon: IconClock,
    tone: "accent",
    summary: `${pluralize(visible.length, "group")} can share timing`,
    singleSummary: only && `${only.sourceName} can share its timing`,
    // Sharing that replaces timing goes through the list, so the warning is read first.
    singleAction:
      only && only.replacedCount === 0
        ? { label: "Share timing", icon: IconClock, run: () => shareGroupTimingWithUndo(only.groupId) }
        : undefined,
    rows: visible.map((suggestion) => ({
      key: suggestion.groupId,
      fingerprints: [suggestion.fingerprint],
      title: suggestion.label,
      detail: detailText(suggestion),
      accept: { label: "Share", icon: IconClock, run: () => shareGroupTimingWithUndo(suggestion.groupId) },
      dismissedLabel: suggestion.label,
    })),
    acceptAll: { label: "Share all", icon: IconClock, run: () => shareAll(visible) },
    dismiss: dismissFingerprints,
    restore: (fingerprints) => useProjectStore.getState().restoreSuggestions(fingerprints),
    dismissedFingerprints,
    modalTitle: "Shared timing suggestions",
  };
}

// -- Exports ------------------------------------------------------------------

export { useSharedTimingNotice };
