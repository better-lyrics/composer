import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { LinkButton } from "@/ui/link-button";
import { cn } from "@/utils/cn";
import { pluralize } from "@/utils/pluralize";
import { recordingSearchPageUrl } from "@/views/export/musicbrainz/musicbrainz-links";
import type { MusicBrainzPanel } from "@/views/export/musicbrainz/use-musicbrainz-panel";
import {
  IconCheck,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconSwitchHorizontal,
} from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface MusicBrainzHeaderSlotProps {
  panel: MusicBrainzPanel;
  onRequest: () => void;
}

// -- Constants ----------------------------------------------------------------

const SLOT_TEXT = "text-xs text-(--muted) select-none";
const SLOT_BUTTON = "h-6";

// -- Components ---------------------------------------------------------------

const LookingUp: React.FC<{ title: string }> = ({ title }) => (
  <span className={cn("flex items-center gap-2 pr-1", SLOT_TEXT)}>
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

const SlotContent: React.FC<MusicBrainzHeaderSlotProps> = ({ panel, onRequest }) => {
  const title = useProjectStore((state) => state.metadata.title.trim());
  const { match, shown, detailCount } = panel;

  switch (match.status) {
    case "off":
      return null;
    case "missing-title":
      return <span className={cn("pr-1", SLOT_TEXT)}>Add a title to look it up on MusicBrainz</span>;
    case "idle":
      return (
        <Button hasIcon variant="ghost" size="sm" className={SLOT_BUTTON} onClick={onRequest}>
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
      <span className={cn("flex items-center gap-1.5", SLOT_TEXT)}>
        <IconSparkles className="size-3.5" />
        {pluralize(detailCount, "detail")} on MusicBrainz
      </span>
    );
  }

  return (
    <>
      {panel.dismissed ? (
        <span className={SLOT_TEXT}>Suggestions dismissed</span>
      ) : (
        <span className={cn("flex items-center gap-1.5", SLOT_TEXT)}>
          <IconCheck className="size-3.5" />
          Matches MusicBrainz
        </span>
      )}
      <IconButton
        label="Change match"
        variant="ghost"
        className="size-6"
        icon={<IconSwitchHorizontal className="size-3.5" />}
        onClick={panel.reveal}
      />
    </>
  );
};

function slotAnnouncement(panel: MusicBrainzPanel, title: string): string {
  const { match } = panel;
  if (match.status === "searching") return `Looking up ${title} on MusicBrainz`;
  if (match.status === "none") return "Not on MusicBrainz yet";
  if (match.status === "error") return "MusicBrainz did not answer";
  if (match.status !== "found" || !match.details) return "";
  if (panel.shown && panel.detailCount > 0) return `${pluralize(panel.detailCount, "detail")} found on MusicBrainz`;
  return panel.dismissed ? "" : "Matches MusicBrainz";
}

const MusicBrainzHeaderSlot: React.FC<MusicBrainzHeaderSlotProps> = (props) => {
  const title = useProjectStore((state) => state.metadata.title.trim());
  return (
    <>
      <span role="status" className="sr-only">
        {slotAnnouncement(props.panel, title)}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <SlotContent {...props} />
      </span>
    </>
  );
};

// -- Exports ------------------------------------------------------------------

export { MusicBrainzHeaderSlot };
