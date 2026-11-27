import { ToolInputError } from "@/domain/mcp/tool-args";
import type { LyricLine } from "@/domain/line/model";
import { openProjectIdSnapshot } from "@/lib/open-project-session";
import { useProjectStore } from "@/stores/project";
import { isTransientLines } from "@/stores/project/transient-lines";

// -- Functions ----------------------------------------------------------------

/**
 * The bridge routes a call to the tab showing its project, but the tab may have
 * switched projects since. Never write to whatever happens to be open.
 */
function requireOpenProject(projectId: string | undefined): string {
  const openId = openProjectIdSnapshot();
  if (!openId) throw new ToolInputError("No project is open in this Composer tab.");
  if (projectId && projectId !== openId) {
    throw new ToolInputError(`Project ${projectId} is no longer open in this tab. Call list_projects again.`);
  }
  return openId;
}

function requireEditableLines(): LyricLine[] {
  const { lines } = useProjectStore.getState();
  if (isTransientLines(lines)) {
    throw new ToolInputError("The user is in the middle of an edit in Composer. Try again in a moment.");
  }
  return lines;
}

function linesById(lines: LyricLine[], ids: readonly string[]): Map<string, LyricLine> {
  const byId = new Map(lines.map((line) => [line.id, line]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ToolInputError(`Unknown lineId: ${missing.join(", ")}. Read the ids from get_lines.`);
  }
  return byId;
}

// -- Exports ------------------------------------------------------------------

export { linesById, requireEditableLines, requireOpenProject };
