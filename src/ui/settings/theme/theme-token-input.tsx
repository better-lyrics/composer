import { isHexColor } from "@/domain/theme/color";
import type { TokenKey } from "@/domain/theme/model";
import { useState } from "react";

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
    <label className="flex items-center gap-2.5 select-none" data-token-key={tokenKey}>
      <span className="flex-1 min-w-0 text-[13.5px] font-medium text-composer-text">{label}</span>
      <span className="flex items-center gap-2.5">
        <span
          className="relative size-7.5 shrink-0 rounded-lg shadow-[inset_0_0_0_1px_var(--edge-strong)] has-[:focus-visible]:shadow-[inset_0_0_0_1px_var(--edge-strong),0_0_0_2px_var(--pop),0_0_0_3.5px_var(--ink)]"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            className="absolute inset-0 size-full opacity-0 cursor-pointer"
            value={toColorInputValue(value)}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`${label} color`}
          />
        </span>
        <input
          type="text"
          className="w-46 h-[30px] px-2 rounded-lg bg-(--well) shadow-(--well-edge) font-mono text-xs font-medium text-(--label) outline-none cursor-text select-text focus:shadow-[var(--well-edge),inset_0_0_0_1px_var(--lit-ring)]"
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
