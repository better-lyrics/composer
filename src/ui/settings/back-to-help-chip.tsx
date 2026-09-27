import { useUIStore } from "@/stores/ui";
import { HELP_SECTIONS } from "@/ui/help-nav";
import { IconArrowBackUp } from "@tabler/icons-react";

// -- Component -----------------------------------------------------------------

const BackToHelpChip: React.FC = () => {
  const returnTo = useUIStore((s) => s.settingsReturnTo);
  const closeSettings = useUIStore((s) => s.closeSettings);
  if (!returnTo) return null;
  const sectionLabel = HELP_SECTIONS.find((section) => section.id === returnTo.section)?.label;
  const destination = returnTo.query ? `"${returnTo.query.trim()}"` : sectionLabel;

  return (
    <button
      type="button"
      onClick={closeSettings}
      className="ml-3 inline-flex items-center gap-1.5 h-6.5 pl-1.5 pr-2.5 rounded-md text-xs text-composer-text-secondary bg-composer-input ring-1 ring-inset ring-composer-border hover:bg-composer-button hover:text-composer-text cursor-pointer select-none transition-colors"
    >
      <IconArrowBackUp size={14} aria-hidden="true" />
      {destination ? `Back to Help ・ ${destination}` : "Back to Help"}
    </button>
  );
};

// -- Exports -------------------------------------------------------------------

export { BackToHelpChip };
