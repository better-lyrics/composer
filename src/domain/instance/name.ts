import type { LinkGroup } from "@/domain/group/template";
import { instanceCount, instanceOrdinal } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function nameWithOrdinal(label: string, ordinal: number): string {
  return /\d$/.test(label) ? `${label} #${ordinal}` : `${label} ${ordinal}`;
}

function instanceName(lines: readonly LyricLine[], group: LinkGroup, instanceIdx: number): string {
  return nameWithOrdinal(group.label, instanceOrdinal(lines, group.id, instanceIdx));
}

function nextInstanceName(lines: readonly LyricLine[], group: LinkGroup): string {
  return nameWithOrdinal(group.label, instanceCount(lines, group.id) + 1);
}

// -- Exports ------------------------------------------------------------------

export { instanceName, nextInstanceName };
