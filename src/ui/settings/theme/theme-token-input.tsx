import { useState } from "react";
import { isHexColor } from "@/domain/theme/color";
import type { TokenKey } from "@/domain/theme/model";
import { cn } from "@/utils/cn";

// -- Interfaces ----------------------------------------------------------------

interface ThemeTokenInputProps {
  tokenKey: TokenKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// -- Helpers -------------------------------------------------------------------

function toColorInputValue(value: string): string {
  return isHexColor(value) ? value : "#000000";
}

// -- Components ----------------------------------------------------------------

const ThemeTokenInput: React.FC<ThemeTokenInputProps> = ({ tokenKey, label, value, onChange }) => {
  // React's documented "adjust state while a prop changes during render" pattern:
  // prevValue snapshots the prop to detect external edits; draft is the controlled
  // input value, edited locally and committed on blur (so it is read in render, not
  // handler-only). Neither is hoistable derived state.
  // react-doctor-disable-next-line react-doctor/no-derived-useState, react-doctor/rerender-state-only-in-handlers -- intentional controlled-input draft, see note above
  const [prevValue, setPrevValue] = useState(value);
  // react-doctor-disable-next-line react-doctor/no-derived-useState -- snapshot for the prop-change check below
  const [draft, setDraft] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  const commitHex = (raw: string) => {
    const trimmed = raw.trim();
    if (isHexColor(trimmed)) {
      onChange(trimmed);
    } else {
      setDraft(value);
    }
  };

  return (
    <label className="flex items-center gap-3 select-none" data-token-key={tokenKey}>
      <span className="flex-1 min-w-0 text-sm text-composer-text">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          className="theme-swatch-input size-6.5 cursor-pointer rounded-md border border-composer-border"
          value={toColorInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} color`}
        />
        <input
          type="text"
          className={cn(
            "w-20 bg-transparent text-xs font-mono text-composer-text-muted outline-none cursor-text select-text",
          )}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commitHex(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitHex(event.currentTarget.value);
          }}
          aria-label={`${label} hex`}
          spellCheck={false}
        />
      </span>
    </label>
  );
};

// -- Exports -------------------------------------------------------------------

export { ThemeTokenInput };
