import { isLinked } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";

// -- Interfaces ---------------------------------------------------------------

interface InstanceRef {
  groupId: string;
  instanceIdx: number;
}

// -- Keys ---------------------------------------------------------------------

function instanceKey(groupId: string, instanceIdx: number): string {
  return `${groupId}:${instanceIdx}`;
}

function lineInstanceKey(line: LyricLine): string | null {
  return isLinked(line) ? instanceKey(line.groupId, line.instanceIdx) : null;
}

function parseInstanceKey(key: string): InstanceRef {
  const separator = key.lastIndexOf(":");
  return { groupId: key.slice(0, separator), instanceIdx: Number.parseInt(key.slice(separator + 1), 10) };
}

// -- Exports ------------------------------------------------------------------

export { instanceKey, lineInstanceKey, parseInstanceKey };
