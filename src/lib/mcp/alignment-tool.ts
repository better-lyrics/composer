import { reconcileLine } from "@/domain/line/model";
import { alignLineToSlices } from "@/domain/language/slice-alignment";
import { lineIssues } from "@/domain/mcp/line-view";
import { type ToolArgs, alignmentLines, optionalBoolean, optionalString } from "@/domain/mcp/tool-args";
import { mappedSyllables } from "@/lib/mcp/language-tools";
import { linesById, requireEditableLines, requireOpenProject } from "@/lib/mcp/tool-project";
import { useProjectStore } from "@/stores/project";

// -- Tool ---------------------------------------------------------------------

function alignTransliteration(args: ToolArgs): unknown {
  requireOpenProject(optionalString(args, "projectId"));
  const lines = requireEditableLines();
  const input = alignmentLines(args);
  const dryRun = optionalBoolean(args, "dryRun");
  const byId = linesById(
    lines,
    input.map((line) => line.lineId),
  );
  const store = useProjectStore.getState();
  const { lines: baseline, isDirtySinceHistory: baselineWasDirty } = store;
  const working = new Map(byId);
  const results = input.map(({ lineId, part, slices }) => {
    const line = working.get(lineId);
    if (!line) return { lineId, part, error: "Unknown line." };
    const aligned = alignLineToSlices(line, part, slices);
    if ("error" in aligned) return { lineId, part, error: aligned.error };
    const next = reconcileLine({ ...line, ...aligned.updates });
    working.set(lineId, next);
    if (!dryRun) store.updateLine(lineId, aligned.updates, { deriveText: false });
    return {
      lineId,
      part,
      syllables: mappedSyllables(part === "main" ? next.words : next.backgroundWords),
      remainingIssues: lineIssues(next),
    };
  });
  const saved = results.filter((result) => !("error" in result)).length;
  // Same write as the Align dialog's Save: a language-only edit that must not
  // reach the shared timing copy history writes run, recorded as one step.
  if (!dryRun && saved > 0) store.commitPendingLineEdit(baseline, baselineWasDirty);
  return { dryRun, saved: dryRun ? 0 : saved, failed: results.length - saved, lines: results };
}

// -- Exports ------------------------------------------------------------------

export { alignTransliteration };
