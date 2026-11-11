import { useGeneratedTtml } from "@/hooks/use-generated-ttml";
import { useProjectStore } from "@/stores/project";
import type { TtmlEditState } from "@/stores/project/types";
import { rebaseTtmlEdits } from "@/utils/ttml-merge";

// -- Types --------------------------------------------------------------------

type TtmlEdit = NonNullable<TtmlEditState>;
type RebaseResult = ReturnType<typeof rebaseTtmlEdits>;

// -- State --------------------------------------------------------------------

let lastEdit: TtmlEdit | null = null;
let lastGenerated = "";
let lastRebase: RebaseResult | null = null;

// -- Functions ----------------------------------------------------------------

function sharedRebase(edit: TtmlEdit, generated: string): RebaseResult {
  if (lastRebase === null || edit !== lastEdit || generated !== lastGenerated) {
    lastRebase = rebaseTtmlEdits(edit.source, edit.content, generated);
    lastEdit = edit;
    lastGenerated = generated;
  }
  return lastRebase;
}

// -- Hooks --------------------------------------------------------------------

function useExportTtml() {
  const editState = useProjectStore((state) => state.ttmlEditState);
  const savedExportTiming = useProjectStore((state) => state.exportTiming);
  const setExportTiming = useProjectStore((state) => state.setExportTiming);
  const editBlocksLineTiming = editState !== null;
  const exportTiming = editBlocksLineTiming ? "word" : savedExportTiming;
  const generated = useGeneratedTtml(exportTiming);
  const setEditState = useProjectStore((state) => state.setTtmlEditState);
  const drift = editState !== null && editState.source !== generated.content;
  const rebased = editState !== null && drift ? sharedRebase(editState, generated.content) : null;
  const editedContent =
    editState === null
      ? null
      : !drift
        ? editState.content
        : rebased?.status === "clean"
          ? rebased.content
          : editState.content;

  return {
    ...generated,
    content: editedContent ?? generated.content,
    editState,
    editedContent,
    editBlocksLineTiming,
    exportTiming,
    setExportTiming,
    generatedContent: generated.content,
    hasConflict: drift && rebased?.status === "conflict",
    setEditState,
  };
}

// -- Exports ------------------------------------------------------------------

export { useExportTtml };
