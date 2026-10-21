import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { LinkButton } from "@/ui/link-button";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { CoverArt } from "@/views/export/musicbrainz/cover-art";
import { recordingSearchPageUrl } from "@/views/export/musicbrainz/musicbrainz-links";
import type { MusicBrainzPanel } from "@/views/export/musicbrainz/use-musicbrainz-panel";
import {
  IconCheck,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconSwitchHorizontal,
  IconX,
} from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface MusicBrainzHeaderSlotProps {
  panel: MusicBrainzPanel;
  onReview: () => void;
}

// -- Constants ----------------------------------------------------------------

const SLOT_TEXT = "text-xs text-composer-text-muted select-none";
const SLOT_BUTTON = "h-6";

// -- Components ---------------------------------------------------------------

const LookingUp: React.FC<{ title: string }> = ({ title }) => (
  <span role="status" className={cn("flex items-center gap-2 pr-1", SLOT_TEXT)}>
    <IconLoader2 className="size-3.5 opacity-70 motion-safe:animate-spin" />
    Looking up {title}
  </span>
);

const DidNotAnswer: React.FC<{ retry: () => void }> = ({ retry }) => (
  <>
    <span className="text-xs text-composer-text-muted select-text cursor-text">MusicBrainz did not answer</span>
    <Button hasIcon variant="ghost" size="sm" className={SLOT_BUTTON} onClick={retry}>
      <IconRefresh className="size-3.5" />
      Try again
    </Button>
  </>
);

const MusicBrainzHeaderSlot: React.FC<MusicBrainzHeaderSlotProps> = ({ panel, onReview }) => {
  const title = useProjectStore((state) => state.metadata.title.trim());
  const { match, shown, detailCount } = panel;

  switch (match.status) {
    case "off":
      return null;
    case "missing-title":
      return <span className={cn("pr-1", SLOT_TEXT)}>Add a title to look it up on MusicBrainz</span>;
    case "idle":
      return (
        <Button hasIcon variant="ghost" size="sm" className={SLOT_BUTTON} onClick={panel.request}>
          <IconSearch className="size-3.5" />
          Find on MusicBrainz
        </Button>
      );
    case "searching":
      return <LookingUp title={title} />;
    case "error":
      return <DidNotAnswer retry={match.retry} />;
    case "none":
      return (
        <>
          <span className={SLOT_TEXT}>Not on MusicBrainz yet</span>
          <LinkButton href={recordingSearchPageUrl(title)} external variant="ghost" size="sm" className={SLOT_BUTTON}>
            Add it
            <IconExternalLink className="size-3.5" />
          </LinkButton>
        </>
      );
    case "found":
      break;
  }

  if (match.detailsFailed) return <DidNotAnswer retry={match.retry} />;
  if (!match.details) return <LookingUp title={title} />;

  if (shown && detailCount > 0) {
    return (
      <>
        <CoverArt
          key={shown.details.coverReleaseGroupId}
          releaseGroupId={shown.details.coverReleaseGroupId}
          className="size-4"
        />
        <span className="ml-1.5 mr-1 text-xs text-composer-text-secondary select-none">
          {pluralize(detailCount, "detail")} for <span className="text-composer-text">{shown.details.title}</span> on
          MusicBrainz
        </span>
        <Button variant="ghost" size="sm" className={cn(SLOT_BUTTON, "text-composer-accent-text")} onClick={onReview}>
          Review
        </Button>
        <IconButton
          label="Dismiss"
          variant="ghost"
          className="size-6"
          icon={<IconX className="size-3.5" />}
          onClick={panel.dismiss}
        />
      </>
    );
  }

  return (
    <>
      <span className={cn("flex items-center gap-1.5", SLOT_TEXT)}>
        <IconCheck className="size-3.5" />
        Matches MusicBrainz
      </span>
      <IconButton
        label="Change match"
        variant="ghost"
        className="size-6"
        icon={<IconSwitchHorizontal className="size-3.5" />}
        onClick={() => {
          panel.reveal();
          onReview();
        }}
      />
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { MusicBrainzHeaderSlot };
