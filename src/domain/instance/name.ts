import type { LinkGroup } from "@/domain/group/template";
import { instanceOrdinal } from "insync/instance-enumerate";
import type { LyricLine } from "insync/line";

// -- Functions ----------------------------------------------------------------

function instanceName(lines: readonly LyricLine[], group: LinkGroup, instanceIdx: number): string {
  const ordinal = instanceOrdinal(lines, group.id, instanceIdx);
  return /\d$/.test(group.label) ? `${group.label} #${ordinal}` : `${group.label} ${ordinal}`;
}

// -- Exports ------------------------------------------------------------------

export { instanceName };
