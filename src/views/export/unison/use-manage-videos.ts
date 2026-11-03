import { type ChosenVideo, lengthMismatchNote, uniqueSuggestions } from "@/domain/unison/video-links";
import { unisonQueryKeys } from "@/hooks/unison/query-keys";
import { useLyricVideoSuggestions, useVideoLinks } from "@/hooks/unison/useVideoSuggestions";
import type { SuggestedVideo, UnisonLyric, VideoLink } from "@/lib/unison/api-types";
import { UnisonError } from "@/lib/unison/client";
import { linkVideo, unlinkVideo } from "@/lib/unison/endpoints";
import { unisonFailureReason } from "@/utils/unison-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

// -- Types ---------------------------------------------------------------------

interface ManageVideos {
  primaryVideoId: string;
  linked: ChosenVideo[];
  more: SuggestedVideo[];
  busy: boolean;
  link: (suggestion: SuggestedVideo) => Promise<string | null>;
  unlink: (videoId: string) => Promise<string | null>;
  add: (videoId: string) => Promise<string | null>;
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonVideos]";
const DURATION_MISMATCH_CODE = "DURATION_MISMATCH";

// -- Helpers -------------------------------------------------------------------

function linkFailure(error: unknown, candidateSeconds: number | null, songSeconds: number): string {
  const mismatch = error instanceof UnisonError && error.code === DURATION_MISMATCH_CODE;
  if (mismatch && candidateSeconds !== null) return lengthMismatchNote(candidateSeconds, songSeconds);
  return unisonFailureReason(error);
}

// -- Hook ----------------------------------------------------------------------

function useManageVideos(lyric: UnisonLyric, songSeconds: number): ManageVideos {
  const queryClient = useQueryClient();
  const links = useVideoLinks(lyric.id).data;
  const suggestionData = useLyricVideoSuggestions(lyric.id).data;
  const suggestions = suggestionData?.suggestions ?? [];
  const known = [...suggestions, ...(suggestionData?.linked ?? [])];
  const [busy, setBusy] = useState(false);

  const primaryVideoId = links?.find((video) => video.isPrimary)?.videoId ?? lyric.videoId;
  const linkedIds = new Set(links?.map((video) => video.videoId));
  const linked = (links ?? [])
    .filter((video) => !video.isPrimary)
    .map((video): ChosenVideo => {
      const suggestion = known.find((candidate) => candidate.videoId === video.videoId) ?? null;
      return { videoId: video.videoId, suggestion, origin: "linked" };
    });
  const more = uniqueSuggestions(suggestions, primaryVideoId).filter((candidate) => !linkedIds.has(candidate.videoId));

  const write = async (describe: string, request: () => Promise<VideoLink[]>, candidateSeconds: number | null) => {
    setBusy(true);
    try {
      queryClient.setQueryData(unisonQueryKeys.videoLinks(lyric.id), await request());
      return null;
    } catch (error) {
      console.warn(LOG_PREFIX, `Could not ${describe} on lyric ${lyric.id}`, error);
      return linkFailure(error, candidateSeconds, songSeconds);
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: unisonQueryKeys.videoLinks(lyric.id) });
      void queryClient.invalidateQueries({ queryKey: unisonQueryKeys.lyricVideoSuggestions(lyric.id) });
    }
  };

  const add = (videoId: string) => {
    const candidateSeconds = known.find((candidate) => candidate.videoId === videoId)?.durationSeconds ?? null;
    return write(`link video ${videoId}`, () => linkVideo(lyric.id, videoId), candidateSeconds);
  };

  return {
    primaryVideoId,
    linked,
    more,
    busy,
    link: (suggestion) => add(suggestion.videoId),
    unlink: (videoId) => write(`unlink video ${videoId}`, () => unlinkVideo(lyric.id, videoId), null),
    add,
  };
}

// -- Exports -------------------------------------------------------------------

export { useManageVideos };
