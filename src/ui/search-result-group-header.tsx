import type { ModalNavSection } from "@/ui/modal-nav-layout";

// -- Interfaces ----------------------------------------------------------------

interface SearchResultGroupHeaderProps {
  icon: ModalNavSection["icon"];
  label: string;
  onOpenSection: () => void;
}

// -- Component -----------------------------------------------------------------

const SearchResultGroupHeader: React.FC<SearchResultGroupHeaderProps> = ({ icon: Icon, label, onOpenSection }) => (
  <div data-search-ignore className="flex items-center gap-2 pt-3.5 pb-1 text-xs text-composer-text-muted select-none">
    <Icon size={14} className="shrink-0" />
    <h3 className="font-medium">{label}</h3>
    <button
      type="button"
      aria-label={`Open ${label} section`}
      onClick={onOpenSection}
      className="ml-auto text-composer-text-faint hover:text-composer-accent-text cursor-pointer transition-colors"
    >
      Open section
    </button>
  </div>
);

// -- Exports -------------------------------------------------------------------

export { SearchResultGroupHeader };
