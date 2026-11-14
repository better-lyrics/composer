import type { LyricLine } from "@/domain/line/model";
import { lineText } from "@/domain/line/text";
import { hasLyricLines } from "@/domain/project/lyrics-presence";
import { noteGuideSignal } from "@/lib/guide-signals";
import { useSettingsStore } from "@/stores/settings";

// -- Functions ----------------------------------------------------------------

function lyricsText(lines: readonly LyricLine[]): string {
  return lines.map((line) => lineText(line)).join("\n");
}

function noteTypedLyrics(lines: readonly LyricLine[]): void {
  if (!hasLyricLines(lines)) return;
  noteGuideSignal("edit.type");
  const { splitCharacter } = useSettingsStore.getState();
  if (splitCharacter && lyricsText(lines).includes(splitCharacter)) noteGuideSignal("edit.presplit");
}

// -- Exports ------------------------------------------------------------------

export { lyricsText, noteTypedLyrics };
