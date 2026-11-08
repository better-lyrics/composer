import { useMostWanted } from "@/hooks/unison/useMostWanted";
import { useStartWantedSong } from "@/hooks/unison/useStartWantedSong";
import type { WantedSong } from "@/lib/unison/api-types";
import { Button } from "@/ui/button";
import { LinkButton } from "@/ui/link-button";
import { UnisonSongArt } from "@/ui/unison/unison-song-art";
import { useSettingsStore } from "@/stores/settings";
import { unisonViewPath } from "@/utils/app-routes";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { showWantedShelfHiddenToast } from "@/utils/unison-toast";
import { IconArrowRight, IconFlame } from "@tabler/icons-react";
import { useId, useMemo } from "react";

// -- Constants -----------------------------------------------------------------

const SHELF_SIZE = 4;
const SHELF_GRID = "grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1";
const TILE = "flex items-center gap-3 h-18 p-2.5 pr-3 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)]";

// -- Helpers -------------------------------------------------------------------

function hideShelf(): void {
  const settings = useSettingsStore.getState();
  settings.set("unisonWantedShelf", false);
  showWantedShelfHiddenToast(() => settings.set("unisonWantedShelf", true));
}

// -- Components ----------------------------------------------------------------

const WantedTile: React.FC<{ song: WantedSong; starting: boolean; onStart: (song: WantedSong) => void }> = ({
  song,
  starting,
  onStart,
}) => (
  <li className={TILE}>
    <UnisonSongArt videoId={song.videoId} artworkUrl={song.thumbnailUrl} size="row" />
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-medium truncate" title={song.song}>
        {song.song}
      </p>
      <p className="text-xs text-(--muted) truncate" title={song.artist}>
        {song.artist}
      </p>
      <p className="text-xs text-(--muted) tabular-nums">{pluralize(song.requestCount, "request")}</p>
    </div>
    <Button
      size="sm"
      variant="secondary"
      disabled={starting}
      aria-label={`Start project, ${song.song}`}
      onClick={() => onStart(song)}
      className="shrink-0"
    >
      Start
    </Button>
  </li>
);

const ShelfSkeleton: React.FC = () => (
  <ul aria-hidden="true" className={SHELF_GRID}>
    {Array.from({ length: SHELF_SIZE }, (_, index) => (
      <li key={index} className={TILE}>
        <span className="size-10 shrink-0 rounded-md bg-(--layer-2)" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="h-2.5 w-3/4 rounded-full bg-(--layer-2)" />
          <span className="h-2.5 w-1/2 rounded-full bg-(--layer-2)" />
        </span>
      </li>
    ))}
  </ul>
);

const MostWantedShelf: React.FC<{ className?: string }> = ({ className }) => {
  const headingId = useId();
  const wanted = useMostWanted();
  const { startingId, start } = useStartWantedSong();
  const songs = useMemo(
    () => (wanted.data?.pages[0]?.items ?? []).filter((song) => song.section === "most_wanted").slice(0, SHELF_SIZE),
    [wanted.data],
  );

  if (wanted.isError || (wanted.isSuccess && songs.length === 0)) return null;

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3 select-none", className)}>
      <div className="flex items-center justify-between">
        <h2 id={headingId} className="flex items-center gap-2 text-[15px] font-bold">
          <IconFlame aria-hidden="true" className="size-[18px] text-composer-warning" />
          Most wanted on Unison
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={hideShelf}>
            Hide
          </Button>
          <LinkButton
            to={unisonViewPath("wanted")}
            variant="ghost"
            size="sm"
            hasIcon
            className="flex-row-reverse pl-3 pr-2.5"
          >
            <IconArrowRight aria-hidden="true" className="size-4" />
            See all
          </LinkButton>
        </div>
      </div>
      {wanted.isPending ? (
        <ShelfSkeleton />
      ) : (
        <ul className={SHELF_GRID}>
          {songs.map((song) => (
            <WantedTile key={song.videoId} song={song} starting={startingId === song.videoId} onStart={start} />
          ))}
        </ul>
      )}
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { MostWantedShelf };
