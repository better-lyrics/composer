import { getLanguageAlignmentErrorItems } from "@/domain/language/alignment-errors";
import { getLanguageReviewItems } from "@/domain/language/review";
import { useProjectStore } from "@/stores/project";
import type { SimpleTab } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { InlineKeyBadge } from "@/ui/inline-key-badge";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { IconAlertCircle, IconAlertTriangle } from "@tabler/icons-react";

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
  const languageErrorCount = getLanguageAlignmentErrorItems(lines).length;

  return (
    <nav data-tour="tab-bar" className="flex border-b border-composer-border select-none">
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const showLanguageWarning = tab.id === "languages" && languageReviewCount > 0;
        const showLanguageError = tab.id === "languages" && languageErrorCount > 0;
        return (
          <button
            key={tab.id}
            type="button"
            data-tour={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "cursor-pointer px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "border-b-2 border-composer-accent text-composer-text"
                : "text-composer-text-muted hover:text-composer-text-secondary",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {showLanguageError && (
                <StatusChip
                  tone="error"
                  icon={IconAlertCircle}
                  aria-label={
                    languageErrorCount === 1
                      ? "1 line with a timing mismatch"
                      : `${languageErrorCount} lines with a timing mismatch`
                  }
                >
                  {languageErrorCount}
                </StatusChip>
              )}
              {showLanguageWarning && (
                <StatusChip
                  tone="warning"
                  icon={IconAlertTriangle}
                  aria-label={
                    languageReviewCount === 1
                      ? "1 line needs review in Languages"
                      : `${languageReviewCount} lines need review in Languages`
                  }
                >
                  {languageReviewCount}
                </StatusChip>
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
