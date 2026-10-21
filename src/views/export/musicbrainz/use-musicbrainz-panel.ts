import { type SongDetails, songDetailsFrom } from "@/domain/musicbrainz/song-details";
import {
  type MetadataSuggestions,
  fillPatch,
  metadataSuggestions,
  suggestionCount,
} from "@/domain/musicbrainz/suggestion";
import { type MusicBrainzMatch, useMusicBrainzMatch } from "@/hooks/useMusicBrainzMatch";
import type { ProjectMetadata } from "@/domain/project/metadata";
import { useProjectStore } from "@/stores/project";
import { showMusicBrainzFillToast } from "@/utils/musicbrainz-toast";
import { useMemo, useState } from "react";

// -- Types --------------------------------------------------------------------

type FoundMatch = Extract<MusicBrainzMatch, { status: "found" }>;

interface ShownMatch {
  match: FoundMatch;
  details: SongDetails;
}

interface MusicBrainzPanel {
  match: MusicBrainzMatch;
  shown: ShownMatch | null;
  suggestions: MetadataSuggestions;
  detailCount: number;
  fillCount: number;
  request: () => void;
  choose: (recordingId: string) => void;
  reveal: () => void;
  fillAll: () => void;
  dismiss: () => void;
}

// -- Constants ----------------------------------------------------------------

const NO_SUGGESTIONS: MetadataSuggestions = {};

// -- Helpers ------------------------------------------------------------------

function previousValues(patch: Partial<ProjectMetadata>, metadata: ProjectMetadata): Partial<ProjectMetadata> {
  const previous: Partial<ProjectMetadata> = {};
  if ("album" in patch) previous.album = metadata.album;
  if ("isrc" in patch) previous.isrc = metadata.isrc;
  if ("artists" in patch) previous.artists = metadata.artists;
  if ("songwriters" in patch) previous.songwriters = metadata.songwriters ?? [];
  return previous;
}

// -- Hook ---------------------------------------------------------------------

function useMusicBrainzPanel(): MusicBrainzPanel {
  const [chosenRecordingId, setChosenRecordingId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const match = useMusicBrainzMatch(chosenRecordingId, requested);
  const metadata = useProjectStore((state) => state.metadata);
  const dismissedMatches = useProjectStore((state) => state.dismissedMetadataMatches);
  const setMetadata = useProjectStore((state) => state.setMetadata);
  const dismissMetadataMatch = useProjectStore((state) => state.dismissMetadataMatch);

  const found = match.status === "found" ? match : null;
  const lookedUp = found?.details ?? null;
  const dismissed = found !== null && dismissedMatches.includes(found.chosen.recording.id);
  const suggestions = useMemo(
    () => (lookedUp && (!dismissed || revealed) ? metadataSuggestions(lookedUp, metadata) : NO_SUGGESTIONS),
    [lookedUp, dismissed, revealed, metadata],
  );
  const fill = fillPatch(suggestions);
  const shown =
    found && (!dismissed || revealed)
      ? { match: found, details: lookedUp ?? songDetailsFrom(found.chosen.recording) }
      : null;

  const fillAll = () => {
    if (Object.keys(fill).length === 0) return;
    const previous = previousValues(fill, useProjectStore.getState().metadata);
    setMetadata(fill);
    showMusicBrainzFillToast(previous);
  };

  const dismiss = () => {
    if (!found) return;
    dismissMetadataMatch(found.chosen.recording.id);
    setRevealed(false);
  };

  return {
    match,
    shown,
    suggestions,
    detailCount: suggestionCount(suggestions),
    fillCount: Object.keys(fill).length,
    request: () => setRequested(true),
    choose: setChosenRecordingId,
    reveal: () => setRevealed(true),
    fillAll,
    dismiss,
  };
}

// -- Exports ------------------------------------------------------------------

export { useMusicBrainzPanel };
export type { MusicBrainzPanel };
