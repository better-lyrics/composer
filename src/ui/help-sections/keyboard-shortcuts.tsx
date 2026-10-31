import { useShortcutBindingsStore } from "@/stores/shortcut-bindings";
import { shortcutPreset } from "@/stores/shortcut-presets";
import { HelpTopic } from "@/ui/help-topic";
import { SettingLink } from "@/ui/setting-link";
import { ShortcutSection, SHORTCUT_SECTIONS } from "@/ui/shortcut-reference";
import { PROSE } from "@/ui/typography";

// -- Keyboard Shortcuts -------------------------------------------------------

const KeyboardShortcutsSection: React.FC = () => {
  const presetName = useShortcutBindingsStore((s) => shortcutPreset(s.preset).name);
  return (
    <div className="space-y-6">
      <p className={PROSE}>
        These are your {presetName} keys. Switch layouts in <SettingLink setting="shortcutPreset" />.
      </p>
      <div className="grid grid-cols-2 gap-x-12 gap-y-6">
        {SHORTCUT_SECTIONS.map((section) => (
          <HelpTopic key={section.title} title={section.title} showTitle={false}>
            <ShortcutSection {...section} />
          </HelpTopic>
        ))}
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { KeyboardShortcutsSection };
