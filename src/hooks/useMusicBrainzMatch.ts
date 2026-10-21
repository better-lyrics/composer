import type { SongQuery } from "@/domain/musicbrainz/query";
import { recordingLookupUrl, songSearchUrl } from "@/domain/musicbrainz/query";
import { type RankedMatch, rankMatches } from "@/domain/musicbrainz/rank-matches";
import { type SongDetails, songDetailsFrom } from "@/domain/musicbrainz/song-details";
import type { MbRecording, MbSearchResponse } from "@/domain/musicbrainz/types";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { fetchMusicBrainz } from "@/lib/musicbrainz-client";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { normalizeIsrc } from "@/utils/isrc";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// -- Constants ----------------------------------------------------------------

const IDENTITY_DEBOUNCE_MS = 1500;

// -- Types --------------------------------------------------------------------

type MusicBrainzMatch =
  | { status: "off" | "missing-title" | "idle" | "searching" | "none" }
  | { status: "error"; retry: () => void }
  | {
      status: "found";
      matches: RankedMatch[];
      chosen: RankedMatch;
      details: SongDetails | null;
      detailsFailed: boolean;
      retry: () => void;
    };

// -- Hook ---------------------------------------------------------------------

function useMusicBrainzMatch(chosenRecordingId: string | null, requested: boolean): MusicBrainzMatch {
  const mode = useSettingsStore((state) => state.musicBrainzLookup);
  const title = useProjectStore((state) => state.metadata.title.trim());
  const artist = useProjectStore((state) => state.metadata.artists[0]?.trim() ?? "");
  const isrc = useProjectStore((state) => normalizeIsrc(state.metadata.isrc ?? "") ?? null);
  const durationSec = useAudioStore((state) => (state.duration > 0 ? Math.round(state.duration) : null));

  const identityKey = useDebouncedValue(JSON.stringify({ title, artist, isrc }), IDENTITY_DEBOUNCE_MS);
  const query = useMemo((): SongQuery => JSON.parse(identityKey), [identityKey]);
  const enabled = mode !== "off" && query.title !== "" && (mode === "auto" || requested);

  const search = useQuery<MbSearchResponse>({
    queryKey: ["musicbrainz-search", query.title, query.artist, query.isrc],
    enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === query.title && previousQuery.queryKey[2] === query.artist
        ? previousData
        : undefined,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => fetchMusicBrainz<MbSearchResponse>(songSearchUrl(query), signal),
  });
  const matches = useMemo(
    () => (search.data ? rankMatches(search.data.recordings, durationSec) : []),
    [search.data, durationSec],
  );
  const chosen = matches.find((match) => match.recording.id === chosenRecordingId) ?? matches[0];
  const chosenId = chosen?.recording.id ?? null;

  const lookup = useQuery({
    queryKey: ["musicbrainz-recording", chosenId],
    enabled: enabled && chosenId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => fetchMusicBrainz<MbRecording>(recordingLookupUrl(chosenId ?? ""), signal),
  });
  const details = useMemo(() => (lookup.data ? songDetailsFrom(lookup.data) : null), [lookup.data]);

  if (mode === "off") return { status: "off" };
  if (title === "") return { status: "missing-title" };
  if (mode === "manual" && !requested) return { status: "idle" };
  if (title !== query.title || artist !== query.artist) return { status: "searching" };
  if (search.isError) return { status: "error", retry: () => void search.refetch() };
  if (search.isPending) return { status: "searching" };
  if (!chosen) return { status: "none" };
  return {
    status: "found",
    matches,
    chosen,
    details,
    detailsFailed: lookup.isError,
    retry: () => void lookup.refetch(),
  };
}

// -- Exports ------------------------------------------------------------------

export { useMusicBrainzMatch };
export type { MusicBrainzMatch };
