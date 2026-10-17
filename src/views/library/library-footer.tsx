import { Button } from "@/ui/button";
import { formatFileSize } from "@/utils/format-file-size";
import { IconDatabase } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface LibraryFooterProps {
  storedAudioBytes: number;
  onManageStorage: () => void;
}

// -- Component ----------------------------------------------------------------

const LibraryFooter: React.FC<LibraryFooterProps> = ({ storedAudioBytes, onManageStorage }) => (
  <footer className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-composer-border text-[13px] text-composer-text-muted select-none">
    <span>
      Projects save on this device. <span className="tabular-nums">{formatFileSize(storedAudioBytes)}</span> of audio
      stored.
    </span>
    <Button variant="ghost" size="sm" hasIcon onClick={onManageStorage} className="-mr-3 text-composer-text-secondary">
      <IconDatabase aria-hidden="true" className="size-3.5" />
      Manage storage
    </Button>
  </footer>
);

// -- Exports ------------------------------------------------------------------

export { LibraryFooter };
