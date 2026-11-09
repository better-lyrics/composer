import type { GuideTierId, TierState } from "@/domain/guide/model";
import { GUIDE_TIER_NAMES } from "@/guide/catalog/types";
import { cn } from "@/utils/cn";
import { type Icon, IconCrown, IconLock, IconStar, IconStars } from "@tabler/icons-react";

// -- Types --------------------------------------------------------------------

type MedalSize = "sm" | "md" | "lg";

interface MedalProps {
  tier: GuideTierId;
  state: TierState;
  size?: MedalSize;
  pressed?: boolean;
}

// -- Constants ----------------------------------------------------------------

const TIER_ICONS: Record<GuideTierId, Icon> = { basics: IconStar, further: IconStars, pro: IconCrown };

const MEDAL_SIZES: Record<MedalSize, string> = {
  sm: "w-7 [--key-height:30px] [--key-depth:2px] [--key-radius:999px] [&_svg]:size-3.5",
  md: "w-9 [--key-height:39px] [--key-depth:3px] [--key-radius:999px] [&_svg]:size-4",
  lg: "w-16 [--key-height:68px] [--key-depth:4px] [--key-radius:999px] [&_svg]:size-7",
};

const STATE_WORDS: Record<TierState, string> = { earned: "earned", open: "in progress", locked: "locked" };

// -- Component ----------------------------------------------------------------

// A span, never a button: medals sit inside tier tiles, which are buttons themselves.
const Medal: React.FC<MedalProps> = ({ tier, state, size = "md", pressed }) => {
  const TierIcon = state === "locked" ? IconLock : TIER_ICONS[tier];
  return (
    <span
      role="img"
      aria-label={`${GUIDE_TIER_NAMES[tier]}, ${STATE_WORDS[state]}`}
      data-lit={state === "earned" ? "" : undefined}
      data-pressed={pressed ? "" : undefined}
      data-unavailable={state === "locked" ? "" : undefined}
      className={cn("key pointer-events-none shrink-0", MEDAL_SIZES[size])}
    >
      <span className="key-cap">
        <TierIcon
          stroke={state === "earned" ? 2.25 : 1.75}
          className={state === "earned" ? "text-composer-accent-text" : "text-(--muted)"}
        />
      </span>
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { Medal };
