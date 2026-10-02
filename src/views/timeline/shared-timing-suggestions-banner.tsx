import { type SharedTimingSuggestion, sharedTimingSuggestions } from "@/domain/group/shared-timing-suggestions";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { SuggestionsBanner } from "@/ui/suggestions-banner";
import { showKeptOwnTimingToast, showReplacedOwnTimingToast } from "@/utils/group-toast";
import { pluralWord, pluralize } from "@/utils/pluralize";
import { songEndOrUnbounded } from "@/utils/timing/song-end";
import { shareGroupTimingWithUndo } from "@/views/timeline/share-group-timing";
import { IconBulb, IconClock } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Functions ----------------------------------------------------------------

function suggestionKey(suggestion: SharedTimingSuggestion): string {
  return suggestion.groupId;
}

function inlineText(suggestion: SharedTimingSuggestion): string {
  const { sourceName, changingCount, replacedCount } = suggestion;
  const ask = `${sourceName} is synced. Share its timing with ${pluralize(changingCount, "instance")}?`;
  if (replacedCount === 0) return ask;
  return `${ask} ${replacedCount} of them ${pluralWord(replacedCount, "loses its", "lose their")} own timing.`;
}

// -- Components ----------------------------------------------------------------

const SharedTimingSuggestionsBanner: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const dismissed = useProjectStore((s) => s.dismissedSuggestions);
  const dismissSuggestion = useProjectStore((s) => s.dismissSuggestion);

  const duration = useAudioStore((s) => s.duration);
  const suggestions = useMemo(
    () => sharedTimingSuggestions(lines, groups, songEndOrUnbounded(duration)),
    [lines, groups, duration],
  );

  const dismissOne = (suggestion: SharedTimingSuggestion) => dismissSuggestion(suggestion.fingerprint);

  const dismissAll = (visible: SharedTimingSuggestion[]) => {
    for (const suggestion of visible) dismissSuggestion(suggestion.fingerprint);
  };

  const acceptOne = (suggestion: SharedTimingSuggestion) => shareGroupTimingWithUndo(suggestion.groupId);

  const acceptAll = (visible: SharedTimingSuggestion[]) => {
    const { duration } = useAudioStore.getState();
    const outcomes = visible.map((suggestion) =>
      useProjectStore.getState().shareGroupTiming(suggestion.groupId, duration),
    );
    showKeptOwnTimingToast(outcomes.flatMap((outcome) => outcome.keptOwnTiming));
    showReplacedOwnTimingToast(outcomes.reduce((sum, outcome) => sum + outcome.realigned.length, 0));
  };

  return (
    // react-doctor-disable-next-line react-doctor/no-render-prop-children
    <SuggestionsBanner<SharedTimingSuggestion>
      suggestions={suggestions}
      dismissed={dismissed}
      icon={IconBulb}
      iconClass="text-composer-accent"
      accentClass="bg-composer-accent/8"
      modalTitle="Shared timing suggestions"
      multiText={(count) => `${pluralize(count, "group")} can share timing`}
      modalCountText={(count) => `${pluralize(count, "group")} with a synced instance`}
      accept={{ label: "Share timing", rowLabel: "Share", icon: IconClock }}
      acceptAll={{ label: "Share all", icon: IconClock }}
      rowKey={suggestionKey}
      renderInline={inlineText}
      renderRow={(suggestion) => (
        <>
          <span className="text-sm text-composer-text">{suggestion.label}</span>
          <span className="text-xs text-composer-text-muted">{inlineText(suggestion)}</span>
        </>
      )}
      onAccept={acceptOne}
      onDismiss={dismissOne}
      onAcceptAll={acceptAll}
      onDismissAll={dismissAll}
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { SharedTimingSuggestionsBanner };
