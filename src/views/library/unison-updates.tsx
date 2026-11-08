import { displayTitle } from "@/domain/project/display-title";
import type { ProjectIndexEntry } from "@/domain/project/index-entry";
import type { ProjectTab } from "@/domain/project/tab";
import {
  type UnisonUpdate,
  type UnisonUpdateKind,
  lastSeenFrom,
  settledLastSeen,
  updatesSince,
} from "@/domain/unison/updates-since";
import type { UnisonMineItem } from "@/lib/unison/api-types";
import { readLastSeen, writeLastSeen } from "@/lib/unison/last-seen";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { ProjectArt } from "@/ui/projects/project-art";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { requestHistoryAt } from "@/views/export/unison/history-request";
import { formatRelativeTime } from "@/utils/format-relative-time";
import { type Icon, IconCircleCheck, IconCircleX, IconEyeOff, IconX } from "@tabler/icons-react";
import { useEffect, useId, useMemo, useState } from "react";

// -- Types ---------------------------------------------------------------------

interface UnisonUpdatesProps {
  items: readonly UnisonMineItem[] | null;
  projectByLyric: ReadonlyMap<string, ProjectIndexEntry>;
  now: number;
  onOpenProject: (id: string, tab?: ProjectTab) => void;
  className?: string;
}

interface UpdateRowProps {
  update: UnisonUpdate;
  project: ProjectIndexEntry;
  now: number;
  onAct: (update: UnisonUpdate, project: ProjectIndexEntry) => void;
}

// -- Constants -----------------------------------------------------------------

const UPDATE_CHIPS: Record<UnisonUpdateKind, { tone: "positive" | "error"; label: string; icon: Icon }> = {
  approved: { tone: "positive", label: "Edit approved", icon: IconCircleCheck },
  declined: { tone: "error", label: "Edit declined", icon: IconCircleX },
  hidden: { tone: "error", label: "Hidden by downvotes", icon: IconEyeOff },
};

// -- Components ----------------------------------------------------------------

const UpdateRow: React.FC<UpdateRowProps> = ({ update, project, now, onAct }) => {
  const chip = UPDATE_CHIPS[update.kind];
  const title = displayTitle(project.title);
  const action = update.kind === "declined" ? "Read the note" : "Open project";
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 min-h-12 pr-1.5">
      <ProjectArt src={project.thumbnailDataUrl} size="md" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium truncate">{title}</span>
        <span className="flex items-center gap-2 text-xs text-(--muted)">
          <StatusChip tone={chip.tone} icon={chip.icon}>
            {chip.label}
          </StatusChip>
          <span className="truncate select-text">{formatRelativeTime(update.at * 1000, now)}</span>
        </span>
      </div>
      <Button size="sm" variant="secondary" aria-label={`${action}, ${title}`} onClick={() => onAct(update, project)}>
        {action}
      </Button>
    </li>
  );
};

const UnisonUpdates: React.FC<UnisonUpdatesProps> = ({ items, projectByLyric, now, onOpenProject, className }) => {
  const headingId = useId();
  const [previous, setPrevious] = useState(readLastSeen);
  const updates = useMemo(
    () => (items ? updatesSince(previous, items).filter((update) => projectByLyric.has(update.lyricId)) : []),
    [items, previous, projectByLyric],
  );

  // Another tab may have acted on a notice since this one mounted, so settle against what is stored now.
  useEffect(() => {
    if (!items) return;
    const settled = settledLastSeen(readLastSeen(), items);
    writeLastSeen(settled);
    setPrevious(settled);
  }, [items]);

  if (updates.length === 0) return null;

  const acknowledge = (lyricId?: string) => {
    if (!items) return;
    const seen = lyricId ? items.filter((item) => String(item.id) === lyricId) : items;
    const next = lastSeenFrom(seen, previous);
    setPrevious(next);
    writeLastSeen(next);
  };

  const act = (update: UnisonUpdate, project: ProjectIndexEntry) => {
    acknowledge(update.lyricId);
    if (update.kind !== "declined") {
      onOpenProject(project.id);
      return;
    }
    requestHistoryAt(Number(update.lyricId), update.revNo);
    onOpenProject(project.id, "export");
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-2 p-4 pr-2.5 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] select-none",
        className,
      )}
    >
      <div className="flex items-center gap-2 -mt-1">
        <h2 id={headingId} className="text-[15px] font-bold">
          Since you were last here
        </h2>
        <IconButton
          variant="ghost"
          label="Dismiss Unison updates"
          icon={<IconX aria-hidden="true" className="size-4" />}
          onClick={() => acknowledge()}
          className="ml-auto size-7"
        />
      </div>
      <ul className="flex flex-col">
        {updates.flatMap((update) => {
          const project = projectByLyric.get(update.lyricId);
          return project
            ? [
                <UpdateRow
                  key={`${update.lyricId}:${update.kind}:${update.revNo}`}
                  update={update}
                  project={project}
                  now={now}
                  onAct={act}
                />,
              ]
            : [];
        })}
      </ul>
    </section>
  );
};

// Mounts per sign-in, so each account starts from its own stored notices.
const SignedInUnisonUpdates: React.FC<UnisonUpdatesProps & { signedIn: boolean }> = ({ signedIn, ...props }) =>
  signedIn ? <UnisonUpdates {...props} /> : null;

// -- Exports -------------------------------------------------------------------

export { SignedInUnisonUpdates };
