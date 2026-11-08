import { projectsByLyricId } from "@/domain/unison/linked-projects";
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
import { MINE_GRID, MineColumns, MineRow } from "@/views/unison/mine-row";
import { InlineError, LoadMore, SkeletonBar, SkeletonRows, SkeletonSong, ViewEmpty } from "@/views/unison/view-states";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonMine]";
const SKELETON_ROW_COUNT = 4;

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
    <SkeletonBar className="w-16" />
    <SkeletonBar className="w-20" />
    <SkeletonBar className="w-10" />
    <span className="block h-7 w-28 justify-self-end rounded-lg bg-(--layer-2)" />
  </SkeletonRows>
);

const MineList: React.FC<{ mine: ReturnType<typeof useMyUnisonLyrics> }> = ({ mine }) => {
  const { entries } = useProjectIndex();
  const libraryActions = useLibraryActions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const opening = useRef(false);

  const projectByLyric = useMemo(() => projectsByLyricId(entries ?? []), [entries]);
  const items = useMemo(() => mine.data?.pages.flatMap((page) => page.items) ?? [], [mine.data]);
  const [sort, setSort] = useState<MineSort | null>(null);
  const shownItems = useMemo(() => sortedMine(items, sort), [items, sort]);
  const { fetchNextPage } = mine;
  const loadingAll = useRef(false);

  // A sort covers every lyric, so choosing one loads the remaining pages, stopping at the first failure.
  const changeSort = useCallback(
    (key: MineSort["key"]) => {
      setSort((current) => nextMineSort(current, key));
      if (loadingAll.current || !mine.hasNextPage) return;
      loadingAll.current = true;
      const loadRest = async () => {
        let page = await fetchNextPage();
        while (page.hasNextPage && !page.isFetchNextPageError) page = await fetchNextPage();
      };
      loadRest()
        .catch((error: unknown) => console.warn(LOG_PREFIX, "could not load every lyric to sort", error))
        .finally(() => {
          loadingAll.current = false;
        });
    },
    [fetchNextPage, mine.hasNextPage],
  );

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
  if (mine.isPending) {
    return (
      <>
        <MineColumns sort={sort} onSort={changeSort} />
        <MineSkeleton />
      </>
    );
  }
  if (items.length === 0) {
    return (
      <ViewEmpty message="You haven't shared any lyrics on Unison yet.">
        <Button size="sm" variant="secondary" onClick={() => navigate(unisonViewPath("wanted"))}>
          See most wanted songs
        </Button>
      </ViewEmpty>
    );
  }

  return (
    <>
      <MineColumns sort={sort} onSort={changeSort} />
      <ul className="pt-1">
        {shownItems.map((item) => (
          <MineRow
            key={item.id}
            item={item}
            projectId={projectByLyric.get(String(item.id))?.id}
            opening={openingId === item.id}
            waiting={!entries}
            onOpenProject={libraryActions.open}
            onOpenAsProject={openAsProject}
          />
        ))}
      </ul>
      {mine.hasNextPage && !sort && (
        <LoadMore label="Load more" loading={mine.isFetchingNextPage} onLoadMore={() => void mine.fetchNextPage()} />
      )}
    </>
  );
};

const MineView: React.FC = () => {
  const session = useUnisonSession();
  const mine = useMyUnisonLyrics(session?.keyId ?? null);
  if (!session || isUnisonSessionEnded(mine.error)) return <MineSignedOut />;
  return (
    <section aria-label="My lyrics on Unison" className="flex flex-col">
      <MineList mine={mine} />
    </section>
  );
};

// -- Exports -------------------------------------------------------------------

export { MineView };
