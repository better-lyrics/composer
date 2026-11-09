import { suggestionFacts, suggestionLengthNote } from "@/domain/unison/video-links";
import type { SuggestedVideo } from "@/lib/unison/api-types";
import { useConfirm } from "@/stores/confirm-store";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { AddVideoField } from "@/ui/unison/add-video-field";
import { confirmDifferentTitle } from "@/ui/unison/confirm-different-title";
import { MatchMark, VideoRow } from "@/ui/unison/video-row";
import { PanelSection } from "@/views/export/unison/panel-section";
import { useSongSuggestions } from "@/views/export/unison/use-submit-videos";

// -- Interfaces ----------------------------------------------------------------

interface MainVideoChoiceProps {
  durationSeconds: number;
  onChoose: (videoId: string) => void;
}

// -- Constants -----------------------------------------------------------------

const CHOICE_HINT = "This project plays a file. Choose the YouTube video these lyrics match.";

// -- Components ----------------------------------------------------------------

const SuggestionRow: React.FC<{ suggestion: SuggestedVideo; songSeconds: number; onUse: () => void }> = ({
  suggestion,
  songSeconds,
  onUse,
}) => {
  const lengthNote = suggestionLengthNote(suggestion, songSeconds);
  return (
    <VideoRow
      videoId={suggestion.videoId}
      title={suggestion.title}
      artworkUrl={suggestion.artworkUrl}
      facts={lengthNote ? undefined : suggestionFacts(suggestion)}
      note={lengthNote ?? undefined}
      trailing={
        <>
          {suggestion.match && <MatchMark level={suggestion.match.level} />}
          <Button
            size="sm"
            variant="secondary"
            disabled={lengthNote !== null}
            aria-label={`Use ${suggestion.title}`}
            onClick={onUse}
            className="shrink-0"
          >
            Use
          </Button>
        </>
      }
    />
  );
};

const MainVideoChoice: React.FC<MainVideoChoiceProps> = ({ durationSeconds, onChoose }) => {
  const confirm = useConfirm();
  const songTitle = useProjectStore((state) => state.metadata.title);
  const { songSeconds, suggestions } = useSongSuggestions(undefined, durationSeconds);

  const use = async (suggestion: SuggestedVideo) => {
    if (await confirmDifferentTitle(confirm, suggestion, songTitle)) onChoose(suggestion.videoId);
  };

  return (
    <PanelSection title="Video">
      <p className="text-xs leading-[18px] text-(--muted) text-pretty">{CHOICE_HINT}</p>
      {suggestions.length > 0 && (
        <ul aria-label="Matching videos" className="-mx-1.5 flex min-w-0 flex-col gap-2">
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.videoId}
              suggestion={suggestion}
              songSeconds={songSeconds}
              onUse={() => void use(suggestion)}
            />
          ))}
        </ul>
      )}
      <AddVideoField
        placeholder="Paste the YouTube link"
        onAdd={(videoId) => {
          onChoose(videoId);
          return null;
        }}
      />
    </PanelSection>
  );
};

// -- Exports -------------------------------------------------------------------

export { MainVideoChoice };
