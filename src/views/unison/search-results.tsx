import type { UnisonSearchResult } from "@/lib/unison/api-types";
import { ConfidenceMeter } from "@/ui/unison/confidence-meter";
import { ScoreLabel } from "@/ui/unison/score-label";
import { unisonSyncLabel } from "@/ui/unison/sync-type-label";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";

// -- Types ---------------------------------------------------------------------

interface SongVersions {
  videoId: string;
  song: string;
  artist: string;
  versions: UnisonSearchResult[];
}

interface SearchResultsProps {
  results: readonly UnisonSearchResult[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
}

// -- Helpers -------------------------------------------------------------------

function versionsBySong(results: readonly UnisonSearchResult[]): SongVersions[] {
  const songs = new Map<string, SongVersions>();
  for (const result of results) {
    const song = songs.get(result.videoId);
    if (song) song.versions.push(result);
    else songs.set(result.videoId, { ...result, versions: [result] });
  }
  return [...songs.values()];
}

// -- Components ----------------------------------------------------------------

const VersionRow: React.FC<{ version: UnisonSearchResult; selected: boolean; onSelect: (id: number) => void }> = ({
  version,
  selected,
  onSelect,
}) => (
  <li>
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(version.id)}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_132px_100px_120px] items-center gap-4 h-12 px-3 rounded-[10px] text-left cursor-pointer transition-colors duration-100",
        selected ? "bg-composer-accent/12" : "hover:bg-(--layer-1)",
      )}
    >
      <span className="flex items-center gap-2 min-w-0 text-[13px]">
        <span className="font-medium truncate">{version.submitter?.displayName ?? "Unknown"}</span>
        {version.submitter && <span className="text-(--muted) shrink-0">Level {version.submitter.level}</span>}
      </span>
      <span className="text-[13px] text-(--label)">{unisonSyncLabel(version.syncType)}</span>
      <ConfidenceMeter confidence={version.confidence} />
      <ScoreLabel score={version.score} voteCount={version.voteCount} className="justify-self-end" />
    </button>
  </li>
);

const SearchResults: React.FC<SearchResultsProps> = ({ results, selectedId, onSelect }) => (
  <div className="flex flex-col gap-6">
    {versionsBySong(results).map((song) => (
      <section key={song.videoId} aria-label={song.song} className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-3">
          <UnisonSongArt videoId={song.videoId} size="dialog" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold truncate">{song.song}</h2>
            <p className="text-[13px] text-(--muted) truncate">
              {song.artist} ・ {pluralize(song.versions.length, "version")} on Unison
            </p>
          </div>
        </div>
        <ul aria-label={`Versions of ${song.song}`} className="flex flex-col gap-1">
          {song.versions.map((version) => (
            <VersionRow key={version.id} version={version} selected={version.id === selectedId} onSelect={onSelect} />
          ))}
        </ul>
      </section>
    ))}
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SearchResults };
