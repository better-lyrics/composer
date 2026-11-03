import { cn } from "@/utils/cn";
import { IconMusic } from "@tabler/icons-react";
import { useState } from "react";

// -- Types --------------------------------------------------------------------

type ProjectArtSize = "xs" | "sm" | "md" | "row" | "dialog" | "hero" | "card";

interface ProjectArtProps {
  src?: string;
  size: ProjectArtSize;
  className?: string;
  rejectNaturalWidth?: number;
}

// -- Constants ----------------------------------------------------------------

const FRAME_SIZES: Record<ProjectArtSize, string> = {
  xs: "size-7 rounded-md",
  sm: "size-[30px] rounded-[7px]",
  md: "size-9 rounded-md",
  row: "size-10 rounded-md",
  dialog: "size-12 rounded-lg",
  hero: "size-30 rounded-[10px] shadow-[0_12px_32px_-8px_rgb(0_0_0/0.5)]",
  card: "w-full aspect-square rounded-[10px]",
};

const LIGHT_STROKE_SIZES: ReadonlySet<ProjectArtSize> = new Set(["hero", "card"]);

const ICON_SIZES: Record<ProjectArtSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  row: "size-[18px]",
  dialog: "size-[22px]",
  hero: "size-[54px]",
  card: "size-[30%]",
};

// -- Component ----------------------------------------------------------------

const ProjectArt: React.FC<ProjectArtProps> = ({ src, size, className, rejectNaturalWidth }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const shownSrc = src && src !== failedSrc ? src : undefined;
  return (
    <span
      className={cn(
        "relative grid place-items-center shrink-0 overflow-hidden bg-(--layer-2)",
        "after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--edge)] after:pointer-events-none",
        FRAME_SIZES[size],
        className,
      )}
    >
      {shownSrc ? (
        <img
          src={shownSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(shownSrc)}
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth === rejectNaturalWidth) setFailedSrc(shownSrc);
          }}
          className="size-full object-cover"
        />
      ) : (
        <IconMusic
          aria-hidden="true"
          stroke={LIGHT_STROKE_SIZES.has(size) ? 1.5 : 2}
          className={cn("text-composer-text opacity-50", ICON_SIZES[size])}
        />
      )}
    </span>
  );
};

// -- Exports ------------------------------------------------------------------

export { ProjectArt };
export type { ProjectArtSize };
