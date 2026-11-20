import type { Part } from "insync/part";
import type { DocPassthrough } from "insync/passthrough";
import type { LyricLine } from "@/domain/line/model";
import { mainTrack } from "@/domain/line/track";
import { withAgent } from "@/domain/line/track-writes";
import { agentsAfterImport } from "@/domain/agent/imported-agents";
import type { Agent } from "@/domain/agent/model";
import type { LyricCommand } from "@/domain/commands/command";
import { applied, changedLineIds } from "@/domain/commands/outcome";
import type { LinkGroup } from "@/domain/group/template";
import { type EditedLyrics, changesProject, editedLyricsWrite } from "@/domain/project/edited-lyrics";
import type { ProjectMetadata } from "@/domain/project/metadata";

// -- Types --------------------------------------------------------------------

interface KeptFromSource {
  parts?: readonly Part[];
  passthrough?: DocPassthrough;
}

// -- Commands -----------------------------------------------------------------

// The new lyrics bring their own parts and kept TTML data; lyrics without any clear the old ones.
function replaceLyrics(
  lines: LyricLine[],
  groups: LinkGroup[],
  agents: Agent[] | undefined,
  { parts = [], passthrough = {} }: KeptFromSource = {},
): LyricCommand {
  return {
    note: { command: "replace lyrics", args: [lines.length] },
    copiesSharedTiming: false,
    run: (root) => {
      const assignment = agentsAfterImport(root.agents, agents, lines);
      return applied(
        { lines: assignment.lines, groups, agents: assignment.agents, parts, passthrough },
        changedLineIds(root.lines, assignment.lines),
      );
    },
  };
}

// Metadata is read to decide whether anything changed; the caller writes the metadata itself.
function applyEditedLyrics(edited: EditedLyrics, metadata: ProjectMetadata): LyricCommand {
  return {
    note: { command: "apply edited lyrics", args: [edited.lines.length] },
    copiesSharedTiming: false,
    run: (root) => {
      const current = { ...root, metadata };
      const write = editedLyricsWrite(current, edited);
      if (!changesProject(current, write)) return applied(root, []);
      return applied(
        { ...root, lines: write.lines, groups: write.groups, agents: write.agents, ...write.kept },
        changedLineIds(root.lines, write.lines),
      );
    },
  };
}

function removeSinger(id: string): LyricCommand {
  return {
    note: { command: "remove singer", args: [id] },
    copiesSharedTiming: false,
    run: (root) => {
      const fallback = root.agents.find((agent) => agent.id !== id);
      if (!fallback) return applied(root, []);
      const lines = root.lines.map((line) => (mainTrack(line).agentId === id ? withAgent(line, fallback.id) : line));
      return applied(
        { ...root, lines, agents: root.agents.filter((agent) => agent.id !== id) },
        changedLineIds(root.lines, lines),
      );
    },
  };
}

// -- Exports ------------------------------------------------------------------

export { applyEditedLyrics, removeSinger, replaceLyrics };
