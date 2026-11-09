import { startGuideOver } from "@/lib/guide-signals";
import { useConfirmStore } from "@/stores/confirm-store";

// -- Actions ------------------------------------------------------------------

async function askToStartGuideOver(): Promise<void> {
  const confirmed = await useConfirmStore.getState().open({
    title: "Start the guide over?",
    description:
      "The guide forgets what you've learned, so every tip shows up again and your medals reset to zero. Hints you turned off stay off.",
    confirmLabel: "Start over",
    cancelLabel: "Keep my progress",
    variant: "destructive",
  });
  if (confirmed) startGuideOver();
}

// -- Exports ------------------------------------------------------------------

export { askToStartGuideOver };
