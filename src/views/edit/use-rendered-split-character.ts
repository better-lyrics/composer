import { type RefObject, useEffect } from "react";
import { linesToEditText } from "@/domain/edit-text/edit-text";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";

// -- Hooks --------------------------------------------------------------------

// `renderedRef` holds the split character the Edit text was written with. A change of setting writes the text again
// with the new one; until then typed rows are read with the character they show.
function useRenderedSplitCharacter(renderedRef: RefObject<string>, setRawText: (text: string) => void) {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  useEffect(() => {
    if (renderedRef.current === splitCharacter) return;
    renderedRef.current = splitCharacter;
    setRawText(linesToEditText(useProjectStore.getState().lines));
  }, [renderedRef, splitCharacter, setRawText]);
}

// -- Exports ------------------------------------------------------------------

export { useRenderedSplitCharacter };
