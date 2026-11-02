import { cn } from "@/utils/cn";

// -- Types ---------------------------------------------------------------------

interface BetterLyricsMarkProps {
  className?: string;
}

// -- Component -----------------------------------------------------------------

const BetterLyricsMark: React.FC<BetterLyricsMarkProps> = ({ className }) => (
  <img src="/logo.svg" alt="" className={cn("size-[18px] shrink-0", className)} />
);

// -- Exports -------------------------------------------------------------------

export { BetterLyricsMark };
