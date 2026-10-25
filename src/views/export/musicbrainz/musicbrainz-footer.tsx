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
  <div className="flex shrink-0 items-center gap-2 py-2.5 pl-4 pr-3 shadow-[inset_0_1px_0_var(--divider)]">
    <LinkButton
      href={recordingPageUrl(recordingId)}
      external
      variant="ghost"
      size="sm"
      className="h-auto gap-1 p-0 text-xs text-(--muted) hover:bg-transparent hover:text-composer-text active:scale-100"
    >
      Data from MusicBrainz
      <IconExternalLink className="size-[13px]" />
    </LinkButton>
    <Button variant="ghost" size="sm" className="ml-auto px-3 text-[13px]" onClick={onDismiss}>
      Dismiss
    </Button>
    {fillCount > 0 && (
      <Button hasIcon variant="primary" size="sm" onClick={onFill} className="pl-2.5 text-[13px]">
        <IconCheck className="size-4" />
        Fill {pluralize(fillCount, "field")}
      </Button>
    )}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { MusicBrainzFooter };
