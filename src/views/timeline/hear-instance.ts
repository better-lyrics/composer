import { instanceOffset } from "@/domain/group/shared-timing";
import { notePlacement } from "@/lib/replay-cue";
import { livePlaybackTime, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useTimelineStore } from "@/views/timeline/timeline-store";

// -- Functions ----------------------------------------------------------------

// Keeps the playhead at the same moment of the chorus, so switching instances never loses your place.
function hearInstance(groupId: string, fromInstanceIdx: number, toInstanceIdx: number): void {
  const offset = instanceOffset(useProjectStore.getState().lines, groupId, fromInstanceIdx, toInstanceIdx);
  useTimelineStore.getState().openGroup(groupId, toInstanceIdx);
  const audio = useAudioStore.getState();
  if (offset === null) return;
  const target = livePlaybackTime() + offset;
  audio.seekTo(target);
  notePlacement(target, "keyboard");
}

// -- Exports ------------------------------------------------------------------

export { hearInstance };
