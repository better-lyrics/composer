import { useCallback, useRef } from "react";
import { extractBackgroundVocalsOnLines } from "insync/background-vocal-typed-extraction";
import { typeLyrics } from "insync/commands/edit-text";
import type { LyricLine } from "insync/line";
import { songEndOrUnbounded } from "insync/song-end";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { getSplitCharacter } from "@/utils/split-character";
import { rowTypingInGroup, settingsExtractOptions } from "@/views/edit/typed-background-extraction";

// -- Interfaces ----------------------------------------------------------------

interface HeldGroup {
  lineId: string;
  lines: readonly LyricLine[];
}

// -- Hooks ---------------------------------------------------------------------

// A bracket group typed with the caret inside waits; once the caret leaves it with no other edit, the group extracts
// as part of the typing step, so it never stays raw text.
function useHeldBracketGroup() {
  const heldRef = useRef<HeldGroup | null>(null);

  const hold = useCallback((lineId: string | undefined) => {
    heldRef.current = lineId === undefined ? null : { lineId, lines: useProjectStore.getState().lines };
  }, []);

  const releaseLeftGroup = useCallback((event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const held = heldRef.current;
    if (!held) return;
    const textarea = event.currentTarget;
    const { lines, commit } = useProjectStore.getState();
    const typingRow = rowTypingInGroup({ text: textarea.value, caret: textarea.selectionEnd });
    if (typingRow !== null && lines[typingRow]?.id === held.lineId) return;
    heldRef.current = null;
    if (lines !== held.lines || !useSettingsStore.getState().autoExtractBackgroundVocals) return;
    const songEnd = songEndOrUnbounded(useAudioStore.getState().duration);
    const ids = new Set([held.lineId]);
    const extracted = extractBackgroundVocalsOnLines(
      lines,
      ids,
      settingsExtractOptions(),
      getSplitCharacter(),
      songEnd,
    );
    if (extracted !== lines) commit(typeLyrics(lines, extracted), "amend");
  }, []);

  return { hold, releaseLeftGroup };
}

// -- Exports -------------------------------------------------------------------

export { useHeldBracketGroup };
