import type { LinkGroup } from "@/domain/group/template";
import { instanceOrdinal } from "@/domain/instance/enumerate";
import type { LyricLine } from "@/domain/line/model";

// -- Functions ----------------------------------------------------------------

function instanceName(lines: readonly LyricLine[], group: LinkGroup, instanceIdx: number): string {
  return `${group.label} ${instanceOrdinal(lines, group.id, instanceIdx)}`;
}

// -- Exports ------------------------------------------------------------------

export { instanceName };
