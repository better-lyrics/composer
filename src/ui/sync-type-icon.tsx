import type { SyncType } from "@/domain/lyrics-search/sync-type";

// -- Types --------------------------------------------------------------------

interface SyncTypeIconProps {
  syncType: SyncType;
  size?: number;
  className?: string;
}

interface SyncVariant {
  label: string;
  textClass: string;
  bgClass: string;
  colorClasses: string;
  fillStates: [number, number, number, number];
}

// -- Constants ----------------------------------------------------------------

const SYNC_TYPE_VARIANTS: Record<SyncType, SyncVariant> = {
  syllable: {
    label: "Syllable",
    textClass: "text-[#fcd34d]",
    bgClass: "bg-[color-mix(in_srgb,var(--color-composer-bg)_75%,#fcd34d_25%)]",
    colorClasses: "text-[#fcd34d] bg-[#fcd34d]/15",
    fillStates: [1, 0.5, 0.5, 0.5],
  },
  word: {
    label: "Word",
    textClass: "text-[#93c5fd]",
    bgClass: "bg-[color-mix(in_srgb,var(--color-composer-bg)_75%,#93c5fd_25%)]",
    colorClasses: "text-[#93c5fd] bg-[#93c5fd]/15",
    fillStates: [1, 1, 0.5, 0.5],
  },
  line: {
    label: "Line",
    textClass: "text-[#86efac]",
    bgClass: "bg-[color-mix(in_srgb,var(--color-composer-bg)_75%,#86efac_25%)]",
    colorClasses: "text-[#86efac] bg-[#86efac]/15",
    fillStates: [1, 1, 1, 0.5],
  },
  // Intentional exception to the icon color rule: all four rects share the same
  // fillOpacity, so there are no overlapping paths with differing opacities to clip.
  unsynced: {
    label: "Unsynced",
    textClass: "text-white/60",
    bgClass: "bg-composer-bg/85",
    colorClasses: "text-white/50 bg-white/5",
    fillStates: [0.5, 0.5, 0.5, 0.5],
  },
};

// -- Component ----------------------------------------------------------------

const SyncTypeIcon: React.FC<SyncTypeIconProps> = ({ syncType, size = 11, className }) => {
  const [a, b, c, d] = SYNC_TYPE_VARIANTS[syncType].fillStates;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M0 335C0 289.75 0 267.12 14.06 253.06C28.12 239 50.75 239 96 239H213C243.17 239 258.26 239 267.63 248.37C277 257.75 277 272.83 277 303V408C277 438.17 277 453.26 267.63 462.63C258.26 472 243.17 472 213 472H96C50.75 472 28.12 472 14.06 457.94C0 443.88 0 421.26 0 376V335Z"
        fillOpacity={a}
      />
      <path
        d="M337 304C337 273.83 337 258.75 346.37 249.37C355.75 240 370.83 240 401 240H460C505.26 240 527.88 240 541.94 254.06C556 268.12 556 290.75 556 336V377C556 422.26 556 444.88 541.94 458.94C527.88 473 505.26 473 460 473H401C370.83 473 355.75 473 346.37 463.63C337 454.26 337 439.17 337 409V304Z"
        fillOpacity={b}
      />
      <rect x="636" y="239" width="389.98" height="233.27" rx="48" fillOpacity={c} />
      <rect y="552.27" width="1024" height="233" rx="48" fillOpacity={d} />
    </svg>
  );
};

// -- Exports ------------------------------------------------------------------

export { SyncTypeIcon, SYNC_TYPE_VARIANTS };
export type { SyncTypeIconProps };
