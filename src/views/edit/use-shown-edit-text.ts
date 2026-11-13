import { useCallback, useState } from "react";
import { linesToEditText } from "@/domain/edit-text/edit-text";
import type { LyricLine } from "@/domain/line/model";
import { useSettingsStore } from "@/stores/settings";

// -- Types --------------------------------------------------------------------

interface ShownEditText {
  text: string;
  splitCharacter: string;
}

// -- Hooks --------------------------------------------------------------------

// The Edit text and the split character it was written with. A change of setting writes the text again with the new
// one while rendering; until then typed rows are read with the character they show.
function useShownEditText(lines: readonly LyricLine[]) {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  const [shownText, setShownText] = useState<ShownEditText>(() => ({ text: linesToEditText(lines), splitCharacter }));
  if (shownText.splitCharacter !== splitCharacter) setShownText({ text: linesToEditText(lines), splitCharacter });
  const setRawText = useCallback(
    (text: string) => setShownText((shown) => (shown.text === text ? shown : { ...shown, text })),
    [],
  );
  return { shownText, setRawText };
}

// -- Exports ------------------------------------------------------------------

export { useShownEditText };
