import { instanceStart, keepsOwnTiming, sharesTiming } from "@/domain/group/shared-timing";
import type { LinkGroup } from "@/domain/group/template";
import { instanceIndicesOf } from "@/domain/instance/enumerate";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { useProjectStore } from "@/stores/project";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { SingerTag } from "@/ui/singer-tag";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { useEffectiveFocus, useEffectiveFocusGroup } from "@/views/timeline/effective-focus";
import { adjacentHeardInstance, focusBounds, heardInstances } from "@/views/timeline/group-focus";
import { hearInstance } from "@/views/timeline/hear-instance";
import { LoopToggle } from "@/views/timeline/loop-toggle";
import { STRIP_BAR, STRIP_TAG, STRIP_TRAY, stripTint } from "@/views/timeline/strip-control";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import {
  SHARING_MENU_LABELS,
  applySharingMenuAction,
  sharingMenuAction,
} from "@/views/timeline/use-shared-timing-menu-actions";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface OpenInstanceProps {
  group: LinkGroup;
  lines: LyricLine[];
  hearInstanceIdx: number;
}

// -- Constants -----------------------------------------------------------------

const STEP_BUTTON = "size-7 rounded-lg";

// -- Functions -----------------------------------------------------------------

function otherInstanceNotes(lines: LyricLine[], group: LinkGroup, hearInstanceIdx: number): string[] {
  if (!group.sharesTiming) return [];
  const others = instanceIndicesOf(lines, group.id).filter((instanceIdx) => instanceIdx !== hearInstanceIdx);
  const ownTiming = others.filter((instanceIdx) => keepsOwnTiming(group, instanceIdx)).length;
  const notPlaced = others.filter(
    (instanceIdx) => sharesTiming(group, instanceIdx) && instanceStart(lines, group.id, instanceIdx) === null,
  ).length;
  return [...(notPlaced > 0 ? [`${notPlaced} not placed`] : []), ...(ownTiming > 0 ? [`${ownTiming} own timing`] : [])];
}

// -- Components ----------------------------------------------------------------

const InstanceStepper: React.FC<OpenInstanceProps> = ({ group, lines, hearInstanceIdx }) => {
  const all = instanceIndicesOf(lines, group.id);
  const hearable = heardInstances(lines, group);
  const counted = hearable.includes(hearInstanceIdx) ? hearable : all;
  const previous = adjacentHeardInstance(lines, group, hearInstanceIdx, -1);
  const next = adjacentHeardInstance(lines, group, hearInstanceIdx, 1);

  return (
    <span className={cn(STRIP_TRAY, "gap-0.5 tabular-nums text-composer-text-muted")}>
      <IconButton
        label="Previous instance"
        variant="ghost"
        className={STEP_BUTTON}
        icon={<IconChevronLeft aria-hidden="true" className="size-3.5" />}
        disabled={previous === null}
        onClick={() => previous !== null && hearInstance(group.id, hearInstanceIdx, previous)}
      />
      <span className="min-w-11 text-center font-mono">
        <span className="sr-only">Instance </span>
        {`${counted.indexOf(hearInstanceIdx) + 1} of ${counted.length}`}
      </span>
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
          size="lg"
          className="shrink-0"
          onClick={() => applySharingMenuAction(sharingAction, group, hearInstanceIdx)}
        >
          {SHARING_MENU_LABELS[sharingAction]}
        </Button>
      )}
    </>
  );
};

const InstanceStatus: React.FC<OpenInstanceProps> = (props) => (
  <span className="flex min-w-0 items-center gap-2 pl-1 whitespace-nowrap tabular-nums text-composer-text-muted">
    {sharesTiming(props.group, props.hearInstanceIdx) ? <SharedSpan {...props} /> : <OwnTimingStatus {...props} />}
    {otherInstanceNotes(props.lines, props.group, props.hearInstanceIdx).map((note) => (
      <span key={note}>{`· ${note}`}</span>
    ))}
  </span>
);

const FocusedGroupBar: React.FC<Omit<OpenInstanceProps, "lines">> = ({ group, hearInstanceIdx }) => {
  const lines = useProjectStore((s) => s.lines);
  const closeGroup = useTimelineStore((s) => s.closeGroup);
  const instance = { group, lines, hearInstanceIdx };

  return (
    <div data-group-focus-bar role="group" aria-label="Open group" className={STRIP_BAR} style={stripTint(group.color)}>
      <SingerTag color={group.color} className={STRIP_TAG}>
        {sharesTiming(group, hearInstanceIdx) ? group.label : instanceName(lines, group, hearInstanceIdx)}
      </SingerTag>
      {sharesTiming(group, hearInstanceIdx) && <InstanceStepper {...instance} />}
      <InstanceStatus {...instance} />
      <span className="flex-1" />
      <LoopToggle />
      <Button size="lg" className="shrink-0 pr-2" onClick={closeGroup}>
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
