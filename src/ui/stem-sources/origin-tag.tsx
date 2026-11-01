import type { StemOrigin } from "@/domain/stems/stem-slot";

// -- Constants ----------------------------------------------------------------

const ORIGIN_LABELS: Record<StemOrigin, string> = {
  imported: "Imported",
  separated: "Separated",
};

// -- Component ----------------------------------------------------------------

const OriginTag: React.FC<{ origin: StemOrigin }> = ({ origin }) => (
  <span className="inline-flex items-center h-4.5 ml-2 px-1.5 rounded-[5px] align-[1px] text-[11px] font-medium text-(--label) bg-(--layer-2)">
    {ORIGIN_LABELS[origin]}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { OriginTag };
