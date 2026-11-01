import { agentsAfterImport } from "@/domain/agent/imported-agents";
import type { Agent } from "@/domain/agent/model";
import { placeholderAgentName } from "@/domain/agent/placeholder-name";
import type { LinkGroup } from "@/domain/group/template";
import type { RawLine } from "@/domain/line/model";
import { changedMetadata } from "@/domain/project/imported-metadata";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { isStructurallyEqual } from "@/utils/structural-equal";

// -- Types --------------------------------------------------------------------

interface EditedLyrics {
  lines: RawLine[];
  groups: LinkGroup[];
  agents: Agent[] | undefined;
  metadata: Partial<ProjectMetadata>;
}

interface ProjectLyrics {
  lines: readonly RawLine[];
  groups: readonly LinkGroup[];
  agents: readonly Agent[];
  metadata: ProjectMetadata;
}

type ProjectPart = "lines" | "metadata" | "agents" | "groups";

interface EditedLyricsWrite {
  lines: RawLine[];
  groups: LinkGroup[];
  agents: Agent[];
  metadata: Partial<ProjectMetadata>;
}

// -- Helpers ------------------------------------------------------------------

function withUnnamedAgentsKept(current: readonly Agent[], incoming: Agent[] | undefined): Agent[] | undefined {
  const currentById = new Map(current.map((agent) => [agent.id, agent] as const));
  return incoming?.map((agent, position) => {
    const existing = currentById.get(agent.id);
    return existing && !existing.name && agent.name === placeholderAgentName(position)
      ? { ...agent, name: existing.name }
      : agent;
  });
}

// -- Functions ----------------------------------------------------------------

function editedLyricsWrite(current: ProjectLyrics, edited: EditedLyrics): EditedLyricsWrite {
  const agents = withUnnamedAgentsKept(current.agents, edited.agents);
  const assignment = agentsAfterImport(current.agents, agents, edited.lines);
  return {
    lines: assignment.lines,
    groups: edited.groups,
    agents: assignment.agents,
    metadata: changedMetadata(current.metadata, edited.metadata),
  };
}

function changedParts(current: ProjectLyrics, write: EditedLyricsWrite): ProjectPart[] {
  const changes: [ProjectPart, boolean][] = [
    ["lines", !isStructurallyEqual(current.lines, write.lines)],
    ["metadata", Object.keys(write.metadata).length > 0],
    ["agents", !isStructurallyEqual(current.agents, write.agents)],
    ["groups", !isStructurallyEqual(current.groups, write.groups)],
  ];
  return changes.flatMap(([part, changed]) => (changed ? [part] : []));
}

function changesProject(current: ProjectLyrics, write: EditedLyricsWrite): boolean {
  return changedParts(current, write).length > 0;
}

// -- Exports ------------------------------------------------------------------

export { changedParts, changesProject, editedLyricsWrite };
export type { EditedLyrics, ProjectPart };
