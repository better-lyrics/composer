import { AudioEngine } from "@/audio/audio-engine";
import { AudioPlayer } from "@/audio/audio-player";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { debouncedSave, flushPendingSave, loadCurrentProject, saveCurrentProject } from "@/lib/persistence";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { GuideCard } from "@/tour/guide-card";
import { useTour } from "@/tour/use-tour";
import "@/tour/tour-theme.css";
import { Button } from "@/ui/button";
import { HelpModal } from "@/ui/help-modal";
import { TabBar } from "@/ui/tab-bar";
import { EditPanel } from "@/views/edit";
import { ExportPanel } from "@/views/export";
import { ImportPanel } from "@/views/import";
import { PreviewPanel } from "@/views/preview";
import { SyncPanel } from "@/views/sync/sync-panel";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { IconHelp, IconRoute } from "@tabler/icons-react";
import { Activity, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";

const TABS_WITH_PLAYER = ["import", "edit", "sync", "timeline", "preview"];

const AppContent: React.FC = () => {
  const activeTab = useProjectStore((s) => s.activeTab);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const source = useAudioStore((s) => s.source);
  const [helpOpen, setHelpOpen] = useState(false);
  const { startTour, resumeOrStartTour, shouldShowTour, guideCard, skipGuideCard } = useTour();
  const startTourRef = useRef(startTour);
  startTourRef.current = startTour;

  const showPlayer = source && TABS_WITH_PLAYER.includes(activeTab);

  // Auto-start quick tour on first visit
  useEffect(() => {
    if (!shouldShowTour) return;
    const timer = setTimeout(() => startTourRef.current(), 500);
    return () => clearTimeout(timer);
  }, [shouldShowTour]);

  // Load saved project on mount
  useEffect(() => {
    loadCurrentProject().then((project) => {
      if (project) {
        const state = useProjectStore.getState();
        state.setMetadata(project.metadata);
        state.setLines(project.lines);
        state.setGranularity(project.granularity);
        for (const agent of project.agents) {
          if (!state.agents.find((a) => a.id === agent.id)) {
            state.addAgent(agent);
          }
        }
        state.markClean();
      }
    });
  }, []);

  // Auto-save on state changes
  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state) => {
      if (state.lines.length > 0 || state.metadata.title) {
        const audioSource = useAudioStore.getState().source;
        const audioFileName = audioSource?.type === "file" ? audioSource.file.name : undefined;
        debouncedSave(state.metadata, state.agents, state.lines, state.granularity, audioFileName);
      }
    });

    return () => unsubscribe();
  }, []);

  // Warn on tab close if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const state = useProjectStore.getState();
      if (state.isDirty && state.lines.length > 0) {
        flushPendingSave();
        const audioSource = useAudioStore.getState().source;
        const audioFileName = audioSource?.type === "file" ? audioSource.file.name : undefined;
        saveCurrentProject(state.metadata, state.agents, state.lines, state.granularity, audioFileName);
        e.preventDefault();
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        key: "1",
        ctrl: true,
        action: () => setActiveTab("import"),
        description: "Import",
      },
      {
        key: "2",
        ctrl: true,
        action: () => setActiveTab("edit"),
        description: "Edit",
      },
      {
        key: "3",
        ctrl: true,
        action: () => setActiveTab("sync"),
        description: "Sync",
      },
      {
        key: "4",
        ctrl: true,
        action: () => setActiveTab("timeline"),
        description: "Timeline",
      },
      {
        key: "5",
        ctrl: true,
        action: () => setActiveTab("preview"),
        description: "Preview",
      },
      {
        key: "6",
        ctrl: true,
        action: () => setActiveTab("export"),
        description: "Export",
      },
      {
        key: "Enter",
        action: () => {
          const { isPlaying, setIsPlaying } = useAudioStore.getState();
          setIsPlaying(!isPlaying);
        },
        description: "Play / Pause",
      },
      {
        key: "?",
        shift: true,
        action: () => setHelpOpen(true),
        description: "Show keyboard shortcuts",
      },
    ],
    [setActiveTab],
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex flex-col h-screen bg-composer-bg text-composer-text">
      <header className="flex items-center justify-between p-4 border-b select-none border-composer-border">
        <h1 className="text-xl font-bold">
          <img src="/logo.svg" alt="Composer Logo" className="inline-block w-6 h-6 mr-2 -mt-1" />
          Composer
        </h1>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={resumeOrStartTour} title="Product tour">
            <IconRoute className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">
            <IconHelp className="w-5 h-5" />
          </Button>
        </div>
      </header>
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <TabBar />
      <main className="relative flex-1 overflow-hidden">
        <Activity mode={activeTab === "import" ? "visible" : "hidden"}>
          <div className="absolute inset-0 flex flex-col">
            <ImportPanel />
          </div>
        </Activity>
        <Activity mode={activeTab === "edit" ? "visible" : "hidden"}>
          <div className="absolute inset-0 flex flex-col">
            <EditPanel />
          </div>
        </Activity>
        <Activity mode={activeTab === "sync" ? "visible" : "hidden"}>
          <div className="absolute inset-0 flex flex-col">
            <SyncPanel />
          </div>
        </Activity>
        <Activity mode={activeTab === "timeline" ? "visible" : "hidden"}>
          <div className="absolute inset-0 flex flex-col">
            <TimelinePanel />
          </div>
        </Activity>
        <Activity mode={activeTab === "preview" ? "visible" : "hidden"}>
          <div className="absolute inset-0 flex flex-col">
            <PreviewPanel />
          </div>
        </Activity>
        <Activity mode={activeTab === "export" ? "visible" : "hidden"}>
          <div className="absolute inset-0 flex flex-col">
            <ExportPanel />
          </div>
        </Activity>
      </main>
      {source && <AudioEngine />}
      {showPlayer && <AudioPlayer />}
      <GuideCard state={guideCard} onSkip={skipGuideCard} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <>
      <AppContent />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--color-composer-bg-elevated)",
            border: "1px solid var(--color-composer-border)",
            color: "var(--color-composer-text)",
          },
        }}
      />
    </>
  );
};

export { App };
