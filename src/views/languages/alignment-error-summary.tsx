import type { LanguageAlignmentErrorItem } from "@/domain/language/alignment-errors";
import { languageLineAnchorId } from "@/domain/language/review";
import { IconAlertCircle, IconChevronRight } from "@tabler/icons-react";

interface LanguageAlignmentErrorSummaryProps {
  items: LanguageAlignmentErrorItem[];
}

function fieldName(field: LanguageAlignmentErrorItem["errors"][number]["field"]): string {
  return field === "transliteration" ? "Transliteration" : "Background transliteration";
}

const LanguageAlignmentErrorSummary: React.FC<LanguageAlignmentErrorSummaryProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Language alignment errors"
      className="overflow-hidden rounded-lg border border-red-400/35 bg-red-400/[0.06]"
      data-language-alignment-error-summary
    >
      <div className="flex items-start gap-3 border-b border-red-400/20 px-4 py-3">
        <span className="mt-0.5 rounded-md bg-red-400/15 p-1.5 text-red-300 ring-1 ring-inset ring-red-400/25">
          <IconAlertCircle aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-red-200">
            {items.length === 1 ? "1 line has an alignment error" : `${items.length} lines have alignment errors`}
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-composer-text-secondary">
            Correct incomplete transliteration text first, then use Align timing to confirm its timing map.
          </p>
        </div>
      </div>
      <div className="grid max-h-44 gap-px overflow-y-auto bg-red-400/15 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.lineId}
            type="button"
            onClick={() =>
              document
                .getElementById(languageLineAnchorId(item.lineId))
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="group flex min-w-0 cursor-pointer items-center gap-2 bg-composer-bg-elevated px-3 py-2.5 text-left transition-colors hover:bg-red-400/[0.07]"
          >
            <span className="shrink-0 rounded bg-red-400/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-red-300">
              Line {item.lineIndex + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-composer-text">{item.text}</span>
              <span className="block truncate text-[11px] text-composer-text-muted">
                {item.errors.map((error) => fieldName(error.field)).join(" · ")}
              </span>
            </span>
            <IconChevronRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-composer-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-red-300"
            />
          </button>
        ))}
      </div>
    </aside>
  );
};

export { LanguageAlignmentErrorSummary };
