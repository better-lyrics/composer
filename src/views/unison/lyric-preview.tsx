import { mainBounds } from "@/domain/line/bounds";
import { projectsByLyricId } from "@/domain/unison/linked-projects";
import { isOwnLyric } from "@/domain/unison/ownership";
import { useUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import type { UnisonLyric, UnisonSearchResult } from "@/lib/unison/api-types";
import { openUnisonLyric, readUnisonLyric } from "@/lib/unison/open-unison-lyric";
import { Button } from "@/ui/button";
import { ConfidenceMeter } from "@/ui/unison/confidence-meter";
import { UnisonAvatar } from "@/ui/unison/unison-avatar";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/format-time";
import { InlineError } from "@/views/unison/view-states";
import { IconFileImport } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Types ---------------------------------------------------------------------

interface LyricPreviewProps {
  result: UnisonSearchResult;
  ownKeyId: string | null;
}

interface PreviewLine {
  time: number | null;
  text: string;
}

type PreviewLines = { status: "readable"; lines: PreviewLine[] } | { status: "unreadable"; message: string };

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[UnisonPreview]";
const SKELETON_LINE_WIDTHS = ["w-3/5", "w-4/5", "w-2/5", "w-3/4", "w-1/2", "w-2/3"];
const WELL =
  "h-52 overflow-auto overscroll-contain rounded-[10px] bg-(--well) px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--edge)]";

// -- Helpers -------------------------------------------------------------------

function previewLines(lyric: UnisonLyric): PreviewLines {
  const read = readUnisonLyric(lyric);
  if (read.status === "unreadable") return read;
  const lines = read.parsed.lines.flatMap((line) =>
    line.text.trim() ? [{ time: mainBounds(line)?.begin ?? null, text: line.text }] : [],
  );
  return { status: "readable", lines };
}

// -- Components ----------------------------------------------------------------

const PreviewSkeleton: React.FC = () => (
  <div aria-hidden="true" className={cn(WELL, "flex flex-col gap-3.5 animate-pulse motion-reduce:animate-none")}>
    {SKELETON_LINE_WIDTHS.map((width) => (
      <span key={width} className={cn("block h-2.5 rounded bg-(--layer-2)", width)} />
    ))}
  </div>
);

const PreviewText: React.FC<{ preview: PreviewLines }> = ({ preview }) => {
  if (preview.status === "unreadable") {
    return <p className={cn(WELL, "text-[13px] text-(--muted) select-text cursor-text")}>{preview.message}</p>;
  }
  return (
    <ol aria-label="Lyrics preview" className={cn(WELL, "flex flex-col gap-2 select-text")}>
      {preview.lines.map((line, index) => (
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- read-only preview derived per render; lyric lines have no id and repeat in choruses
        <li key={`${index}-${line.text}`} className="grid grid-cols-[44px_1fr] gap-2 text-[13px] leading-5">
          <span className="font-mono text-xs leading-5 text-(--muted) tabular-nums">
            {line.time === null ? "" : formatTime(line.time, 0)}
          </span>
          <span className="text-composer-text text-pretty">{line.text}</span>
        </li>
      ))}
    </ol>
  );
};

const LyricPreview: React.FC<LyricPreviewProps> = ({ result, ownKeyId }) => {
  const lyric = useUnisonLyric(result.id);
  const navigate = useNavigate();
  const { entries } = useProjectIndex();
  const [opening, setOpening] = useState(false);
  const preview = useMemo(() => (lyric.data ? previewLines(lyric.data) : null), [lyric.data]);
  const submitter = result.submitter;
  const isOwn = isOwnLyric(result, ownKeyId);

  const open = (loaded: UnisonLyric) => {
    setOpening(true);
    // One project carries the link, so a second copy of your own lyric opens unlinked.
    const link = isOwn && !projectsByLyricId(entries ?? []).has(String(loaded.id));
    openUnisonLyric(loaded, { link, navigate })
      .catch((error: unknown) => console.error(LOG_PREFIX, "could not open the lyrics as a project", error))
      .finally(() => setOpening(false));
  };

  return (
    <aside
      aria-label="Selected lyrics"
      className="flex flex-col gap-4 p-4 min-h-0 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)]"
    >
      <div className="flex items-center gap-3">
        <UnisonAvatar avatarUrl={submitter?.avatarUrl ?? null} size="md" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium truncate">{submitter?.displayName ?? "Unknown"}</p>
          {submitter && <p className="text-xs text-(--muted)">Level {submitter.level}</p>}
        </div>
        <span className="ml-auto">
          <ConfidenceMeter confidence={result.confidence} withLabel />
        </span>
      </div>
      {lyric.isError ? (
        <InlineError error={lyric.error} onRetry={() => void lyric.refetch()} />
      ) : preview ? (
        <PreviewText preview={preview} />
      ) : (
        <PreviewSkeleton />
      )}
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          hasIcon
          disabled={!lyric.data || !entries || preview?.status !== "readable" || opening}
          onClick={() => lyric.data && open(lyric.data)}
        >
          <IconFileImport aria-hidden="true" className="size-4" />
          Open as new project
        </Button>
        {!isOwn && (
          <p className="text-xs leading-[18px] text-(--muted) text-pretty">Your fix becomes your own version.</p>
        )}
      </div>
    </aside>
  );
};

// -- Exports -------------------------------------------------------------------

export { LyricPreview };
