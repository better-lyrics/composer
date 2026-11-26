import { Button } from "@/ui/button";
import { Scroll } from "@/ui/scroll";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

// -- Constants ----------------------------------------------------------------

const COPIED_RESET_MS = 1800;

// -- Component ----------------------------------------------------------------

interface CopyableCommandProps {
  command: string;
  copyLabel: string;
}

const CopyableCommand: React.FC<CopyableCommandProps> = ({ command, copyLabel }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (err: unknown) {
      console.error("clipboard write failed", err);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-composer-bg-dark border border-(--edge)">
      <Scroll className="flex-1 min-w-0" autoHide="leave">
        <code className="block font-mono text-[11px] text-composer-text-secondary select-text whitespace-pre">
          {command}
        </code>
      </Scroll>
      <Button variant="secondary" size="sm" hasIcon onClick={copy} aria-label={copyLabel}>
        {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { CopyableCommand };
