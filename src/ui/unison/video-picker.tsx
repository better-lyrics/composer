import { quotedTitle } from "@/domain/project/display-title";
import { type ChosenVideo, VIDEO_LINK_LIMIT } from "@/domain/unison/video-links";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import { useConfirm } from "@/stores/confirm-store";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { AddVideoField } from "@/ui/unison/add-video-field";
import { ChosenVideoRow, MatchMark, suggestionFacts, type VideoFacts, VideoRow } from "@/ui/unison/video-row";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";

// -- Types ---------------------------------------------------------------------

type PickerResult = Promise<string | null> | string | null;

interface MainVideo {
  videoId: string;
  title?: string;
  artworkUrl?: string | null;
  facts?: VideoFacts;
}

interface VideoPickerProps {
  main: MainVideo;
  linked: readonly ChosenVideo[];
  more: readonly SuggestedVideo[];
  songTitle: string;
  busy?: boolean;
  floating?: boolean;
  onLink: (suggestion: SuggestedVideo) => PickerResult;
  onUnlink: (videoId: string) => PickerResult;
  onAdd: (videoId: string) => PickerResult;
}

interface RowError {
  videoId: string;
  message: string;
}

// -- Constants -----------------------------------------------------------------

const ALREADY_LINKED_MESSAGE = "That video is already linked.";
const CAP_REACHED_MESSAGE = `Up to ${VIDEO_LINK_LIMIT} videos per lyric. Unlink one to add another.`;

// -- Helpers -------------------------------------------------------------------

function linkedVideoCount(linked: readonly ChosenVideo[]): number {
  return linked.length + 1;
}

// -- Components ----------------------------------------------------------------

const VideoPicker: React.FC<VideoPickerProps> = ({
  main,
  linked,
  more,
  songTitle,
  busy,
  floating,
  onLink,
  onUnlink,
  onAdd,
}) => {
  const confirm = useConfirm();
  const rootRef = useRef<HTMLDivElement>(null);
  const moreLabelId = useId();
  const [rowError, setRowError] = useState<RowError | null>(null);
  const atCap = linkedVideoCount(linked) >= VIDEO_LINK_LIMIT;
  const errorFor = (videoId: string) => (rowError?.videoId === videoId ? rowError.message : null);

  const run = async (videoId: string, action: () => PickerResult) => {
    setRowError(null);
    const failure = await action();
    if (failure) setRowError({ videoId, message: failure });
    else rootRef.current?.focus();
  };

  const link = async (suggestion: SuggestedVideo) => {
    if (suggestion.match?.level !== "same") {
      const sure = await confirm({
        title: "Link a video with a different title?",
        description: `${quotedTitle(suggestion.title)} may not be the same recording as ${quotedTitle(songTitle)}. Link it only if the lyrics line up with it.`,
        confirmLabel: "Link video",
        cancelLabel: "Cancel",
        variant: "primary",
      });
      if (!sure) return;
    }
    await run(suggestion.videoId, () => onLink(suggestion));
  };

  const add = (videoId: string) => {
    setRowError(null);
    if (videoId === main.videoId || linked.some((video) => video.videoId === videoId)) return ALREADY_LINKED_MESSAGE;
    return onAdd(videoId);
  };

  return (
    <div ref={rootRef} tabIndex={-1} className="flex min-w-0 flex-col gap-4 outline-none">
      <ul aria-label="Linked videos" className="flex min-w-0 flex-col gap-2">
        <VideoRow
          videoId={main.videoId}
          title={main.title}
          artworkUrl={main.artworkUrl}
          tag="main"
          facts={main.facts}
        />
        {linked.map((video) => (
          <ChosenVideoRow
            key={video.videoId}
            video={video}
            error={errorFor(video.videoId)}
            trailing={
              <IconButton
                variant="ghost"
                label={`Unlink ${video.suggestion?.title ?? video.videoId}`}
                icon={<IconX aria-hidden="true" className="size-4" />}
                disabled={busy}
                onClick={() => void run(video.videoId, () => onUnlink(video.videoId))}
                className="size-7"
              />
            }
          />
        ))}
      </ul>
      {more.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2">
          <span id={moreLabelId} className="px-1.5 text-xs font-medium text-(--muted)">
            More matches
          </span>
          <ul aria-labelledby={moreLabelId} className="flex min-w-0 flex-col gap-2">
            {more.map((suggestion) => (
              <VideoRow
                key={suggestion.videoId}
                videoId={suggestion.videoId}
                title={suggestion.title}
                artworkUrl={suggestion.artworkUrl}
                facts={suggestionFacts(suggestion)}
                error={errorFor(suggestion.videoId)}
                trailing={
                  <>
                    {suggestion.match && <MatchMark level={suggestion.match.level} />}
                    <Button
                      size="sm"
                      variant="secondary"
                      hasIcon
                      disabled={busy || atCap}
                      aria-label={`Link ${suggestion.title}`}
                      onClick={() => void link(suggestion)}
                      className="shrink-0"
                    >
                      <IconPlus aria-hidden="true" className="size-4" />
                      Link
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        </div>
      )}
      <AddVideoField onAdd={add} floating={floating} disabledReason={atCap ? CAP_REACHED_MESSAGE : null} />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { linkedVideoCount, VideoPicker };
export type { MainVideo, PickerResult };
