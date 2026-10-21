import { Button } from "@/ui/button";
import { LinkButton } from "@/ui/link-button";
import { pluralize } from "@/utils/pluralize";
import { recordingPageUrl } from "@/views/export/musicbrainz/musicbrainz-links";
import { IconCheck, IconExternalLink } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface MusicBrainzFooterProps {
  recordingId: string;
  fillCount: number;
  onDismiss: () => void;
  onFill: () => void;
}

// -- Component ----------------------------------------------------------------

const MusicBrainzFooter: React.FC<MusicBrainzFooterProps> = ({ recordingId, fillCount, onDismiss, onFill }) => (
  <div className="flex shrink-0 items-center gap-2 border-t border-composer-border bg-composer-bg px-6 py-3">
    <LinkButton href={recordingPageUrl(recordingId)} external variant="ghost" size="sm" className="-ml-2.5 gap-1">
      Data from MusicBrainz
      <IconExternalLink className="size-3.5" />
    </LinkButton>
    <Button variant="ghost" size="sm" className="ml-auto" onClick={onDismiss}>
      Dismiss
    </Button>
    {fillCount > 0 && (
      <Button hasIcon variant="primary" size="sm" onClick={onFill}>
        <IconCheck className="size-3.5" />
        Fill {pluralize(fillCount, "empty field")}
      </Button>
    )}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { MusicBrainzFooter };
