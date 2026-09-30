import { instanceStart, sharedInstancesInLineOrder, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SegmentedControl } from "@/ui/segmented-control";
import { formatTime } from "@/utils/format-time";
import { pluralize } from "@/utils/pluralize";
import { useEffectiveFocus } from "@/views/timeline/effective-focus";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  SHARING_MENU_LABELS,
  applySharingMenuAction,
  sharingMenuAction,
} from "@/views/timeline/use-shared-timing-menu-actions";
import { IconChevronLeft, IconClock } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface FocusedGroupProps {
  group: LinkGroup;
  lines: LyricLine[];
  hearInstanceIdx: number;
}

// -- Components ----------------------------------------------------------------

const HearSwitch: React.FC<FocusedGroupProps> = ({ group, lines, hearInstanceIdx }) => {
  const openGroup = useTimelineStore((s) => s.openGroup);
  const options = instanceIndicesOf(lines, group.id).map((instanceIdx) => ({
    value: String(instanceIdx),
    label: instanceName(lines, group, instanceIdx),
    disabled: !sharesTiming(group, instanceIdx) || instanceStart(lines, group.id, instanceIdx) === null,
  }));

  return (
    <>
      <span className="text-composer-text-muted">Hear</span>
      <SegmentedControl
        aria-label="Hear"
        value={String(hearInstanceIdx)}
        options={options}
        onChange={(value) => openGroup(group.id, Number(value))}
        className="h-7"
      />
    </>
  );
};

const NotIncludedRow: React.FC<FocusedGroupProps> = ({ group, lines, hearInstanceIdx }) => {
  if (!group.sharesTiming) return null;
  const excluded = instanceIndicesOf(lines, group.id).filter(
    (instanceIdx) => instanceIdx !== hearInstanceIdx && !sharesTiming(group, instanceIdx),
  );
  if (excluded.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-composer-border bg-composer-bg-dark px-4 py-1 text-composer-text-muted">
      <IconClock aria-hidden="true" className="size-3.5" />
      <span>Not included:</span>
      {excluded.map((instanceIdx) => (
        <span key={instanceIdx} className="flex items-center gap-1">
          <span>{`${instanceName(lines, group, instanceIdx)} (own timing)`}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-composer-link"
            onClick={() => applySharingMenuAction("share-timing", group, instanceIdx)}
          >
            Share timing
          </Button>
        </span>
      ))}
    </div>
  );
};

const FocusedGroupBar: React.FC<Omit<FocusedGroupProps, "lines">> = ({ group, hearInstanceIdx }) => {
  const lines = useProjectStore((s) => s.lines);
  const closeGroup = useTimelineStore((s) => s.closeGroup);
  const sharingAction = sharingMenuAction(group, hearInstanceIdx);
  const start = instanceStart(lines, group.id, hearInstanceIdx);
  const sharedCount = sharedInstancesInLineOrder(lines, group).length;

  return (
    <div data-group-focus-bar className="select-none border-b border-composer-border text-xs">
      <div
        className="flex items-center gap-2.5 px-4 py-1.5"
        style={{ background: `color-mix(in srgb, ${group.color} 10%, var(--color-composer-bg-dark))` }}
      >
        <Button variant="ghost" size="sm" hasIcon onClick={closeGroup}>
          <IconChevronLeft aria-hidden="true" className="size-3.5" />
          Song
        </Button>
        <span className="text-composer-text-muted">/</span>
        <span className="flex items-center gap-1.5 font-semibold text-composer-text">
          <span aria-hidden="true" className="size-2 rounded-xs" style={{ background: group.color }} />
          <span>{group.label}</span>
          {group.sharesTiming && (
            <span className="font-normal text-composer-text-muted">{`· ${pluralize(sharedCount, "shared instance")}`}</span>
          )}
        </span>
        <span className="flex-1" />
        {sharesTiming(group, hearInstanceIdx) ? (
          <HearSwitch group={group} lines={lines} hearInstanceIdx={hearInstanceIdx} />
        ) : (
          sharingAction && (
            <Button size="sm" onClick={() => applySharingMenuAction(sharingAction, group, hearInstanceIdx)}>
              {SHARING_MENU_LABELS[sharingAction]}
            </Button>
          )
        )}
        {start !== null && (
          <span className="select-text cursor-text tabular-nums text-composer-text-muted">{formatTime(start, 2)}</span>
        )}
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.closeGroup")} />
      </div>
      <NotIncludedRow group={group} lines={lines} hearInstanceIdx={hearInstanceIdx} />
    </div>
  );
};

const GroupFocusBar: React.FC = () => {
  const focusedGroup = useEffectiveFocus();
  const group = useProjectStore((s) => s.groups.find((candidate) => candidate.id === focusedGroup?.groupId));
  if (!focusedGroup || !group) return null;
  return <FocusedGroupBar group={group} hearInstanceIdx={focusedGroup.hearInstanceIdx} />;
};

// -- Exports -------------------------------------------------------------------

export { GroupFocusBar };
