import { displayArtists, namedArtists } from "@/domain/project/display-title";
import { submitDurationSeconds } from "@/domain/unison/submit-checks";
import {
  type ChosenVideo,
  type ChosenVideoOrigin,
  submitVideoChoices,
  suggestionLengthNote,
  type VideoChoices,
} from "@/domain/unison/video-links";
import { useSongVideoSuggestions } from "@/hooks/unison/useVideoSuggestions";
import type { SongForSuggestions, SuggestedVideo } from "@/lib/unison/api-types";
import { useProjectStore } from "@/stores/project";
import type { MainVideo } from "@/ui/unison/video-picker";
import { formatTime } from "@/utils/format-time";
import { useMemo, useReducer, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface SubmitVideos extends VideoChoices {
  main: MainVideo;
  songSeconds: number;
  songTitle: string;
  videoIds: string[];
  link: (suggestion: SuggestedVideo) => string | null;
  unlink: (videoId: string) => null;
  add: (videoId: string) => string | null;
}

// -- State ---------------------------------------------------------------------

// Unlinked suggestions stay unlinked for the session, keyed by the song's main video.
const dismissedSuggestions = new Set<string>();

function dismissalKey(mainVideoId: string, videoId: string): string {
  return `${mainVideoId}:${videoId}`;
}

// -- Hook ----------------------------------------------------------------------

function useSubmitVideos(mainVideoId: string, durationSeconds: number): SubmitVideos {
  const metadata = useProjectStore((state) => state.metadata);
  const songSeconds = submitDurationSeconds(durationSeconds || metadata.duration);
  const song = useMemo((): SongForSuggestions | null => {
    const title = metadata.title.trim();
    const artist = namedArtists(metadata.artists).join(", ");
    if (!title || !artist || !(songSeconds > 0)) return null;
    return { song: title, artist, album: metadata.album?.trim() || null, duration: songSeconds, videoId: mainVideoId };
  }, [metadata.title, metadata.artists, metadata.album, songSeconds, mainVideoId]);
  const suggestions = useSongVideoSuggestions(song).data ?? [];
  const [chosen, setChosen] = useState<ChosenVideo[]>([]);
  const [, rememberDismissal] = useReducer((count: number) => count + 1, 0);

  const dismissed = new Set(
    suggestions
      .map((suggestion) => suggestion.videoId)
      .filter((videoId) => dismissedSuggestions.has(dismissalKey(mainVideoId, videoId))),
  );
  const choices = submitVideoChoices({ suggestions, mainVideoId, songSeconds, dismissed, chosen });

  const choose = (videoId: string, suggestion: SuggestedVideo | undefined, origin: ChosenVideoOrigin) => {
    const problem = suggestionLengthNote(suggestion, songSeconds);
    if (problem) return problem;
    setChosen((current) => [...current, { videoId, suggestion: suggestion ?? null, origin }]);
    return null;
  };

  return {
    ...choices,
    main: {
      videoId: mainVideoId,
      title: metadata.title.trim() || undefined,
      artworkUrl: metadata.thumbnailDataUrl,
      facts: { artist: displayArtists(metadata.artists), kind: null, duration: formatTime(songSeconds, 0) },
    },
    songSeconds,
    songTitle: metadata.title,
    videoIds: choices.linked.map((video) => video.videoId),
    link: (suggestion) => choose(suggestion.videoId, suggestion, "chosen"),
    unlink: (videoId) => {
      if (choices.linked.some((video) => video.videoId === videoId && video.origin === "suggested")) {
        dismissedSuggestions.add(dismissalKey(mainVideoId, videoId));
        rememberDismissal();
      }
      setChosen((current) => current.filter((video) => video.videoId !== videoId));
      return null;
    },
    add: (videoId) => {
      const suggestion = suggestions.find((candidate) => candidate.videoId === videoId);
      return choose(videoId, suggestion, suggestion ? "chosen" : "pasted");
    },
  };
}

// -- Exports -------------------------------------------------------------------

export { useSubmitVideos };
