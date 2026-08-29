import type { LanguageReviewItem, LanguageReviewTrack } from "@/domain/language/review";
import { languageLineAnchorId } from "@/domain/language/review";
import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-react";

interface LanguageReviewSummaryProps {
  items: LanguageReviewItem[];
  languageNames: ReadonlyMap<string, string>;
}

const LanguageReviewSummary: React.FC<LanguageReviewSummaryProps> = ({ items, languageNames }) => {
  if (items.length === 0) return null;

  const trackName = (track: LanguageReviewTrack) =>
    track.kind === "transliteration" ? "Transliteration" : (languageNames.get(track.language) ?? track.language);

  return (
    <aside
      aria-label="Language content needing review"
      className="overflow-hidden rounded-lg border border-amber-400/35 bg-amber-400/[0.06]"
      data-language-review-summary
    >
      <div className="flex items-start gap-3 border-b border-amber-400/20 px-4 py-3">
        <span className="mt-0.5 rounded-md bg-amber-400/15 p-1.5 text-amber-300 ring-1 ring-inset ring-amber-400/25">
          <IconAlertTriangle aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-amber-200">
            {items.length} {items.length === 1 ? "line needs" : "lines need"} review
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-composer-text-secondary">
            The source lyrics changed. Check these alternate-language fields before exporting.
          </p>
        </div>
      </div>
      <div className="grid max-h-44 gap-px overflow-y-auto bg-amber-400/15 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.lineId}
            type="button"
            onClick={() =>
              document
                .getElementById(languageLineAnchorId(item.lineId))
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="group flex min-w-0 cursor-pointer items-center gap-2 bg-composer-bg-elevated px-3 py-2.5 text-left transition-colors hover:bg-amber-400/[0.07]"
          >
            <span className="shrink-0 rounded bg-amber-400/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-300">
              Line {item.lineIndex + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-composer-text">{item.text}</span>
              <span className="block truncate text-[11px] text-composer-text-muted">
                {item.tracks.map(trackName).join(" · ")}
              </span>
            </span>
            <IconChevronRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-composer-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300"
            />
          </button>
        ))}
      </div>
    </aside>
  );
};

export { LanguageReviewSummary };
