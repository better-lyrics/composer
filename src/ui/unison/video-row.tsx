import { type ChosenVideo, suggestionFacts, type VideoFacts } from "@/domain/unison/video-links";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import { ProjectArt } from "@/ui/projects/project-art";
import { Tooltip } from "@/ui/tooltip";
import { YouTubeMusicLink } from "@/ui/unison/youtube-music-link";
import { cn } from "@/utils/cn";
import { YOUTUBE_PLACEHOLDER_THUMBNAIL_WIDTH, youTubeThumbnailUrl } from "@/utils/youtube-music-url";
import { IconCircleCheck, IconHelpCircle, IconStack2 } from "@tabler/icons-react";

// -- Types ---------------------------------------------------------------------

type MatchLevel = NonNullable<SuggestedVideo["match"]>["level"];
type VideoTag = "main" | "suggested";

interface VideoRowProps {
  videoId: string;
  title?: string;
  artworkUrl?: string | null;
  tag?: VideoTag;
  facts?: VideoFacts;
  note?: string;
  error?: string | null;
  trailing?: React.ReactNode;
}

// -- Constants -----------------------------------------------------------------

const MARKS: Record<MatchLevel, { icon: typeof IconCircleCheck; hint: string; className: string }> = {
  same: { icon: IconCircleCheck, hint: "Likely the same recording", className: "text-composer-positive" },
  related: {
    icon: IconHelpCircle,
    hint: "Might be a different version. Check before adding",
    className: "text-composer-warning",
  },
  different: { icon: IconStack2, hint: "A different version, or another song", className: "text-(--muted)" },
};

const TAGS: Record<VideoTag, { label: string; className: string }> = {
  main: { label: "Main video", className: "font-medium text-(--label)" },
  suggested: { label: "Suggested", className: "text-composer-accent-text" },
};

const PENDING_NOTE = "Checked after you submit";
const LINKED_NOTE = "Linked video";

// -- Components ----------------------------------------------------------------

const MatchMark: React.FC<{ level: MatchLevel }> = ({ level }) => {
  const { icon: MarkIcon, hint, className } = MARKS[level];
  return (
    <Tooltip content={hint}>
      <span role="img" aria-label={hint} className="grid place-items-center size-7 shrink-0 cursor-help">
        <MarkIcon aria-hidden="true" className={cn("size-4", className)} />
      </span>
    </Tooltip>
  );
};

const VideoArt: React.FC<{ videoId: string; artworkUrl?: string | null }> = ({ videoId, artworkUrl }) =>
  artworkUrl ? (
    <ProjectArt key={artworkUrl} src={artworkUrl} size="md" />
  ) : (
    <ProjectArt
      key={videoId}
      src={youTubeThumbnailUrl(videoId)}
      size="md"
      rejectNaturalWidth={YOUTUBE_PLACEHOLDER_THUMBNAIL_WIDTH}
    />
  );

const FactsLine: React.FC<{ facts: VideoFacts }> = ({ facts }) => (
  <>
    {[facts.artist, facts.kind].filter(Boolean).join(" ・ ")}
    {facts.duration && (
      <>
        {" ・ "}
        <span className="font-mono tabular-nums">{facts.duration}</span>
      </>
    )}
  </>
);

const VideoRow: React.FC<VideoRowProps> = ({ videoId, title, artworkUrl, tag, facts, note, error, trailing }) => (
  <li className="flex min-w-0 items-center gap-2.5 min-h-9 px-1 rounded-lg">
    <VideoArt videoId={videoId} artworkUrl={artworkUrl} />
    <div className="flex min-w-0 flex-1 flex-col">
      <YouTubeMusicLink videoId={videoId} label={title} />
      {error ? (
        <p role="alert" className="text-xs leading-[18px] text-composer-negative text-pretty select-text cursor-text">
          {error}
        </p>
      ) : (
        <span className="text-xs text-(--muted) truncate">
          {tag && <span className={TAGS[tag].className}>{TAGS[tag].label} ・ </span>}
          {facts ? <FactsLine facts={facts} /> : note}
        </span>
      )}
    </div>
    {trailing}
  </li>
);

const ChosenVideoRow: React.FC<{ video: ChosenVideo; error?: string | null; trailing: React.ReactNode }> = ({
  video,
  error,
  trailing,
}) => (
  <VideoRow
    videoId={video.videoId}
    title={video.suggestion?.title}
    artworkUrl={video.suggestion?.artworkUrl}
    tag={video.origin === "suggested" ? "suggested" : undefined}
    facts={video.suggestion ? suggestionFacts(video.suggestion) : undefined}
    note={video.origin === "pasted" ? PENDING_NOTE : LINKED_NOTE}
    error={error}
    trailing={trailing}
  />
);

// -- Exports -------------------------------------------------------------------

export { ChosenVideoRow, MatchMark, VideoRow };
