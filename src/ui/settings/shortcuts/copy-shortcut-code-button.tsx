import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { encodeShortcutCode } from "@/stores/shortcut-code";
import { Button } from "@/ui/button";
import { HEADER_ACTION_BUTTON } from "@/ui/settings/preset-card-styles";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

// -- Constants -----------------------------------------------------------------

const LOG_PREFIX = "[Shortcut presets]";
const COPIED_DURATION_MS = 1200;

// -- Components ----------------------------------------------------------------

const CopyShortcutCodeButton: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    const { preset, overrides } = useShortcutBindingsStore.getState();
    try {
      await navigator.clipboard.writeText(encodeShortcutCode(preset, overrides));
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_DURATION_MS);
    } catch (copyError) {
      console.error(LOG_PREFIX, "could not copy the shortcuts code", copyError);
      setError(copyError instanceof Error ? copyError.message : "Clipboard unavailable");
    }
  };

  return (
    <span className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-composer-error select-text cursor-text">
          {error}
        </span>
      )}
      <Button size="sm" variant="ghost" hasIcon className={HEADER_ACTION_BUTTON} onClick={() => void handleCopy()}>
        {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
        {copied ? "Copied" : "Copy my code"}
      </Button>
    </span>
  );
};

// -- Exports -------------------------------------------------------------------

export { CopyShortcutCodeButton };
