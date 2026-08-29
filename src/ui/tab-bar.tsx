import { getLanguageReviewItems } from "@/domain/language/review";
import { useProjectStore } from "@/stores/project";
import type { SimpleTab } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { IconAlertTriangle } from "@tabler/icons-react";

const TABS: { id: SimpleTab; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "edit", label: "Edit" },
  { id: "languages", label: "Languages" },
  { id: "sync", label: "Sync" },
  { id: "timeline", label: "Timeline" },
  { id: "preview", label: "Preview" },
  { id: "export", label: "Export" },
];

const TabBar: React.FC = () => {
  const activeTab = useProjectStore((s) => s.activeTab);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const lines = useProjectStore((s) => s.lines);
  const showHints = useSettingsStore((s) => s.showShortcutHints);
  const languageReviewCount = getLanguageReviewItems(lines).length;

  return (
    <nav data-tour="tab-bar" className="flex border-b border-composer-border select-none">
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const showLanguageWarning = tab.id === "languages" && languageReviewCount > 0;
        return (
          <button
            key={tab.id}
            type="button"
            data-tour={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`cursor-pointer px-4 py-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-b-2 border-composer-accent text-composer-text"
                : "text-composer-text-muted hover:text-composer-text-secondary"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {showLanguageWarning && (
                <span
                  aria-label={`${languageReviewCount} ${languageReviewCount === 1 ? "line needs" : "lines need"} language review`}
                  className="inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-amber-400/15 py-0 pl-1 pr-1.5 text-[11px] font-semibold leading-none text-amber-300 ring-1 ring-inset ring-amber-400/35"
                  data-language-review-count
                  title={`${languageReviewCount} ${languageReviewCount === 1 ? "line needs" : "lines need"} review`}
                >
                  <IconAlertTriangle aria-hidden="true" className="block size-3 shrink-0" />
                  <span className="inline-flex items-center leading-none">{languageReviewCount}</span>
                </span>
              )}
            </span>
            {showHints && <InlineKeyBadge keys={["Mod", String(index + 1)]} />}
          </button>
        );
      })}
    </nav>
  );
};

export { TabBar };
