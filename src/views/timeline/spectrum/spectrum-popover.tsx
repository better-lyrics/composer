import { SPECTRUM_CONTRAST, isDefaultSpectrumLook, spectrumLookDefaults } from "@/domain/spectrum/settings";
import { useSeparationStore } from "@/stores/separation";
import { useSettingsStore } from "@/stores/settings";
import { settingEntry } from "@/stores/settings-catalog";
import { keepSpaceForFocusedControl } from "@/ui/keep-space-for-focused-control";
import { SegmentedControl } from "@/ui/segmented-control";
import { PopFieldLabel } from "@/ui/pop-layout";
import { Slider } from "@/ui/slider";
import { SPECTRUM_SOURCE_OPTIONS } from "@/ui/spectrum-options";
import { PaletteThumbnails } from "@/views/timeline/spectrum/palette-thumbnails";
import { SpectrumAdvanced } from "@/views/timeline/spectrum/spectrum-advanced";
import { SpectrumStatusLine } from "@/views/timeline/spectrum/spectrum-status-line";
import { useId } from "react";

// -- Components ----------------------------------------------------------------

const ResetLook: React.FC = () => {
  const isDefault = useSettingsStore(isDefaultSpectrumLook);
  if (isDefault) return null;
  return (
    <button
      type="button"
      onClick={() => useSettingsStore.setState(spectrumLookDefaults())}
      className="h-7 -mt-1 -mr-1.5 px-2 rounded-lg text-[12.5px] font-medium text-composer-accent-text cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--color-composer-accent)_10%,transparent)] active:scale-[0.96]"
    >
      Reset
    </button>
  );
};

const SourceField: React.FC = () => {
  const id = useId();
  const source = useSettingsStore((s) => s.spectrumSource);
  const hasVocals = useSeparationStore((s) => s.stemUrls.vocals !== undefined);
  const label = settingEntry("spectrumSource").label;
  return (
    <section className="grid gap-2">
      <PopFieldLabel id={id}>{label}</PopFieldLabel>
      <SegmentedControl
        aria-label={label}
        value={hasVocals ? source : "mix"}
        options={SPECTRUM_SOURCE_OPTIONS.map((option) => ({
          ...option,
          disabled: option.value === "vocals" && !hasVocals,
        }))}
        onChange={(next) => useSettingsStore.getState().set("spectrumSource", next)}
        className="w-full [&>button]:flex-1"
      />
      {!hasVocals && (
        <p className="text-xs leading-[1.45] text-(--muted) text-pretty">
          Separate vocals in the Stem menu to use them here.
        </p>
      )}
    </section>
  );
};

const PaletteField: React.FC = () => {
  const id = useId();
  const palette = useSettingsStore((s) => s.spectrumPalette);
  return (
    <section className="grid gap-2">
      <PopFieldLabel id={id}>{settingEntry("spectrumPalette").label}</PopFieldLabel>
      <PaletteThumbnails labelledBy={id} />
      {palette === "phase" && (
        <p className="text-xs leading-[1.45] text-(--muted) text-pretty">
          Red shows where a sung note bends, like a vowel change or vibrato.
        </p>
      )}
    </section>
  );
};

const ContrastField: React.FC = () => {
  const id = useId();
  const contrast = useSettingsStore((s) => s.spectrumContrast);
  const label = settingEntry("spectrumContrast").label;
  return (
    <section className="grid gap-2">
      <PopFieldLabel id={id} value={`${contrast} dB`}>
        {label}
      </PopFieldLabel>
      <Slider
        aria-label={label}
        value={contrast}
        min={SPECTRUM_CONTRAST.min}
        max={SPECTRUM_CONTRAST.max}
        step={1}
        onChange={(next) => useSettingsStore.getState().set("spectrumContrast", next)}
      />
      <div aria-hidden="true" className="flex justify-between text-[11.5px] text-composer-text-faint">
        <span>More detail</span>
        <span>Less noise</span>
      </div>
    </section>
  );
};

const SpectrumPopoverBody: React.FC = () => (
  <div
    onKeyDown={keepSpaceForFocusedControl}
    className="grid gap-4 w-90 p-3.5 text-[13px] text-(--label) overscroll-contain"
  >
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <div className="grid gap-0.5 min-w-0">
        <div className="text-sm font-semibold text-composer-text">Spectrum</div>
        <SpectrumStatusLine />
      </div>
      <ResetLook />
    </header>
    <SourceField />
    <PaletteField />
    <ContrastField />
    <SpectrumAdvanced />
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SpectrumPopoverBody };
