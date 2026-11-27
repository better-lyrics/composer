import { lineView } from "@/domain/mcp/line-view";
import { type ToolArgs, ToolInputError, editedLines, optionalString } from "@/domain/mcp/tool-args";
import { linesById, requireEditableLines, requireOpenProject } from "@/lib/mcp/tool-project";
import { useProjectStore } from "@/stores/project";
import { getSplitCharacter } from "@/utils/split-character";
import { decideEditTextAction } from "@/views/edit/decide-edit-text-action";
import { linesToEditText } from "@/views/edit/edit-text";

// -- Tool ---------------------------------------------------------------------

/**
 * Rewrites rows of the Edit tab's text and runs it through the same decision a
 * typed edit gets, so matching syllables keep their timing and changed ones are
 * reconciled exactly as they would be for a person. Rows are never added or
 * removed, and timing is never set directly.
 */
function editLines(args: ToolArgs): unknown {
  requireOpenProject(optionalString(args, "projectId"));
  const lines = requireEditableLines();
  const input = editedLines(args);
  linesById(
    lines,
    input.map((line) => line.lineId),
  );
  const indexById = new Map(lines.map((line, index) => [line.id, index]));
  const rows = linesToEditText(lines).split("\n");
  const edited = new Set<number>();
  for (const { lineId, text } of input) {
    const index = indexById.get(lineId) ?? -1;
    rows[index] = text.trim();
    edited.add(index);
  }

  const { groups, agents } = useProjectStore.getState();
  const action = decideEditTextAction({
    text: rows.join("\n"),
    defaultAgentId: agents[0]?.id ?? "v1",
    lines,
    groups,
    modalPending: false,
  });
  if (action.kind === "needs-confirm") {
    throw new ToolInputError(
      `This edit would detach ${action.labels.join(", ") || "linked instances"} from their link. Ask the user to make it in Composer's Edit tab.`,
    );
  }
  if (action.kind !== "apply") return { saved: 0, lines: [] };

  useProjectStore.getState().setLinesWithHistory(action.finalLines);
  const after = useProjectStore.getState().lines;
  return {
    saved: edited.size,
    splitCharacter: getSplitCharacter(),
    lines: [...edited]
      .toSorted((a, b) => a - b)
      .flatMap((index) => (after[index] ? [lineView(after[index], index)] : [])),
  };
}

// -- Exports ------------------------------------------------------------------

export { editLines };
