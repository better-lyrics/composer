import {
  type ChosenVideo,
  linkedVideoCount,
  suggestionFacts,
  suggestionLengthNote,
  VIDEO_LINK_LIMIT,
  type VideoFacts,
} from "@/domain/unison/video-links";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import { useConfirm } from "@/stores/confirm-store";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { AddVideoField } from "@/ui/unison/add-video-field";
import { confirmDifferentTitle } from "@/ui/unison/confirm-different-title";
import { ChosenVideoRow, MatchMark, VideoRow } from "@/ui/unison/video-row";
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
  songSeconds: number;
  busy?: boolean;
  floating?: boolean;
  onLink: (suggestion: SuggestedVideo) => PickerResult;
  onUnlink: (videoId: string) => PickerResult;
  onAdd: (videoId: string) => PickerResult;
  onChangeMain?: () => void;
}

interface RowError {
  videoId: string;
  message: string;
}

// -- Constants -----------------------------------------------------------------

const ALREADY_LINKED_MESSAGE = "That video is already linked.";
const CAP_REACHED_MESSAGE = `Up to ${VIDEO_LINK_LIMIT} videos per lyric. Unlink one to add another.`;

// -- Components ----------------------------------------------------------------

const VideoPicker: React.FC<VideoPickerProps> = ({
  main,
  linked,
  more,
  songTitle,
  songSeconds,
  busy,
  floating,
  onLink,
  onUnlink,
  onAdd,
  onChangeMain,
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
    if (!(await confirmDifferentTitle(confirm, suggestion, songTitle))) return;
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
          trailing={
            onChangeMain && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={onChangeMain} className="shrink-0">
                Change
              </Button>
            )
          }
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
            {more.map((suggestion) => {
              const lengthNote = suggestionLengthNote(suggestion, songSeconds);
              return (
                <VideoRow
                  key={suggestion.videoId}
                  videoId={suggestion.videoId}
                  title={suggestion.title}
                  artworkUrl={suggestion.artworkUrl}
                  facts={lengthNote ? undefined : suggestionFacts(suggestion)}
                  note={lengthNote ?? undefined}
                  error={errorFor(suggestion.videoId)}
                  trailing={
                    <>
                      {suggestion.match && <MatchMark level={suggestion.match.level} />}
                      <Button
                        size="sm"
                        variant="secondary"
                        hasIcon
                        disabled={busy || atCap || lengthNote !== null}
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
              );
            })}
          </ul>
        </div>
      )}
      <AddVideoField onAdd={add} floating={floating} busy={busy} disabledReason={atCap ? CAP_REACHED_MESSAGE : null} />
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { VideoPicker };
export type { MainVideo };
