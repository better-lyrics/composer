import type { GuideSpotTarget } from "@/guide/catalog/types";
import { hideSpotHint, showSpotHint } from "@/guide/spot-hint-store";
import { nextFrame } from "@/lib/frame-loop";
import { useProjectStore } from "@/stores/project";
import type { Icon } from "@tabler/icons-react";

// -- Constants ----------------------------------------------------------------

// A tab opened for the first time mounts its panel a few frames later.
const MAX_FRAMES_TO_WAIT = 30;

// -- API ----------------------------------------------------------------------

function pointAt(target: GuideSpotTarget, icon: Icon): void {
  const project = useProjectStore.getState();
  if (project.activeTab !== target.stage) project.setActiveTab(target.stage);
  hideSpotHint();
  let framesLeft = MAX_FRAMES_TO_WAIT;
  const tryToShow = () => {
    const shown = showSpotHint(target.spot, { id: `point:${target.spot}`, icon, text: target.text });
    if (!shown && --framesLeft > 0) nextFrame(tryToShow);
  };
  nextFrame(tryToShow);
}

// -- Exports ------------------------------------------------------------------

export { pointAt };
