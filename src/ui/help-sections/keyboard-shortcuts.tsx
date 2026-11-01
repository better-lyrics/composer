import { ShortcutSection, SHORTCUT_SECTIONS } from "@/ui/shortcut-reference";
import { HelpTopic } from "@/ui/help-topic";

// -- Keyboard Shortcuts -------------------------------------------------------

const KeyboardShortcutsSection: React.FC = () => (
  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
    {SHORTCUT_SECTIONS.map((section) => (
      <HelpTopic key={section.title} title={section.title} showTitle={false}>
        <ShortcutSection {...section} />
      </HelpTopic>
    ))}
  </div>
);

// -- Exports ------------------------------------------------------------------

export { KeyboardShortcutsSection };
