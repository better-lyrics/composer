import type { SuggestedVideo, VideoLink } from "@/lib/unison/api-types";
import { formatTime } from "@/utils/format-time";

// -- Types ---------------------------------------------------------------------

type ChosenVideoOrigin = "suggested" | "chosen" | "pasted" | "linked";

interface ChosenVideo {
  videoId: string;
  suggestion: SuggestedVideo | null;
  origin: ChosenVideoOrigin;
}

interface VideoFacts {
  artist: string;
  kind: string | null;
  duration: string | null;
}

interface SubmitVideoChoicesInput {
  suggestions: readonly SuggestedVideo[];
  mainVideoId: string;
  songSeconds: number;
  dismissed: ReadonlySet<string>;
  chosen: readonly ChosenVideo[];
}

interface VideoChoices {
  linked: ChosenVideo[];
  more: SuggestedVideo[];
}

// -- Constants -----------------------------------------------------------------

// Unison's `config.videoLinking`: the cap counts the main video.
const VIDEO_LINK_LIMIT = 20;
const VIDEO_LENGTH_TOLERANCE_SECONDS = 2;
const KIND_LABELS: Record<SuggestedVideo["videoType"], string> = { song: "Song", video: "Video" };

// -- Functions -----------------------------------------------------------------

function fitsSongLength(videoSeconds: number, songSeconds: number): boolean {
  return Math.abs(videoSeconds - songSeconds) <= VIDEO_LENGTH_TOLERANCE_SECONDS;
}

function lengthMismatchNote(videoSeconds: number, songSeconds: number): string {
  const direction = videoSeconds < songSeconds ? "shorter" : "longer";
  const gap = formatTime(Math.abs(videoSeconds - songSeconds), 0);
  return `${formatTime(videoSeconds, 0)} long, ${gap} ${direction} than the song. Must be within ${VIDEO_LENGTH_TOLERANCE_SECONDS} s.`;
}

function suggestionLengthNote(suggestion: SuggestedVideo | undefined, songSeconds: number): string | null {
  const seconds = suggestion?.durationSeconds;
  if (seconds === null || seconds === undefined || fitsSongLength(seconds, songSeconds)) return null;
  return lengthMismatchNote(seconds, songSeconds);
}

function uniqueSuggestions(suggestions: readonly SuggestedVideo[], mainVideoId: string): SuggestedVideo[] {
  const seen = new Set([mainVideoId]);
  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.videoId)) return false;
    seen.add(suggestion.videoId);
    return true;
  });
}

function startsLinked(suggestion: SuggestedVideo, songSeconds: number): boolean {
  if (suggestion.match?.level !== "same") return false;
  return suggestion.durationSeconds === null || fitsSongLength(suggestion.durationSeconds, songSeconds);
}

function submitVideoChoices({
  suggestions,
  mainVideoId,
  songSeconds,
  dismissed,
  chosen,
}: SubmitVideoChoicesInput): VideoChoices {
  const chosenIds = new Set(chosen.map((video) => video.videoId));
  const open = uniqueSuggestions(suggestions, mainVideoId).filter((suggestion) => !chosenIds.has(suggestion.videoId));
  const room = Math.max(0, VIDEO_LINK_LIMIT - 1 - chosen.length);
  const suggested = open
    .filter((suggestion) => !dismissed.has(suggestion.videoId) && startsLinked(suggestion, songSeconds))
    .slice(0, room)
    .map((suggestion): ChosenVideo => ({ videoId: suggestion.videoId, suggestion, origin: "suggested" }));
  const suggestedIds = new Set(suggested.map((video) => video.videoId));
  return {
    linked: [...suggested, ...chosen],
    more: open.filter((suggestion) => !suggestedIds.has(suggestion.videoId)),
  };
}

// The main video counts toward the link limit.
function linkedVideoCount(linked: readonly ChosenVideo[]): number {
  return linked.length + 1;
}

function suggestionFacts(suggestion: SuggestedVideo): VideoFacts {
  return {
    artist: suggestion.artist,
    kind: KIND_LABELS[suggestion.videoType],
    duration: suggestion.durationSeconds === null ? null : formatTime(suggestion.durationSeconds, 0),
  };
}

// Unloaded links never block: the check waits for data instead of guessing.
function playsUnlinkedVideo(
  sourceVideoId: string | undefined,
  lyricVideoId: string,
  links: readonly VideoLink[] | undefined,
): boolean {
  if (!sourceVideoId || !links || sourceVideoId === lyricVideoId) return false;
  return !links.some((link) => link.videoId === sourceVideoId);
}

// -- Exports -------------------------------------------------------------------

export type { ChosenVideo, ChosenVideoOrigin, VideoChoices, VideoFacts };
export {
  fitsSongLength,
  lengthMismatchNote,
  linkedVideoCount,
  playsUnlinkedVideo,
  submitVideoChoices,
  suggestionFacts,
  suggestionLengthNote,
  uniqueSuggestions,
  VIDEO_LENGTH_TOLERANCE_SECONDS,
  VIDEO_LINK_LIMIT,
};
