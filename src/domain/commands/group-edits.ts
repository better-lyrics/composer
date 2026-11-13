import type { LyricCommand } from "@/domain/commands/command";
import { type LyricRoot, type Outcome, applied, changedLineIds, refused } from "@/domain/commands/outcome";
import {
  type GroupPlan,
  type RepeatingSections,
  planGroupSharing,
  planRepeatingSections,
} from "@/domain/group/group-plans";
import { unlinkLines } from "@/domain/group/linking";
import type { SharingOutcome } from "@/domain/group/shared-placement";
import type { LinkGroup } from "@/domain/group/template";
import type { RawLine } from "@/domain/line/model";

// -- Helpers ------------------------------------------------------------------

function appliedPlan(root: LyricRoot, plan: GroupPlan): Outcome {
  if (plan.refusal) return refused(plan.refusal);
  if (!plan.next) return applied(root, []);
  return applied(plan.next, changedLineIds(root.lines, plan.next.lines));
}

function groupEdit(command: string, args: readonly (string | number)[], next: (root: LyricRoot) => LyricRoot) {
  return {
    note: { command, args },
    derivesText: true,
    copiesSharedTiming: false,
    run: (root: LyricRoot) => {
      const edited = next(root);
      return applied(edited, changedLineIds(root.lines, edited.lines));
    },
  } satisfies LyricCommand;
}

// -- Commands -----------------------------------------------------------------

function addGroup(group: LinkGroup): LyricCommand {
  return groupEdit("add group", [group.id], (root) => ({ ...root, groups: [...root.groups, group] }));
}

function addGroupWithLines(group: LinkGroup, lines: RawLine[]): LyricCommand {
  return groupEdit("add group", [group.id], (root) => ({ ...root, groups: [...root.groups, group], lines }));
}

function updateGroup(id: string, updates: Partial<LinkGroup>): LyricCommand {
  return groupEdit("update group", [id], (root) => ({
    ...root,
    groups: root.groups.map((group) => (group.id === id ? { ...group, ...updates } : group)),
  }));
}

function removeGroup(id: string): LyricCommand {
  return groupEdit("remove group", [id], (root) => ({
    ...root,
    groups: root.groups.filter((group) => group.id !== id),
    lines: unlinkLines(root.lines, (line) => line.groupId === id),
  }));
}

// `report` receives the plan's sharing outcome, so the caller never plans a second time.
function reported(plan: GroupPlan, report?: (sharing: SharingOutcome) => void): GroupPlan {
  report?.(plan.sharing);
  return plan;
}

function groupRepeatingSections(sections: RepeatingSections, report?: (sharing: SharingOutcome) => void): LyricCommand {
  return {
    note: { command: "group sections", args: [sections.length, ...sections.starts] },
    derivesText: false,
    copiesSharedTiming: false,
    run: (root, ctx) =>
      appliedPlan(
        root,
        reported(planRepeatingSections(root, sections, ctx.splitChar, ctx.shareTimingInNewGroups), report),
      ),
  };
}

function shareGroupTiming(groupId: string, duration: number, report?: (sharing: SharingOutcome) => void): LyricCommand {
  return {
    note: { command: "share group timing", args: [groupId] },
    derivesText: false,
    copiesSharedTiming: false,
    run: (root) => appliedPlan(root, reported(planGroupSharing(root, groupId, duration), report)),
  };
}

// -- Exports ------------------------------------------------------------------

export { addGroup, addGroupWithLines, groupRepeatingSections, removeGroup, shareGroupTiming, updateGroup };
