import { toast } from "sonner";
import { belongsToInstance } from "@/domain/instance/predicates";
import type { LyricLine } from "@/domain/line/model";
import { backgroundTrack, mainTrack, timedSyllables } from "@/domain/line/track";
import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import type { ClipboardData, ClipboardEntry } from "@/views/timeline/selection-types";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// Builds a ClipboardData payload covering every word and bg word of the
// (groupId, instanceIdx) instance, then sets it as the active clipboard and
// opens the paste-preview ghost so the user can place it manually.
//
// Used by Cmd+D and "Add instance at playhead" when the playhead has no room
// for the new instance: instead of silently appending at end-of-list, we copy
// the source instance and let the user place it via the existing paste-preview
// flow.
function copyInstanceToClipboardAndPreview(lines: LyricLine[], groupId: string, instanceIdx: number): boolean {
  const instanceLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (belongsToInstance(l, groupId, instanceIdx)) instanceLineIndices.push(i);
  }
  if (instanceLineIndices.length === 0) return false;

  const minLineIndex = instanceLineIndices[0];
  const entries: ClipboardEntry[] = [];

  for (const lineIdx of instanceLineIndices) {
    const line = lines[lineIdx];
    for (const word of timedSyllables(mainTrack(line))) {
      entries.push({ word: { ...word }, lineOffset: lineIdx - minLineIndex, trackType: "word" });
    }
    for (const word of timedSyllables(backgroundTrack(line))) {
      entries.push({ word: { ...word }, lineOffset: lineIdx - minLineIndex, trackType: "bg" });
    }
  }

  if (entries.length === 0) return false;
  entries.sort((a, b) => a.lineOffset - b.lineOffset || a.word.begin - b.word.begin);

  const clipboard: ClipboardData = { entries, sourceInstance: { groupId, instanceIdx } };
  useTimelineStore.getState().setClipboard(clipboard);
  useTimelineStore.getState().setPasteMode({ status: "preview", clipboard });
  const pasteKeys = getEffectiveKeysArray("timeline.paste").join("+");
  toast(`No room at the playhead. ${pasteKeys} to paste somewhere clear.`);
  return true;
}

// -- Exports ------------------------------------------------------------------

export { copyInstanceToClipboardAndPreview };
