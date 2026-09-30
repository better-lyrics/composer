import { instanceStart, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { ToggleButton } from "@/ui/toggle-button";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { useEffectiveFocus, useEffectiveFocusGroup } from "@/views/timeline/effective-focus";
import { adjacentHeardInstance, canHearInstance, focusBounds } from "@/views/timeline/group-focus";
import { hearInstance } from "@/views/timeline/hear-instance";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import { toggleGroupLoop } from "@/views/timeline/toggle-group-loop";
import {
  SHARING_MENU_LABELS,
  applySharingMenuAction,
  sharingMenuAction,
} from "@/views/timeline/use-shared-timing-menu-actions";
import { IconChevronLeft, IconChevronRight, IconRepeat } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface OpenInstanceProps {
  group: LinkGroup;
  lines: LyricLine[];
  hearInstanceIdx: number;
}

// -- Constants -----------------------------------------------------------------

const STRIP_CONTROL = "h-6 rounded-md";
const STEP_BUTTON = "size-6 rounded-md";

// -- Functions -----------------------------------------------------------------

function otherInstanceNotes(lines: LyricLine[], group: LinkGroup, hearInstanceIdx: number): string[] {
  if (!group.sharesTiming) return [];
  const others = instanceIndicesOf(lines, group.id).filter((instanceIdx) => instanceIdx !== hearInstanceIdx);
  const ownTiming = others.filter((instanceIdx) => !sharesTiming(group, instanceIdx)).length;
  const notPlaced = others.filter(
    (instanceIdx) => sharesTiming(group, instanceIdx) && instanceStart(lines, group.id, instanceIdx) === null,
  ).length;
  return [...(notPlaced > 0 ? [`${notPlaced} not placed`] : []), ...(ownTiming > 0 ? [`${ownTiming} own timing`] : [])];
}

// -- Components ----------------------------------------------------------------

const InstanceStepper: React.FC<OpenInstanceProps> = ({ group, lines, hearInstanceIdx }) => {
  const all = instanceIndicesOf(lines, group.id);
  const hearable = all.filter((instanceIdx) => canHearInstance(lines, group, instanceIdx));
  const counted = hearable.includes(hearInstanceIdx) ? hearable : all;
  const previous = adjacentHeardInstance(lines, group, hearInstanceIdx, -1);
  const next = adjacentHeardInstance(lines, group, hearInstanceIdx, 1);

  return (
    <span className="flex items-center gap-0.5 tabular-nums text-composer-text-muted">
      <IconButton
        label="Previous instance"
        variant="ghost"
        className={STEP_BUTTON}
        icon={<IconChevronLeft aria-hidden="true" className="size-3.5" />}
        disabled={previous === null}
        onClick={() => previous !== null && hearInstance(group.id, hearInstanceIdx, previous)}
      />
      <span>{`${counted.indexOf(hearInstanceIdx) + 1} of ${counted.length}`}</span>
      <IconButton
        label="Next instance"
        variant="ghost"
        className={STEP_BUTTON}
        icon={<IconChevronRight aria-hidden="true" className="size-3.5" />}
        disabled={next === null}
        onClick={() => next !== null && hearInstance(group.id, hearInstanceIdx, next)}
      />
    </span>
  );
};

const SharedSpan: React.FC<OpenInstanceProps> = ({ group, lines, hearInstanceIdx }) => {
  const bounds = focusBounds(lines, { groupId: group.id, hearInstanceIdx });
  if (!bounds) return <span>Shared · not placed</span>;
  return (
    <span>
      {"Shared · "}
      <span className="select-text cursor-text">{formatTime(bounds.begin, 2)}</span>
      {" to "}
      <span className="select-text cursor-text">{formatTime(bounds.end, 2)}</span>
    </span>
  );
};

const OwnTimingStatus: React.FC<Omit<OpenInstanceProps, "lines">> = ({ group, hearInstanceIdx }) => {
  const sharingAction = sharingMenuAction(group, hearInstanceIdx);
  return (
    <>
      <span>Own timing</span>
      {sharingAction && (
        <Button
          size="sm"
          className={STRIP_CONTROL}
          onClick={() => applySharingMenuAction(sharingAction, group, hearInstanceIdx)}
        >
          {SHARING_MENU_LABELS[sharingAction]}
        </Button>
      )}
    </>
  );
};

const InstanceStatus: React.FC<OpenInstanceProps> = (props) => (
  <span className="flex items-center gap-2 tabular-nums text-composer-text-muted">
    {sharesTiming(props.group, props.hearInstanceIdx) ? <SharedSpan {...props} /> : <OwnTimingStatus {...props} />}
    {otherInstanceNotes(props.lines, props.group, props.hearInstanceIdx).map((note) => (
      <span key={note}>{`· ${note}`}</span>
    ))}
  </span>
);

const LoopToggle: React.FC = () => {
  const loop = useSettingsStore((s) => s.loopOpenGroup);
  return (
    <Tooltip
      content={
        <>
          Loop the open group
          <InlineKeyBadge keys={getEffectiveKeysArray("timeline.toggleGroupLoop")} />
        </>
      }
    >
      <ToggleButton pressed={loop} size="sm" hasIcon className={STRIP_CONTROL} onClick={toggleGroupLoop}>
        <IconRepeat aria-hidden="true" className="size-3.5" />
        Loop
      </ToggleButton>
    </Tooltip>
  );
};

const FocusedGroupBar: React.FC<Omit<OpenInstanceProps, "lines">> = ({ group, hearInstanceIdx }) => {
  const lines = useProjectStore((s) => s.lines);
  const closeGroup = useTimelineStore((s) => s.closeGroup);
  const instance = { group, lines, hearInstanceIdx };

  return (
    <div
      data-group-focus-bar
      role="toolbar"
      aria-label="Open group"
      className="flex h-8 shrink-0 select-none items-center gap-3 border-b border-composer-border pl-3 pr-2 text-xs"
      style={{ background: `color-mix(in srgb, ${group.color} 7%, var(--color-composer-bg-dark))` }}
    >
      <span className="flex items-center gap-1.5 font-semibold text-composer-text">
        <span aria-hidden="true" className="size-2 rounded-xs" style={{ background: group.color }} />
        {instanceName(lines, group, hearInstanceIdx)}
      </span>
      {sharesTiming(group, hearInstanceIdx) && <InstanceStepper {...instance} />}
      <InstanceStatus {...instance} />
      <span className="flex-1" />
      <LoopToggle />
      <Button size="sm" className={cn(STRIP_CONTROL, "pl-2.5 pr-1.5")} onClick={closeGroup}>
        Done
        <InlineKeyBadge keys={getEffectiveKeysArray("timeline.closeGroup")} />
      </Button>
    </div>
  );
};

const GroupFocusBar: React.FC = () => {
  const focus = useEffectiveFocus();
  const group = useEffectiveFocusGroup();
  if (!focus || !group) return null;
  return <FocusedGroupBar group={group} hearInstanceIdx={focus.hearInstanceIdx} />;
};

// -- Exports -------------------------------------------------------------------

export { GroupFocusBar };
