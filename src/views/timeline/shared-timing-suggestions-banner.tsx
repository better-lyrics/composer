import { type SharedTimingSuggestion, sharedTimingSuggestions } from "@/domain/group/shared-timing-suggestions";
import { useProjectStore } from "@/stores/project";
import { offerToShareTiming } from "@/utils/group-toast";
import { pluralize } from "@/utils/pluralize";
import { shareGroupTimingWithUndo } from "@/views/timeline/share-group-timing";
import { SuggestionsBanner } from "@/views/timeline/suggestions-banner";
import { IconBulb, IconClock } from "@tabler/icons-react";
import { useMemo } from "react";

// -- Functions ----------------------------------------------------------------

function suggestionKey(suggestion: SharedTimingSuggestion): string {
  return suggestion.groupId;
}

function inlineText(suggestion: SharedTimingSuggestion): string {
  return `${suggestion.sourceName} is synced. Share its timing with ${pluralize(suggestion.untimedCount, "instance")}?`;
}

// -- Components ----------------------------------------------------------------

const SharedTimingSuggestionsBanner: React.FC = () => {
  const lines = useProjectStore((s) => s.lines);
  const groups = useProjectStore((s) => s.groups);
  const dismissed = useProjectStore((s) => s.dismissedSuggestions);
  const dismissSuggestion = useProjectStore((s) => s.dismissSuggestion);

  const suggestions = useMemo(() => sharedTimingSuggestions(lines, groups), [lines, groups]);

  const dismissOne = (suggestion: SharedTimingSuggestion) => dismissSuggestion(suggestion.fingerprint);

  const dismissAll = (visible: SharedTimingSuggestion[]) => {
    for (const suggestion of visible) dismissSuggestion(suggestion.fingerprint);
  };

  const acceptOne = (suggestion: SharedTimingSuggestion) => shareGroupTimingWithUndo(suggestion.groupId);

  const acceptAll = (visible: SharedTimingSuggestion[]) => {
    for (const suggestion of visible) useProjectStore.getState().shareGroupTiming(suggestion.groupId);
    const sharedIds = new Set(visible.map((suggestion) => suggestion.groupId));
    offerToShareTiming(useProjectStore.getState().groups.filter((group) => sharedIds.has(group.id)));
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
