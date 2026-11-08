import { IconPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import { useMostWanted } from "@/hooks/unison/useMostWanted";
import { useStartWantedSong } from "@/hooks/unison/useStartWantedSong";
import { useLoadWhenVisible } from "@/hooks/useLoadWhenVisible";
import type { WantedSong } from "@/lib/unison/api-types";
import { ART_PILL_STYLES } from "@/ui/art-pill-styles";
import { Button } from "@/ui/button";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { YouTubeMusicLink } from "@/ui/unison/youtube-music-link";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { InlineError, ViewEmpty } from "@/views/unison/view-states";

// -- Types ---------------------------------------------------------------------

interface WantedSection {
  id: WantedSong["section"];
  songs: WantedSong[];
}

interface WantedTileProps {
  song: WantedSong;
  starting: boolean;
  onStart: (song: WantedSong) => void;
}

// -- Constants -----------------------------------------------------------------

const SKELETON_TILE_COUNT = 12;
const TILE_GRID = "grid grid-cols-6 gap-x-4 gap-y-6 max-[1280px]:grid-cols-4 max-[720px]:grid-cols-2";
const SECTION_COPY: Record<WantedSong["section"], { title: string; hint?: string }> = {
  most_wanted: {
    title: "Songs listeners are waiting for",
    hint: "No lyrics on Unison yet. Start one and it goes live for everyone who asked.",
  },
  needs_fixing: { title: "Lyrics that need fixing" },
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

const WantedTile: React.FC<WantedTileProps> = ({ song, starting, onStart }) => (
  <li className="group/tile flex flex-col gap-2.5 min-w-0">
    <div className="relative">
      <UnisonSongArt videoId={song.videoId} artworkUrl={song.thumbnailUrl} size="card" />
      <span className="absolute top-2 left-2 h-6 px-2 grid place-items-center rounded-[6px] bg-composer-bg/80 backdrop-blur-xl text-xs font-semibold tabular-nums text-composer-text">
        <span className="sr-only">Rank </span>#{song.rank}
      </span>
      <Button
        variant="ghost"
        size="sm"
        hasIcon
        disabled={starting}
        aria-label={`Start project, ${song.song}`}
        onClick={() => onStart(song)}
        className={cn(
          ART_PILL_STYLES,
          "absolute bottom-2 left-2 opacity-0 transition-opacity duration-150 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 pointer-coarse:opacity-100",
        )}
      >
        <IconPlus aria-hidden="true" className="size-4" />
        Start project
      </Button>
    </div>
    <div className="min-w-0">
      <YouTubeMusicLink videoId={song.videoId} label={song.song} className="text-sm font-medium line-clamp-1" />
      <p className="text-[13px] text-(--muted) truncate" title={song.artist}>
        {song.artist}
      </p>
      <p className="mt-1 text-xs text-(--muted) tabular-nums">{pluralize(song.requestCount, "request")}</p>
    </div>
  </li>
);

const WantedSkeleton: React.FC = () => (
  <ul aria-hidden="true" className={cn(TILE_GRID, "animate-pulse motion-reduce:animate-none")}>
    {Array.from({ length: SKELETON_TILE_COUNT }, (_, index) => (
      <li key={index} className="flex flex-col gap-2.5">
        <span className="block w-full aspect-square rounded-[10px] bg-(--layer-2)" />
        <span className="block h-3 w-3/4 rounded bg-(--layer-2)" />
        <span className="block h-2.5 w-1/2 rounded bg-(--layer-2)" />
      </li>
    ))}
  </ul>
);

const SectionHeading: React.FC<{ section: WantedSection["id"] }> = ({ section }) => {
  const copy = SECTION_COPY[section];
  return (
    <div>
      <h2 className="text-[15px] font-semibold">{copy.title}</h2>
      {copy.hint && <p className="mt-1 text-[13px] text-(--muted) text-pretty">{copy.hint}</p>}
    </div>
  );
};

const WantedView: React.FC = () => {
  const wanted = useMostWanted();
  const { startingId, start } = useStartWantedSong();
  const sections = useMemo(() => wantedSections(wanted.data?.pages.flatMap((page) => page.items) ?? []), [wanted.data]);
  const { fetchNextPage } = wanted;
  const sentinelRef = useLoadWhenVisible<HTMLDivElement>(
    wanted.hasNextPage && !wanted.isFetchingNextPage && !wanted.isFetchNextPageError,
    () => void fetchNextPage(),
  );

  if (wanted.isPending) return <WantedSkeleton />;
  if (wanted.isError && sections.length === 0) {
    return <InlineError error={wanted.error} onRetry={() => void wanted.refetch()} />;
  }
  if (sections.length === 0) return <ViewEmpty message="No song requests right now." />;

  return (
    <section aria-label="Most wanted songs" className="flex flex-col gap-10">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-4">
          <SectionHeading section={section.id} />
          <ol className={TILE_GRID}>
            {section.songs.map((song) => (
              <WantedTile key={song.videoId} song={song} starting={startingId === song.videoId} onStart={start} />
            ))}
          </ol>
        </div>
      ))}
      {wanted.isFetchNextPageError && (
        <InlineError error={wanted.error} onRetry={() => void fetchNextPage()} className="justify-center" />
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { WantedView };
