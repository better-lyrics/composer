import type { LinkGroup } from "./group";
import { instanceOrdinal } from "./instance-enumerate";
import type { LyricLine } from "./line";

// -- Functions ----------------------------------------------------------------

function instanceName(lines: readonly LyricLine[], group: LinkGroup, instanceIdx: number): string {
  const ordinal = instanceOrdinal(lines, group.id, instanceIdx);
  return /\d$/.test(group.label) ? `${group.label} #${ordinal}` : `${group.label} ${ordinal}`;
}

// -- Exports ------------------------------------------------------------------

export { instanceName };
