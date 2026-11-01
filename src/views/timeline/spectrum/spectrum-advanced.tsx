import type { SettingsState } from "@/stores/settings";
import { useSettingsStore } from "@/stores/settings";
import { isSettingVisible, settingEntry } from "@/stores/settings-catalog";
import { SegmentedControl } from "@/ui/segmented-control";
import {
  ANALYSIS_WINDOW_OPTIONS,
  FREQUENCY_SCALE_OPTIONS,
  PHASE_COLOUR_OPTIONS,
  SPECTRUM_TOP_OPTIONS,
} from "@/ui/spectrum-options";
import { cn } from "@/utils/cn";
import { spectrumSession, useSpectrumStatus } from "@/views/timeline/spectrum/spectrum-session";
import { IconChevronDown } from "@tabler/icons-react";
import { useId, useState } from "react";

// -- Types ---------------------------------------------------------------------

type AdvancedKey = "spectrumScale" | "spectrumTop" | "spectrumWindow" | "spectrumPhase";

interface AdvancedRowProps<Key extends AdvancedKey> {
  settingKey: Key;
  sub?: string;
  options: readonly { value: SettingsState[Key]; label: string }[];
}

// -- Components ----------------------------------------------------------------

function AdvancedRow<Key extends AdvancedKey>({ settingKey, sub, options }: AdvancedRowProps<Key>) {
  const value = useSettingsStore((s) => s[settingKey]);
  const label = settingEntry(settingKey).label;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_160px] items-center gap-x-3 min-h-10">
      <div className="grid gap-0.5 whitespace-nowrap text-[12.5px] font-medium text-(--label)">
        {label}
        {sub && <span className="text-[11.5px] font-normal leading-[1.35] text-(--muted)">{sub}</span>}
      </div>
      <SegmentedControl
        aria-label={label}
        size="sm"
        value={value}
        options={options}
        onChange={(next) => useSettingsStore.getState().set(settingKey, next)}
        className="w-full [&>button]:flex-1"
      />
    </div>
  );
}

const TechnicalReadout: React.FC = () => {
  const { status, fftSize } = useSpectrumStatus();
  if (status !== "ready" && status !== "analysing") return null;
  const { sampleRate, hop } = spectrumSession;
  return (
    <p className="pt-2 mt-1 shadow-[inset_0_1px_0_var(--divider)] font-mono text-[11px] font-medium tabular-nums text-composer-text-faint select-text cursor-text">
      {(sampleRate / 1000).toFixed(1)} kHz ・ FFT {fftSize} ・ hop {Math.round((hop / sampleRate) * 10000) / 10} ms
    </p>
  );
};

const SpectrumAdvanced: React.FC = () => {
  const [open, setOpen] = useState(false);
  const showPhase = useSettingsStore((s) => isSettingVisible("spectrumPhase", s));
  const bodyId = useId();
  return (
    <div className="-mx-3.5 -mb-3.5 px-3.5 py-1.5 shadow-[inset_0_1px_0_var(--divider)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((was) => !was)}
        className="flex items-center justify-between w-[calc(100%+16px)] h-9 -mx-2 px-2 rounded-lg text-[12.5px] font-medium text-(--label) cursor-pointer select-none transition-colors duration-150 hover:bg-(--layer-1) hover:text-composer-text"
      >
        Advanced
        <IconChevronDown
          aria-hidden="true"
          className={cn("size-[15px] text-(--muted) transition-[rotate] duration-200", open && "rotate-180")}
        />
      </button>
      <div
        id={bodyId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-opacity",
          open ? "grid-rows-[1fr] opacity-100 pb-2" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-1.5 pt-2.5">
            <AdvancedRow settingKey="spectrumScale" options={FREQUENCY_SCALE_OPTIONS} />
            <AdvancedRow settingKey="spectrumTop" options={SPECTRUM_TOP_OPTIONS} />
            <AdvancedRow
              settingKey="spectrumWindow"
              sub="Auto: 1024 vocals, 2048 mix"
              options={ANALYSIS_WINDOW_OPTIONS}
            />
            {showPhase && (
              <AdvancedRow settingKey="spectrumPhase" sub="What red shows" options={PHASE_COLOUR_OPTIONS} />
            )}
            <TechnicalReadout />
          </div>
        </div>
      </div>
    </div>
  );
};

// -- Exports -------------------------------------------------------------------

export { SpectrumAdvanced };
