import { useAudioStore } from "@/stores/audio";
import { useSeparationStore } from "@/stores/separation";
import { Key } from "@/ui/key";
import { STEMS, STEM_ICONS, STEM_LABELS } from "@/ui/stem-labels";
import { VocalSeparationDropdown } from "@/ui/vocal-separation-dropdown";
import { useState } from "react";

// -- Component ----------------------------------------------------------------

const StemModule: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [moduleElement, setModuleElement] = useState<HTMLDivElement | null>(null);
  const hasSource = useAudioStore((state) => state.source !== null);
  const hostingConfigured = useSeparationStore((state) => state.hostingConfigured);
  const currentStem = useSeparationStore((state) => state.currentStem);
  const availableStems = useSeparationStore((state) => state.availableStems);
  const selectStem = useSeparationStore((state) => state.selectStem);

  if (!hostingConfigured || !hasSource) return null;

  return (
    <div ref={setModuleElement} className="flex items-center gap-2">
      <VocalSeparationDropdown open={open} onOpenChange={setOpen} positionAnchor={moduleElement} />
      <div role="group" aria-label="Playback source" className="flex gap-1">
        {STEMS.map((stem) => {
          const Icon = STEM_ICONS[stem];
          const available = availableStems.includes(stem);
          return (
            <Key
              key={stem}
              aria-pressed={currentStem === stem}
              aria-label={available ? STEM_LABELS[stem] : `${STEM_LABELS[stem]}, separate vocals first`}
              title={STEM_LABELS[stem]}
              data-unavailable={available ? undefined : ""}
              onClick={() => (available ? selectStem(stem) : setOpen(true))}
              className="w-9"
            >
              <Icon aria-hidden="true" className="size-[15px]" />
            </Key>
          );
        })}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { StemModule };
