import { muteGuideCategory, unmuteGuideCategories } from "@/lib/guide-signals";
import { SettingLink } from "@/ui/setting-link";
import { toast } from "@/utils/toast";

// -- Actions ------------------------------------------------------------------

function muteHintsLike(category: string): void {
  muteGuideCategory(category);
  toast("No more tips like this", {
    description: (
      <>
        Turn them back on under <SettingLink setting="unmuteGuideHints" />.
      </>
    ),
    action: { label: "Undo", onClick: () => unmuteGuideCategories([category]) },
  });
}

// -- Exports ------------------------------------------------------------------

export { muteHintsLike };
