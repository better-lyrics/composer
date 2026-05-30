import type { SyncType } from "@/domain/lyrics-search/sync-type";
import { Tooltip } from "@/ui/tooltip";
import { cn } from "@/utils/cn";

// -- Types --------------------------------------------------------------------

interface SyncTypeBadgeProps {
  syncType: SyncType;
  sourceLabel: string;
}

interface SyncVariant {
  label: string;
  colorClasses: string;
  fillStates: [number, number, number, number];
}

// -- Constants ----------------------------------------------------------------

const SYNC_VARIANTS: Record<SyncType, SyncVariant> = {
  syllable: {
    label: "Syllable",
    colorClasses: "text-[#fcd34d] bg-[#fcd34d]/15",
    fillStates: [1, 0.5, 0.5, 0.5],
  },
  word: {
    label: "Word",
    colorClasses: "text-[#93c5fd] bg-[#93c5fd]/15",
    fillStates: [1, 1, 0.5, 0.5],
  },
  line: {
    label: "Line",
    colorClasses: "text-[#86efac] bg-[#86efac]/15",
    fillStates: [1, 1, 1, 0.5],
  },
  unsynced: {
    label: "Unsynced",
    colorClasses: "text-white/50 bg-white/5",
    fillStates: [0.5, 0.5, 0.5, 0.5],
  },
};

// -- Sub-components -----------------------------------------------------------

interface SyncIconProps {
  fillStates: [number, number, number, number];
}

const SyncIcon: React.FC<SyncIconProps> = ({ fillStates }) => {
  const [a, b, c, d] = fillStates;
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M0 335C0 289.745 0 267.118 14.0589 253.059C28.1177 239 50.7452 239 96 239H213C243.17 239 258.255 239 267.627 248.373C277 257.745 277 272.83 277 303V408C277 438.17 277 453.255 267.627 462.627C258.255 472 243.17 472 213 472H96C50.7452 472 28.1177 472 14.0589 457.941C0 443.882 0 421.255 0 376V335Z"
        fillOpacity={a}
      />
      <path
        d="M337 304C337 273.83 337 258.745 346.373 249.373C355.745 240 370.83 240 401 240H460C505.255 240 527.882 240 541.941 254.059C556 268.118 556 290.745 556 336V377C556 422.255 556 444.882 541.941 458.941C527.882 473 505.255 473 460 473H401C370.83 473 355.745 473 346.373 463.627C337 454.255 337 439.17 337 409V304Z"
        fillOpacity={b}
      />
      <rect x="636" y="239" width="389.981" height="233.271" rx="48" fillOpacity={c} />
      <rect y="552.271" width="1024" height="233" rx="48" fillOpacity={d} />
    </svg>
  );
};

// -- Component ----------------------------------------------------------------

const SyncTypeBadge: React.FC<SyncTypeBadgeProps> = ({ syncType, sourceLabel }) => {
  const variant = SYNC_VARIANTS[syncType];
  return (
    <Tooltip content={`${variant.label} sync`}>
      <span
        data-sync-type={syncType}
        className={cn(
          "inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide cursor-help shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]",
          variant.colorClasses,
        )}
      >
        <SyncIcon fillStates={variant.fillStates} />
        <span>{sourceLabel}</span>
        <span className="sr-only">{variant.label}</span>
      </span>
    </Tooltip>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncTypeBadge };
export type { SyncTypeBadgeProps };
