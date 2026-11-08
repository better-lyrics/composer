import { IconFileImport } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { lyricsWithoutProject, projectsByLyricId } from "@/domain/unison/linked-projects";
import { type MineSort, nextMineSort, sortedMine } from "@/domain/unison/mine-sort";
import { useMyUnisonLyrics } from "@/hooks/unison/useMyUnisonLyrics";
import { fetchUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import { useUnisonSession } from "@/hooks/useUnisonSession";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { isUnisonSessionEnded } from "@/lib/unison/client";
import { openUnisonLyric } from "@/lib/unison/open-unison-lyric";
import { Button } from "@/ui/button";
import { BetterLyricsMark } from "@/ui/unison/better-lyrics-mark";
import { ConnectPopover } from "@/ui/unison/connect-popover";
import { unisonViewPath } from "@/utils/app-routes";
import { cn } from "@/utils/cn";
import { useLibraryActions } from "@/views/library/use-library-actions";
import { DeclinedEdits } from "@/views/unison/declined-edits";
import { MINE_GRID, MineColumns, MineRow } from "@/views/unison/mine-row";
import { ProfileHeader } from "@/views/unison/profile-header";
import { useOpenAllAsProjects } from "@/views/unison/use-open-all-as-projects";
import { InlineError, SkeletonBar, SkeletonRows, SkeletonSong, ViewEmpty } from "@/views/unison/view-states";

// -- Types ---------------------------------------------------------------------

type MineQuery = ReturnType<typeof useMyUnisonLyrics>;

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonMine]";
const SKELETON_ROW_COUNT = 4;
const NO_SONGS: readonly UnisonMineItem[] = [];

// -- Components ----------------------------------------------------------------

const MineSignedOut: React.FC = () => (
  <div className="flex flex-col items-start gap-3 p-6 max-w-[520px] rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)]">
    <h2 className="text-[15px] font-semibold">Connect to see your lyrics</h2>
    <ConnectPopover
      placement="bottom-start"
      reason="Open your Unison lyrics as projects."
      trigger={
        <Button variant="secondary" size="lg" hasIcon>
          <BetterLyricsMark />
          Connect Better Lyrics
        </Button>
      }
    />
  </div>
);

const MineSkeleton: React.FC = () => (
  <SkeletonRows count={SKELETON_ROW_COUNT} rowClassName={cn(MINE_GRID, "h-14")}>
    <SkeletonSong />
    <SkeletonBar className="w-24" />
    <SkeletonBar className="w-16" />
    <SkeletonBar className="w-20 justify-self-end" />
  </SkeletonRows>
);

const MineHeading: React.FC<{ count: number | null; action: React.ReactNode }> = ({ count, action }) => (
  <div className="flex items-center justify-between gap-4 min-h-10 pb-3">
    <h2 className="text-[15px] font-semibold">
      Your lyrics
      {count !== null && <span className="ml-2 font-medium text-(--muted) tabular-nums">{count}</span>}
    </h2>
    {action}
  </div>
);

const MineList: React.FC<{ mine: MineQuery }> = ({ mine }) => {
  const { entries } = useProjectIndex();
  const libraryActions = useLibraryActions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openAll = useOpenAllAsProjects();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const opening = useRef(false);

  const projectByLyric = useMemo(() => projectsByLyricId(entries ?? []), [entries]);
  const items = useMemo(() => mine.data?.items ?? [], [mine.data]);
  const withoutProject = useMemo(() => lyricsWithoutProject(items, entries ?? []), [items, entries]);
  const [sort, setSort] = useState<MineSort | null>(null);
  const shownItems = useMemo(() => sortedMine(items, sort), [items, sort]);

  const openAsProject = useCallback(
    (item: UnisonMineItem) => {
      if (opening.current || !entries) return;
      opening.current = true;
      setOpeningId(item.id);
      fetchUnisonLyric(queryClient, item.id)
        .then((lyric) => openUnisonLyric(lyric, { link: true, navigate }))
        .catch((error: unknown) => {
          console.error(LOG_PREFIX, "could not open the lyrics as a project", error);
          toast.error(error instanceof Error ? error.message : "Couldn't open those lyrics");
        })
        .finally(() => {
          opening.current = false;
          setOpeningId(null);
        });
    },
    [queryClient, navigate, entries],
  );

  if (mine.isError) return <InlineError error={mine.error} onRetry={() => void mine.refetch()} />;
  if (!mine.isPending && items.length === 0) {
    return (
      <ViewEmpty message="You haven't shared any lyrics on Unison yet.">
        <Button size="sm" variant="secondary" onClick={() => navigate(unisonViewPath("wanted"))}>
          See most wanted songs
        </Button>
      </ViewEmpty>
    );
  }

  const openAllButton = entries && withoutProject.length > 0 && (
    <Button
      variant="secondary"
      size="lg"
      hasIcon
      disabled={openAll.busy}
      onClick={() => void openAll.openAll(withoutProject)}
    >
      <IconFileImport aria-hidden="true" className="size-4" />
      Open {withoutProject.length} as projects
    </Button>
  );

  return (
    <>
      <DeclinedEdits items={items} projectByLyric={projectByLyric} onOpenProject={libraryActions.open} />
      <div>
        <MineHeading count={mine.isPending ? null : items.length} action={openAllButton} />
        <MineColumns sort={sort} onSort={(key) => setSort((current) => nextMineSort(current, key))} />
        {mine.isPending ? (
          <MineSkeleton />
        ) : (
          <ul className="pt-1">
            {shownItems.map((item) => (
              <MineRow
                key={item.id}
                item={item}
                projectId={projectByLyric.get(String(item.id))?.id}
                now={mine.dataUpdatedAt}
                opening={openingId === item.id}
                waiting={!entries}
                onOpenProject={libraryActions.open}
                onOpenAsProject={openAsProject}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

const MineView: React.FC = () => {
  const session = useUnisonSession();
  const mine = useMyUnisonLyrics(session?.keyId ?? null);
  if (!session || isUnisonSessionEnded(mine.error)) return <MineSignedOut />;
  return (
    <section aria-label="My lyrics on Unison" className="flex flex-col gap-6">
      <ProfileHeader session={session} songs={mine.data?.items ?? NO_SONGS} />
      <MineList mine={mine} />
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { MineView };
