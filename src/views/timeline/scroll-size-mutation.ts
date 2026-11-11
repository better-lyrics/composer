import { isPlaybackStyleWrite } from "@/views/timeline/playback-style-mutation";

// -- Constants -----------------------------------------------------------------

const SIZED_ROWS_ATTRIBUTE = "data-sized-rows";
const SIZED_ROWS_PROPS = { [SIZED_ROWS_ATTRIBUTE]: "" } as const;

// -- Functions -----------------------------------------------------------------

// The rows box carries the full rows size in its own style, so rows mounting and unmounting inside it as the view scrolls never change the scroll size.
function isInsideSizedRows(mutation: MutationRecord): boolean {
  const { target } = mutation;
  const element = target instanceof Element ? target : target.parentElement;
  const box = element?.closest(`[${SIZED_ROWS_ATTRIBUTE}]`);
  return box !== null && box !== undefined && box !== element;
}

function keepsTimelineScrollSize(mutation: MutationRecord): boolean {
  return isPlaybackStyleWrite(mutation) || isInsideSizedRows(mutation);
}

// -- Exports -------------------------------------------------------------------

export { SIZED_ROWS_PROPS, keepsTimelineScrollSize };
