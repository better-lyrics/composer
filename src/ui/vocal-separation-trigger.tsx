import { DETECTING_VOCAL_ONSETS } from "@/ui/vocal-onset-status-copy";
import { IconChevronUp, IconLoader2 } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

interface StemPickLabelProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string;
  label: string;
  busy: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

// -- Components ---------------------------------------------------------------

const StemPickLabel: React.FC<StemPickLabelProps> = ({ name, label, busy, ...props }) => (
  <button
    type="button"
    aria-label={name}
    title="Vocal separation"
    {...props}
    className="group flex flex-col items-start shrink-0 w-26 -ml-2 px-2 py-1 rounded-lg text-left leading-[1.15] cursor-pointer select-none transition-colors hover:bg-(--layer-1) aria-expanded:bg-(--layer-1)"
  >
    <span className="flex items-center gap-[3px] text-[11.5px] text-(--muted)">
      Stem
      <IconChevronUp
        aria-hidden="true"
        className="size-3 transition-[rotate] duration-150 group-aria-expanded:rotate-180 motion-reduce:transition-none"
      />
    </span>
    <span className="flex items-center gap-1 w-full text-[13px] tabular-nums whitespace-nowrap text-composer-text">
      {busy && (
        <IconLoader2
          aria-hidden="true"
          className="size-3.5 text-composer-accent-text animate-spin motion-reduce:animate-none"
        />
      )}
      {label}
    </span>
  </button>
);

const VocalOnsetStatusAnnouncer: React.FC<{ detecting: boolean }> = ({ detecting }) => (
  <span role="status" aria-atomic="true" className="sr-only">
    {detecting ? DETECTING_VOCAL_ONSETS : ""}
  </span>
);

// -- Exports ------------------------------------------------------------------

export { StemPickLabel, VocalOnsetStatusAnnouncer };
