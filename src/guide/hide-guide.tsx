import { useSettingsStore } from "@/stores/settings";
import { SettingLink } from "@/ui/setting-link";
import { toast } from "@/utils/toast";

// -- Actions ------------------------------------------------------------------

function hideGuide(): void {
  const { set } = useSettingsStore.getState();
  set("showGuide", false);
  toast("Guide hidden", {
    description: (
      <>
        Bring it back any time with <SettingLink setting="showGuide" />.
      </>
    ),
    action: { label: "Undo", onClick: () => set("showGuide", true) },
  });
}

// -- Exports ------------------------------------------------------------------

export { hideGuide };
