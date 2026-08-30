import { useGeneratedTtml } from "@/hooks/use-generated-ttml";
import { useUIStore } from "@/stores/ui";
import { rebaseTtmlEdits } from "@/utils/ttml-merge";
import { useMemo } from "react";

function useExportTtml() {
  const generated = useGeneratedTtml();
  const editState = useUIStore((state) => state.ttmlEditState);
  const setEditState = useUIStore((state) => state.setTtmlEditState);
  const drift = editState !== null && editState.source !== generated.content;
  const rebased = useMemo(
    () =>
      editState !== null && drift ? rebaseTtmlEdits(editState.source, editState.content, generated.content) : null,
    [editState, drift, generated.content],
  );
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
    generatedContent: generated.content,
    hasConflict: drift && rebased?.status === "conflict",
    setEditState,
  };
}

export { useExportTtml };
