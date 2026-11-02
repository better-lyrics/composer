import { useMostWanted } from "@/hooks/unison/useMostWanted";
import type { WantedSong } from "@/lib/unison/api-types";
import { startWantedSong } from "@/lib/unison/start-wanted-song";
import { Button } from "@/ui/button";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { InlineError, LoadMore, SkeletonBar, SkeletonRows, SkeletonSong, ViewEmpty } from "@/views/unison/view-states";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Types ---------------------------------------------------------------------

interface WantedSection {
  id: WantedSong["section"];
  songs: WantedSong[];
}

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonWanted]";
const SKELETON_ROW_COUNT = 6;
const WANTED_GRID = "grid grid-cols-[28px_40px_minmax(0,1fr)_120px_auto] items-center gap-4 h-14 px-3";
const SECTION_TITLES: Record<WantedSong["section"], string> = {
  most_wanted: "Missing lyrics",
  needs_fixing: "Needs fixing",
};

// -- Helpers -------------------------------------------------------------------

function wantedSections(songs: readonly WantedSong[]): WantedSection[] {
  const sections: WantedSection[] = [];
  for (const song of songs) {
    const section = sections.find((candidate) => candidate.id === song.section);
    if (section) section.songs.push(song);
    else sections.push({ id: song.section, songs: [song] });
  }
  return sections;
}

// -- Components ----------------------------------------------------------------

const WantedRow: React.FC<{ song: WantedSong; starting: boolean; onStart: (song: WantedSong) => void }> = ({
  song,
  starting,
  onStart,
}) => (
  <li className={cn(WANTED_GRID, "rounded-[10px] hover:bg-(--layer-1) transition-colors duration-100")}>
    <span className="font-mono text-[13px] text-(--muted) tabular-nums text-right">{song.rank}</span>
    <UnisonSongArt videoId={song.videoId} artworkUrl={song.thumbnailUrl} size="row" />
    <div className="min-w-0">
      <p className="text-sm font-medium truncate" title={song.song}>
        {song.song}
      </p>
      <p className="text-[13px] text-(--muted) truncate">{song.artist}</p>
    </div>
    <span className="text-[13px] text-(--label) tabular-nums">{pluralize(song.requestCount, "request")}</span>
    <Button
      size="sm"
      variant="secondary"
      disabled={starting}
      aria-label={`Start project, ${song.song}`}
      onClick={() => onStart(song)}
    >
      Start project
    </Button>
  </li>
);

const WantedSkeleton: React.FC = () => (
  <SkeletonRows count={SKELETON_ROW_COUNT} rowClassName={WANTED_GRID}>
    <SkeletonBar className="w-4 justify-self-end" />
    <SkeletonSong />
    <SkeletonBar className="w-16" />
    <span className="block h-7 w-24 rounded-lg bg-(--layer-2)" />
  </SkeletonRows>
);

const WantedView: React.FC = () => {
  const wanted = useMostWanted();
  const navigate = useNavigate();
  const [startingId, setStartingId] = useState<string | null>(null);
  const sections = useMemo(() => wantedSections(wanted.data?.pages.flatMap((page) => page.items) ?? []), [wanted.data]);

  const start = (song: WantedSong) => {
    setStartingId(song.videoId);
    startWantedSong(song, { navigate })
      .catch((error: unknown) => console.error(LOG_PREFIX, "could not start a project", error))
      .finally(() => setStartingId(null));
  };

  if (wanted.isPending) return <WantedSkeleton />;
  if (wanted.isError) return <InlineError error={wanted.error} onRetry={() => void wanted.refetch()} />;
  if (sections.length === 0) return <ViewEmpty message="No song requests right now." />;

  return (
    <section aria-label="Most wanted songs" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {sections.length > 1 && (
            <h2 className="px-3 text-xs font-medium text-(--muted)">{SECTION_TITLES[section.id]}</h2>
          )}
          <ol className="flex flex-col">
            {section.songs.map((song) => (
              <WantedRow key={song.videoId} song={song} starting={startingId === song.videoId} onStart={start} />
            ))}
          </ol>
        </div>
      ))}
      {wanted.hasNextPage && (
        <LoadMore
          label="Load more"
          loading={wanted.isFetchingNextPage}
          onLoadMore={() => void wanted.fetchNextPage()}
        />
      )}
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { WantedView };
