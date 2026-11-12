import type { LinkGroup } from "@/domain/group/template";
import { instanceName } from "@/domain/instance/name";
import type { LyricLine } from "@/domain/line/model";
import { textToLyricLines } from "@/utils/lyrics-text";
import { editTextWithRewrittenRows } from "@/views/edit/edit-text";
import {
  detachInstancesFromLines,
  diffEditTextChange,
  findStructurallyImpactedInstances,
  type ImpactedInstance,
  propagateContentUpdates,
} from "@/views/edit/diff-edit-text";

// -- Types --------------------------------------------------------------------

type EditTextAction =
  | { kind: "noop" }
  | { kind: "apply"; finalLines: LyricLine[]; editText: string }
  | { kind: "detach"; finalLines: LyricLine[]; groups: LinkGroup[]; detachedNames: string[] };

interface DecideOptions {
  text: string;
  defaultAgentId: string;
  lines: LyricLine[];
  groups: LinkGroup[];
}

// -- Helpers ------------------------------------------------------------------

function detachedInstanceNames(lines: LyricLine[], impacted: ImpactedInstance[], groups: LinkGroup[]): string[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  return impacted.flatMap(({ groupId, instanceIdx }) => {
    const group = groupsById.get(groupId);
    return group ? [instanceName(lines, group, instanceIdx)] : [];
  });
}

function detachAction(
  lines: LyricLine[],
  lyricLines: LyricLine[],
  impacted: ImpactedInstance[],
  groups: LinkGroup[],
): Extract<EditTextAction, { kind: "detach" }> {
  const finalLines = detachInstancesFromLines(lyricLines, impacted);
  const remainingGroupIds = new Set(finalLines.flatMap((line) => (line.groupId ? [line.groupId] : [])));
  return {
    kind: "detach",
    finalLines,
    groups: groups.filter((group) => remainingGroupIds.has(group.id)),
    detachedNames: detachedInstanceNames(lines, impacted, groups),
  };
}

function decideEditTextAction({ text, defaultAgentId, lines, groups }: DecideOptions): EditTextAction {
  const lyricLines = textToLyricLines(text, defaultAgentId, lines);
  const diff = diffEditTextChange(lines, lyricLines);

  if (diff.hasStructuralChange) {
    const impacted = findStructurallyImpactedInstances(lines, lyricLines);
    if (impacted.length > 0) return detachAction(lines, lyricLines, impacted, groups);
    return { kind: "apply", finalLines: lyricLines, editText: text };
  }

  if (diff.contentUpdates.length === 0) return { kind: "noop" };
  const finalLines = propagateContentUpdates(lines, lyricLines, diff.contentUpdates);
  return { kind: "apply", finalLines, editText: editTextWithRewrittenRows(text, lyricLines, finalLines) };
}

// -- Exports ------------------------------------------------------------------

export { decideEditTextAction };
