import { useEffect, useRef } from "react";
import { linesToEditText } from "@/domain/edit-text/edit-text";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";

// -- Hooks --------------------------------------------------------------------

// The split character the Edit text was written with. A change of setting writes the text again with the new one,
// and until then typed rows are read with the character they show.
function useRenderedSplitCharacter(setRawText: (text: string) => void) {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  const renderedRef = useRef(splitCharacter);
  useEffect(() => {
    if (renderedRef.current === splitCharacter) return;
    renderedRef.current = splitCharacter;
    setRawText(linesToEditText(useProjectStore.getState().lines));
  }, [splitCharacter, setRawText]);
  return renderedRef;
}

// -- Exports ------------------------------------------------------------------

export { useRenderedSplitCharacter };
