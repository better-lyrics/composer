import { useCallback, useState } from "react";
import { remapBackgroundRanges } from "@/domain/edit-text/background-ranges";
import { type ShownEditText, shownEditText } from "@/domain/edit-text/shown-row";
import type { LyricLine } from "insync/line";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";

// -- Types --------------------------------------------------------------------

interface ShownText extends ShownEditText {
  splitCharacter: string;
}

// -- Hooks --------------------------------------------------------------------

// The Edit text, where it shows background tracks inline, and the split character it was written with. A change of
// setting writes the text again with the new one while rendering; until then typed rows are read with the character
// they show.
function useShownEditText(lines: readonly LyricLine[]) {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  const [shownText, setShownText] = useState<ShownText>(() => ({
    ...shownEditText(lines, getSplitCharacter()),
    splitCharacter,
  }));
  if (shownText.splitCharacter !== splitCharacter)
    setShownText({ ...shownEditText(lines, getSplitCharacter()), splitCharacter });
  // Typed text keeps its inline backgrounds where the keystroke left them.
  const setRawText = useCallback(
    (text: string, caret?: number) =>
      setShownText((shown) =>
        shown.text === text
          ? shown
          : { ...shown, text, ranges: remapBackgroundRanges(shown.text, text, shown.ranges, caret) },
      ),
    [],
  );
  const showEditText = useCallback(
    (edit: ShownEditText) =>
      setShownText((shown) =>
        shown.text === edit.text && shown.ranges === edit.ranges ? shown : { ...shown, ...edit },
      ),
    [],
  );
  const showLines = useCallback(
    (shownLines: readonly LyricLine[]) => showEditText(shownEditText(shownLines, getSplitCharacter())),
    [showEditText],
  );
  return { shownText, setRawText, showEditText, showLines };
}

// -- Exports ------------------------------------------------------------------

export { useShownEditText };
