import { type ChosenVideo, linkedVideoCount, VIDEO_LINK_LIMIT } from "@/domain/unison/video-links";
import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { type MainVideo, MainVideoRow, VideoPicker } from "@/ui/unison/video-picker";
import { MainVideoChoice } from "@/views/export/unison/main-video-choice";
import { PanelSection } from "@/views/export/unison/panel-section";
import { SubmitCard, type SubmitterSession, type VideoSectionState } from "@/views/export/unison/submit-card";
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

const ChangeMainVideo: React.FC<{ main: MainVideo; onChange: () => void }> = ({ main, onChange }) => (
  <PanelSection title="Video">
    <ul aria-label="Main video" className="-mx-1.5 flex min-w-0 flex-col">
      <MainVideoRow main={main} onChange={onChange} />
    </ul>
  </PanelSection>
);

interface SubmissionWithVideosProps extends NewSubmissionProps {
  mainVideoId: string;
  chosenMain?: ChosenVideo;
  onChangeMain?: () => void;
}

const SubmissionWithVideos: React.FC<SubmissionWithVideosProps> = ({
  mainVideoId,
  chosenMain,
  onChangeMain,
  ...props
}) => {
  const videos = useSubmitVideos(mainVideoId, props.source.durationSeconds, chosenMain);
  const section = ({ busy, capReached }: VideoSectionState) => {
    if (capReached) return onChangeMain && <ChangeMainVideo main={videos.main} onChange={onChangeMain} />;
    return (
      <PanelSection title="Videos" meta={<VideoCount count={linkedVideoCount(videos.linked)} />}>
        <div className="-mx-1.5">
          <VideoPicker
            main={videos.main}
            linked={videos.linked}
            more={videos.more}
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
  };
  return <SubmitCard lyricId={null} {...props} videoSection={section} videoIds={videos.videoIds} />;
};

const FileSourceSubmission: React.FC<NewSubmissionProps> = (props) => {
  const [chosenMain, setChosenMain] = useState<ChosenVideo | null>(null);
  if (!chosenMain) {
    const section = ({ capReached }: VideoSectionState) =>
      !capReached && <MainVideoChoice durationSeconds={props.source.durationSeconds} onChoose={setChosenMain} />;
    return <SubmitCard lyricId={null} {...props} videoSection={section} />;
  }
  return (
    <SubmissionWithVideos
      key={chosenMain.videoId}
      {...props}
      source={{ ...props.source, videoId: chosenMain.videoId }}
      mainVideoId={chosenMain.videoId}
      chosenMain={chosenMain}
      onChangeMain={() => setChosenMain(null)}
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
