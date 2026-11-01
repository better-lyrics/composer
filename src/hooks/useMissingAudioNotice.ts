import { useOpenProjectId } from "@/hooks/useOpenProjectId";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const MISSING_AUDIO_TOAST_ID = "missing-audio";

// -- Helpers ------------------------------------------------------------------

function openImportTab(): void {
  useProjectStore.getState().setActiveTab("import");
}

// -- Hook ---------------------------------------------------------------------

function useMissingAudioNotice(): void {
  const expected = useAudioStore((state) => state.expectedAudio);
  const hasSource = useAudioStore((state) => state.source !== null);
  const activeTab = useProjectStore((state) => state.activeTab);
  const projectId = useOpenProjectId();
  const noticed = useRef(new Set<string>());

  useEffect(() => {
    if (hasSource || activeTab === "import") toast.dismiss(MISSING_AUDIO_TOAST_ID);
  }, [hasSource, activeTab]);

  useEffect(() => {
    if (!projectId || hasSource || expected?.kind !== "file" || activeTab === "import") return;
    if (noticed.current.has(projectId)) return;
    noticed.current.add(projectId);
    toast.warning("Audio isn't on this device", {
      id: MISSING_AUDIO_TOAST_ID,
      description: `Drop “${expected.name}” on the Import tab to link it again.`,
      action: { label: "Open Import", onClick: openImportTab },
    });
  }, [projectId, hasSource, expected, activeTab]);
}

// -- Exports ------------------------------------------------------------------

export { useMissingAudioNotice };
