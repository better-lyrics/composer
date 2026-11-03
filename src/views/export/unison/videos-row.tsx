import { IconBrandYoutube } from "@tabler/icons-react";
import { displayArtists } from "@/domain/project/display-title";
import { submitDurationSeconds } from "@/domain/unison/submit-checks";
import { linkedVideoCount, VIDEO_LENGTH_TOLERANCE_SECONDS, VIDEO_LINK_LIMIT } from "@/domain/unison/video-links";
import { useVideoLinks } from "@/hooks/unison/useVideoSuggestions";
import type { UnisonLyric } from "@/lib/unison/api-types";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { PopBody, PopHead, PopText } from "@/ui/pop-layout";
import { Popover } from "@/ui/popover";
import { VideoPicker } from "@/ui/unison/video-picker";
import { formatTime } from "@/utils/format-time";
import { pluralize } from "@/utils/pluralize";
import { useManageVideos } from "@/views/export/unison/use-manage-videos";

// -- Interfaces ----------------------------------------------------------------

interface VideosRowProps {
  lyric: UnisonLyric;
  durationSeconds: number;
  canManage: boolean;
}

// -- Components ----------------------------------------------------------------

const ManageVideos: React.FC<Omit<VideosRowProps, "canManage">> = ({ lyric, durationSeconds }) => {
  const metadata = useProjectStore((state) => state.metadata);
  const songSeconds = submitDurationSeconds(durationSeconds || metadata.duration);
  const videos = useManageVideos(lyric, songSeconds);
  const songTitle = metadata.title.trim() || lyric.song;
  return (
    <PopBody>
      <PopHead title="Videos" meta={`${linkedVideoCount(videos.linked)} / ${VIDEO_LINK_LIMIT}`} />
      <PopText className="mt-1 mb-3">Lengths must match the song within {VIDEO_LENGTH_TOLERANCE_SECONDS} s.</PopText>
      <div className="px-1 pb-1">
        <VideoPicker
          floating
          main={{
            videoId: videos.primaryVideoId,
            title: songTitle,
            artworkUrl: metadata.thumbnailDataUrl,
            facts: { artist: displayArtists(metadata.artists), kind: null, duration: formatTime(songSeconds, 0) },
          }}
          linked={videos.linked}
          more={videos.more}
          songTitle={songTitle}
          songSeconds={songSeconds}
          busy={videos.busy}
          onLink={videos.link}
          onUnlink={videos.unlink}
          onAdd={videos.add}
        />
      </div>
    </PopBody>
  );
};

const VideosRow: React.FC<VideosRowProps> = ({ lyric, durationSeconds, canManage }) => {
  const count = useVideoLinks(lyric.id).data?.length;
  return (
    <div className="flex items-center gap-2 min-h-7 text-[13px] text-(--label)">
      <IconBrandYoutube aria-hidden="true" className="size-4 shrink-0 text-(--muted)" />
      <span className="tabular-nums">{count === undefined ? "Videos" : `Shows on ${pluralize(count, "video")}`}</span>
      {canManage && (
        <Popover
          placement="left-start"
          hasPopup="dialog"
          aria-label="Videos"
          trigger={
            <Button size="sm" variant="ghost" className="ml-auto -mr-1.5">
              Manage
            </Button>
          }
        >
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <ManageVideos lyric={lyric} durationSeconds={durationSeconds} />
          </div>
        </Popover>
      )}
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { VideosRow };
