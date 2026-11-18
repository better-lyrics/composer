import { Button } from "@/ui/button";
import { Tooltip } from "@/ui/tooltip";
import { IconMicrophone } from "@tabler/icons-react";

// -- Interfaces ----------------------------------------------------------------

interface ExtractBackgroundButtonProps {
  canExtract: boolean;
  onExtract: () => void;
}

// -- Components ----------------------------------------------------------------

const ExtractBackgroundButton: React.FC<ExtractBackgroundButtonProps> = ({ canExtract, onExtract }) => (
  <Tooltip content="No parentheses to extract" disabled={canExtract}>
    <span className="inline-flex rounded-xl" tabIndex={canExtract ? undefined : 0}>
      <Button hasIcon size="lg" data-guide-spot="extractAll" onClick={onExtract} disabled={!canExtract}>
        <IconMicrophone className="size-4" />
        Extract background vocals
      </Button>
    </span>
  </Tooltip>
);

// -- Exports -------------------------------------------------------------------

export { ExtractBackgroundButton };
