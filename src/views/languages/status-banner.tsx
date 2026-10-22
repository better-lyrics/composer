import { languageLineAnchorId } from "@/domain/language/review";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";

// -- Interfaces ---------------------------------------------------------------

interface LanguageStatusBannerItem {
  lineId: string;
  lineIndex: number;
  detail: string;
}

interface LanguageStatusBannerProps {
  tone: "warning" | "error";
  title: string;
  helper: string;
  items: LanguageStatusBannerItem[];
  "aria-label": string;
}

// -- Constants ----------------------------------------------------------------

const MAX_VISIBLE_LINES = 4;

const TONES = {
  warning: {
    container: "border-composer-warning/25 bg-composer-warning/8",
    title: "text-composer-warning",
    icon: IconAlertTriangle,
  },
  error: {
    container: "border-composer-error/30 bg-composer-error/8",
    title: "text-composer-negative",
    icon: IconAlertCircle,
  },
} as const;

// -- Helpers ------------------------------------------------------------------

function scrollToLanguageLine(lineId: string) {
  document.getElementById(languageLineAnchorId(lineId))?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function lineButtons(items: LanguageStatusBannerItem[]) {
  const visible = items.slice(0, MAX_VISIBLE_LINES).map((item) => ({ item, label: `Line ${item.lineIndex + 1}` }));
  const firstHidden = items[MAX_VISIBLE_LINES];
  if (!firstHidden) return visible;
  return [...visible, { item: firstHidden, label: `+${items.length - MAX_VISIBLE_LINES}` }];
}

// -- Component ----------------------------------------------------------------

const LanguageStatusBanner: React.FC<LanguageStatusBannerProps> = ({
  tone,
  title,
  helper,
  items,
  "aria-label": ariaLabel,
}) => {
  if (items.length === 0) return null;
  const { container, title: titleClass, icon: ToneIcon } = TONES[tone];

  return (
    <aside
      aria-label={ariaLabel}
      data-language-status={tone}
      className={cn("flex items-center gap-3 h-9 rounded-xl border pl-3 pr-1 text-[13px]", container)}
    >
      <span className={cn("flex shrink-0 items-center gap-2 font-medium select-none", titleClass)}>
        <ToneIcon aria-hidden="true" className="size-4" />
        {title}
      </span>
      <span className="min-w-0 truncate text-(--muted) select-text">{helper}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1 select-none">
        {lineButtons(items).map(({ item, label }) => (
          <Button
            key={item.lineId}
            variant="ghost"
            size="sm"
            aria-label={`Go to line ${item.lineIndex + 1}: ${item.detail}`}
            onClick={() => scrollToLanguageLine(item.lineId)}
            className="h-7 px-2 font-mono text-xs tabular-nums"
          >
            {label}
          </Button>
        ))}
      </span>
    </aside>
  );
};

// -- Exports ------------------------------------------------------------------

export { LanguageStatusBanner };
