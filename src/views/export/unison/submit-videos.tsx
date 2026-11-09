import { linkedVideoCount, VIDEO_LINK_LIMIT } from "@/domain/unison/video-links";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { VideoPicker } from "@/ui/unison/video-picker";
import { MainVideoChoice } from "@/views/export/unison/main-video-choice";
import { PanelSection } from "@/views/export/unison/panel-section";
import { SubmitCard, type SubmitterSession } from "@/views/export/unison/submit-card";
import type { UnisonExportSource } from "@/views/export/unison/submit-card-shell";
import { useSubmitVideos } from "@/views/export/unison/use-submit-videos";
import { useState } from "react";

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

interface SubmissionWithVideosProps extends NewSubmissionProps {
  mainVideoId: string;
  onChangeMain?: () => void;
}

const SubmissionWithVideos: React.FC<SubmissionWithVideosProps> = ({ mainVideoId, onChangeMain, ...props }) => {
  const videos = useSubmitVideos(mainVideoId, props.source.durationSeconds);
  const section = (busy: boolean) => (
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
          onChangeMain={onChangeMain}
          busy={busy}
        />
      </div>
    </PanelSection>
  );
  return <SubmitCard lyricId={null} {...props} videoSection={section} videoIds={videos.videoIds} />;
};

const FileSourceSubmission: React.FC<NewSubmissionProps> = (props) => {
  const [chosenVideoId, setChosenVideoId] = useState<string | null>(null);
  if (!chosenVideoId) {
    const section = () => (
      <MainVideoChoice durationSeconds={props.source.durationSeconds} onChoose={setChosenVideoId} />
    );
    return <SubmitCard lyricId={null} {...props} videoSection={section} />;
  }
  return (
    <SubmissionWithVideos
      key={chosenVideoId}
      {...props}
      source={{ ...props.source, videoId: chosenVideoId }}
      mainVideoId={chosenVideoId}
      onChangeMain={() => setChosenVideoId(null)}
    />
  );
};

const NewSubmission: React.FC<NewSubmissionProps> = (props) => {
  const openProjectId = useOpenProjectId();
  const mainVideoId = props.source.videoId;
  if (!mainVideoId) return <FileSourceSubmission key={openProjectId} {...props} />;
  return <SubmissionWithVideos key={mainVideoId} mainVideoId={mainVideoId} {...props} />;
};

// -- Exports -------------------------------------------------------------------

export { NewSubmission };
