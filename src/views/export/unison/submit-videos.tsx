import { linkedVideoCount, VIDEO_LINK_LIMIT } from "@/domain/unison/video-links";
import { VideoPicker } from "@/ui/unison/video-picker";
import { PanelSection } from "@/views/export/unison/panel-section";
import { SubmitCard, type SubmitterSession } from "@/views/export/unison/submit-card";
import type { UnisonExportSource } from "@/views/export/unison/submit-card-shell";
import { useSubmitVideos } from "@/views/export/unison/use-submit-videos";

// -- Interfaces ----------------------------------------------------------------

interface NewSubmissionProps {
  session: SubmitterSession;
  sessionEnded: boolean;
  onSessionEnded: () => void;
  source: UnisonExportSource;
}

// -- Components ----------------------------------------------------------------

const VideoCount: React.FC<{ count: number }> = ({ count }) => (
  <span className="font-mono text-xs text-(--muted) tabular-nums">
    {count} / {VIDEO_LINK_LIMIT}
  </span>
);

const SubmissionWithVideos: React.FC<NewSubmissionProps & { mainVideoId: string }> = ({ mainVideoId, ...props }) => {
  const videos = useSubmitVideos(mainVideoId, props.source.durationSeconds);
  const section = (
    <PanelSection title="Videos" meta={<VideoCount count={linkedVideoCount(videos.linked)} />}>
      <div className="-mx-1.5">
        <VideoPicker
          main={videos.main}
          linked={videos.linked}
          more={videos.more}
          songTitle={videos.songTitle}
          songSeconds={videos.songSeconds}
          onLink={videos.link}
          onUnlink={videos.unlink}
          onAdd={videos.add}
        />
      </div>
    </PanelSection>
  );
  return <SubmitCard lyricId={null} {...props} videoSection={section} videoIds={videos.videoIds} />;
};

const NewSubmission: React.FC<NewSubmissionProps> = (props) => {
  const mainVideoId = props.source.videoId;
  if (!mainVideoId) return <SubmitCard lyricId={null} {...props} />;
  return <SubmissionWithVideos key={mainVideoId} mainVideoId={mainVideoId} {...props} />;
};

// -- Exports -------------------------------------------------------------------

export { NewSubmission };
