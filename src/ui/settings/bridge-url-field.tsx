import { useState } from "react";
import { DEFAULT_BRIDGE_URL } from "@/utils/composer-bridge-api";

// -- Interfaces ---------------------------------------------------------------

interface BridgeUrlFieldProps {
  initialUrl: string;
  onCommit: (url: string) => void;
  onReset: () => void;
}

// -- Component ----------------------------------------------------------------

const BridgeUrlField: React.FC<BridgeUrlFieldProps> = ({ initialUrl, onCommit, onReset }) => {
  const [draftUrl, setDraftUrl] = useState(initialUrl);
  const canReset = initialUrl !== DEFAULT_BRIDGE_URL;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-composer-text-muted">Bridge URL</span>
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onBlur={() => onCommit(draftUrl)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          spellCheck={false}
          className="flex-1 h-7 px-2 text-xs font-mono rounded bg-composer-bg text-composer-text border border-composer-border focus:outline-none focus:border-composer-accent select-text"
          placeholder={DEFAULT_BRIDGE_URL}
        />
        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-composer-accent-text hover:text-composer-accent cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </label>
  );
};

// -- Exports ------------------------------------------------------------------

export { BridgeUrlField };
