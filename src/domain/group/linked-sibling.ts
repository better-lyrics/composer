import { propagateWordChanges } from "@/domain/group/smart-sync";
import { withOwnPieces } from "@/domain/language/pieces";
import { withSeededBackground } from "@/domain/line/background";
import type { LineTrack, LyricLine } from "@/domain/line/model";
import { trackText } from "@/domain/line/text";
import { backgroundTrack, isSpanTimed, mainTrack, timedSyllables } from "@/domain/line/track";
import {
  newBackgroundTrack,
  withAgent,
  withBackgroundTrack,
  withMainTrack,
  withoutTrackTiming,
  withTrackText,
  withTrackWords,
} from "@/domain/line/track-writes";

// -- Helpers ------------------------------------------------------------------

function hasTiming(track: LineTrack | undefined): boolean {
  return !!track && (isSpanTimed(track) || timedSyllables(track).length > 0);
}

function wordsOrNothing(track: LineTrack | undefined) {
  const words = timedSyllables(track);
  return words.length > 0 ? words : undefined;
}

// A copy follows the source's content: word structure and text, and a cleared timing. Its own timing stays.
function linkedTrack<T extends LineTrack>(copy: T, before: LineTrack | undefined, after: LineTrack): T {
  if (before === after) return copy;
  let next = copy;
  const propagated = propagateWordChanges(wordsOrNothing(after), wordsOrNothing(before), wordsOrNothing(copy));
  if (propagated) next = withTrackWords(next, propagated);
  const text = trackText(after);
  if ((!before || trackText(before) !== text) && trackText(next) !== text) next = withTrackText(next, text);
  if (hasTiming(before) && !hasTiming(after)) next = withoutTrackTiming(next);
  return next;
}

function linkedBackground(sibling: LyricLine, sourceBefore: LyricLine, sourceAfter: LyricLine): LyricLine {
  const before = backgroundTrack(sourceBefore);
  const after = backgroundTrack(sourceAfter);
  if (before === after) return sibling;
  if (!after) return withBackgroundTrack(sibling, undefined);
  const own = backgroundTrack(sibling) ?? newBackgroundTrack(sibling.id, after.source);
  const sourced = own.source === after.source ? own : { ...own, source: after.source };
  return withBackgroundTrack(sibling, linkedTrack(sourced, before, after));
}

// -- Sibling update -----------------------------------------------------------

function updatedLinkedSibling(sibling: LyricLine, sourceBefore: LyricLine, updates: Partial<LyricLine>): LyricLine {
  const sourceAfter = { ...sourceBefore, ...updates };
  const afterMain = mainTrack(sourceAfter);
  let next = withMainTrack(sibling, linkedTrack(mainTrack(sibling), mainTrack(sourceBefore), afterMain));
  if (mainTrack(sourceBefore).agentId !== afterMain.agentId) next = withAgent(next, afterMain.agentId);
  next = linkedBackground(next, sourceBefore, sourceAfter);
  if ("languages" in updates) next = { ...next, languages: withOwnPieces(updates.languages, sibling) };
  return next === sibling ? sibling : withSeededBackground(next);
}

// -- Exports ------------------------------------------------------------------

export { updatedLinkedSibling };
