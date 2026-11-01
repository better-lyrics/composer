import type { MusicBrainzLookup } from "@/domain/musicbrainz/lookup-mode";
import type { SongQuery } from "@/domain/musicbrainz/query";

// -- Types --------------------------------------------------------------------

type WaitingStatus = "off" | "missing-title" | "idle" | "searching";

interface LookupProgress {
  mode: MusicBrainzLookup;
  requested: boolean;
  live: SongQuery;
  searched: SongQuery;
  showingPreviousResults: boolean;
  knownIsrcs: readonly string[];
}

// -- Status -------------------------------------------------------------------

function isrcPending({ live, searched, showingPreviousResults, knownIsrcs }: LookupProgress): boolean {
  if (!live.isrc || knownIsrcs.includes(live.isrc)) return false;
  return live.isrc !== searched.isrc || showingPreviousResults;
}

function waitingStatus(progress: LookupProgress): WaitingStatus | null {
  const { mode, requested, live, searched } = progress;
  if (mode === "off") return "off";
  if (live.title === "") return "missing-title";
  if (mode === "manual" && !requested) return "idle";
  if (live.title !== searched.title || live.artist !== searched.artist) return "searching";
  return isrcPending(progress) ? "searching" : null;
}

// -- Exports ------------------------------------------------------------------

export { waitingStatus };
export type { LookupProgress };
