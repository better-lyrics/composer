import type { LinkGroup } from "@/domain/group/template";

// -- Types --------------------------------------------------------------------

type GroupSharing = Pick<LinkGroup, "sharesTiming" | "ownTimingInstances">;

// -- Functions ----------------------------------------------------------------

function withSharing(group: LinkGroup, sharing: GroupSharing): LinkGroup {
  const { sharesTiming: _sharesTiming, ownTimingInstances: _ownTimingInstances, ...rest } = group;
  return { ...rest, ...sharing };
}

function withOwnTiming(group: LinkGroup, instanceIdx: number, own: boolean): LinkGroup {
  const others = (group.ownTimingInstances ?? []).filter((idx) => idx !== instanceIdx);
  const ownTimingInstances = own ? [...others, instanceIdx].toSorted((a, b) => a - b) : others;
  return withSharing(group, {
    ...(group.sharesTiming ? { sharesTiming: true } : {}),
    ...(ownTimingInstances.length ? { ownTimingInstances } : {}),
  });
}

function withNewInstance(groups: readonly LinkGroup[], groupId: string, instanceIdx: number): LinkGroup[] {
  return groups.map((group) => (group.id === groupId ? withOwnTiming(group, instanceIdx, false) : group));
}

// -- Exports ------------------------------------------------------------------

export { withNewInstance, withOwnTiming, withSharing };
