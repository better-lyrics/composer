import { useProjectStore } from "@/stores/project";
import { type EditCase, lineById } from "@/test/edited-ttml-edits";
import { LINE_IDENTITY_OPERATIONS } from "@/test/edited-ttml-identity-operations";
import { COMBINED_OPERATIONS, OPERATIONS } from "@/test/edited-ttml-operations";
import { EDITED_TTML_PROJECTS, type EditedTtmlProject } from "@/test/edited-ttml-projects";
import { generateProjectTtml } from "@/utils/ttml";
import { applyEditedTtml } from "@/views/export/apply-edited-ttml";
import { keptTtmlEdits, startedTtmlEdit } from "@/views/export/ttml-edit-keys";
import { describe, expect, it } from "vitest";

// -- Helpers ------------------------------------------------------------------

function keptEditsAfter(editCase: EditCase, project: EditedTtmlProject): string {
  const started = startedTtmlEdit(
    null,
    generateProjectTtml(useProjectStore.getState(), 0),
    editCase.edited,
    project.lines,
  );
  useProjectStore.setState({ lines: editCase.projectChangeBeforeKeepingEdits?.(project.lines) ?? project.lines });
  const current = useProjectStore.getState();
  const kept = keptTtmlEdits(started, generateProjectTtml(current, 0), current.lines);
  useProjectStore.setState({ ttmlEditState: kept });
  return kept.content;
}

// -- Tests --------------------------------------------------------------------

describe("applyEditedTtml · invariants", () => {
  for (const fixture of EDITED_TTML_PROJECTS) {
    for (const operation of [...OPERATIONS, ...COMBINED_OPERATIONS, ...LINE_IDENTITY_OPERATIONS]) {
      it(`${fixture().name}: ${operation.name} changes only what the edit changed`, () => {
        const project = fixture();
        useProjectStore.setState({
          lines: project.lines,
          groups: project.groups,
          agents: project.agents,
          metadata: project.metadata,
        });
        const editCase = operation.edit(project, generateProjectTtml(useProjectStore.getState(), 0));
        const content = editCase.projectChangeBeforeKeepingEdits ? keptEditsAfter(editCase, project) : editCase.edited;

        const result = applyEditedTtml(content, 0);
        expect(result).toMatchObject({ status: "applied" });
        if (editCase.lossless) expect(result).toMatchObject({ keptInExport: false });

        const state = useProjectStore.getState();
        const skipped = new Set([...editCase.touched, ...(editCase.deleted ?? [])]);
        const untouched = project.lines.filter((line) => !skipped.has(line.id));
        for (const line of untouched) expect(lineById(state.lines, line.id)).toEqual(line);
        const ids = state.lines.map((line) => line.id);
        expect(new Set(ids).size).toBe(ids.length);
        if (!editCase.reordered) {
          const kept = new Set(project.lines.map((line) => line.id));
          expect(ids.filter((id) => kept.has(id))).toEqual(
            project.lines.flatMap((line) => (editCase.deleted?.includes(line.id) ? [] : [line.id])),
          );
        }
        expect(state.agents).toEqual(project.agents);
        expect(state.groups).toEqual(project.groups);
        editCase.expectTaken(state.lines);

        const settled = state.lines;
        const again = applyEditedTtml(generateProjectTtml(state, 0), 0);
        expect(again).toEqual({ status: "applied", skipped: 0, keptInExport: false });
        expect(useProjectStore.getState().lines).toBe(settled);
      });
    }
  }
});
