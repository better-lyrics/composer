import { AudioEngine } from "@/audio/audio-engine";
import { useAutoSeparate } from "@/hooks/useAutoSeparate";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useImportFromHash } from "@/hooks/useImportFromHash";
import { useImportFromQuery } from "@/hooks/useImportFromQuery";
import { useImportFromYouTube } from "@/hooks/useImportFromYouTube";
import { usePanicRecovery } from "@/hooks/usePanicRecovery";
import { usePersistence } from "@/hooks/usePersistence";
import { useProjectChannel } from "@/hooks/useProjectChannel";
import { useProjectShortcuts } from "@/hooks/useProjectShortcuts";
import { useResolveYouTubeTunnel } from "@/hooks/useResolveYouTubeTunnel";
import { useStorageMaintenance } from "@/hooks/useStorageMaintenance";
import { useVocalOnsetSnapPoints } from "@/hooks/useVocalOnsetSnapPoints";
import { appQueryClient } from "@/lib/app-query-client";
import { wireFrameLoop } from "@/lib/frame-loop-wiring";
import { commitAllPendingDeletions } from "@/lib/pending-deletions";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { useUIStore } from "@/stores/ui";
import { GuideCard } from "@/tour/guide-card";
import { useTour } from "@/tour/use-tour";
import "@/tour/tour-theme.css";
import { AppHeader } from "@/ui/app-header";
import { ConfirmModalHost } from "@/ui/confirm-modal";
import { DivergenceModalHost } from "@/ui/divergence-modal";
import { HelpModal } from "@/ui/help-modal";
import { ImportConflictModalHost } from "@/ui/projects/import-conflict-modal";
import { APP_SETTING_LINK_HOST, SettingLinkContext } from "@/ui/setting-link-context";
import { SettingsModal } from "@/ui/settings-modal";
import { EDITOR_PATH, screenForPath } from "@/utils/app-routes";
import { EditorScreen } from "@/views/editor-screen";
import { LibraryScreen } from "@/views/library/library-screen";
import { LyricsImportModalHost } from "@/views/lyrics-import-modal/lyrics-import-modal-host";
import { QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import { Activity, useCallback, useEffect, useEffectEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

// -- Constants ----------------------------------------------------------------

const TOUR_START_DELAY_MS = 500;

// -- Shell --------------------------------------------------------------------

const AppShell: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const screen = screenForPath(pathname);
  const isEditor = screen === "editor";
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const source = useAudioStore((s) => s.source);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const helpLocation = useUIStore((s) => s.helpLocation);
  const openHelp = useUIStore((s) => s.openHelp);
  const closeHelp = useUIStore((s) => s.closeHelp);
  const [tourRequested, setTourRequested] = useState(false);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const openBestPractices = useCallback(() => openHelp("best-practices"), [openHelp]);
  const { startTour, resumeOrStartTour, shouldShowTour, guideCard, skipGuideCard } = useTour({
    onOpenBestPractices: openBestPractices,
  });
  const startTourLater = useEffectEvent(() => startTour());
  const resumeTourLater = useEffectEvent(() => resumeOrStartTour());
  if (!isEditor && tourRequested) setTourRequested(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect Events always read current state and must not be dependencies.
  useEffect(() => {
    if (!isEditor || (!shouldShowTour && !tourRequested)) return;
    const timer = setTimeout(() => {
      if (!tourRequested) {
        startTourLater();
        return;
      }
      setTourRequested(false);
      resumeTourLater();
    }, TOUR_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isEditor, shouldShowTour, tourRequested]);

  useEffect(() => wireFrameLoop(), []);

  useEffect(() => {
    if (isEditor) return;
    useAudioStore.getState().setIsPlaying(false);
    useUIStore.getState().setProjectSwitcherOpen(false);
  }, [isEditor]);

  useEffect(
    () => () => {
      void commitAllPendingDeletions();
    },
    [],
  );

  usePersistence();
  useStorageMaintenance();
  useProjectChannel();
  useProjectShortcuts(isEditor);
  useImportFromHash();
  useResolveYouTubeTunnel();
  useImportFromQuery();
  useImportFromYouTube();
  usePanicRecovery();
  useAutoSeparate();
  useDocumentTitle(screen);
  useVocalOnsetSnapPoints();

  const setHelpOpenCb = useCallback((open: boolean) => (open ? openHelp() : closeHelp()), [openHelp, closeHelp]);
  const setSettingsOpenCb = useCallback(
    (open: boolean) => (open ? openSettings() : closeSettings()),
    [openSettings, closeSettings],
  );

  useGlobalShortcuts({
    setActiveTab,
    setHelpOpen: setHelpOpenCb,
    setSettingsOpen: setSettingsOpenCb,
    editorActive: isEditor,
  });

  const startTourFromHeader = useCallback(() => {
    if (isEditor) {
      resumeOrStartTour();
      return;
    }
    setTourRequested(true);
    navigate(EDITOR_PATH);
  }, [isEditor, resumeOrStartTour, navigate]);

  return (
    <div className="flex flex-col h-screen bg-composer-bg text-composer-text">
      <AppHeader
        screen={screen}
        onSettingsOpen={() => openSettings()}
        onHelpOpen={() => openHelp()}
        onTourStart={startTourFromHeader}
      />
      <HelpModal
        key={
          helpOpen
            ? `help-${helpLocation.section}-${helpLocation.scrollTop}-${helpLocation.query ?? ""}`
            : "help-closed"
        }
        isOpen={helpOpen}
        initialSection={helpLocation.section}
        initialScrollTop={helpLocation.scrollTop}
        initialQuery={helpLocation.query}
        onClose={closeHelp}
      />
      <SettingsModal
        key={settingsOpen ? "settings-open" : "settings-closed"}
        isOpen={settingsOpen}
        onClose={closeSettings}
      />
      <Activity mode={isEditor ? "hidden" : "visible"}>
        <LibraryScreen />
      </Activity>
      <Activity mode={isEditor ? "visible" : "hidden"}>
        <EditorScreen />
      </Activity>
      {source && <AudioEngine />}
      <GuideCard state={guideCard} onSkip={skipGuideCard} />
    </div>
  );
};

// -- App ------------------------------------------------------------------------

const App: React.FC = () => {
  return (
    <QueryClientProvider client={appQueryClient}>
      <LazyMotion features={domAnimation} strict>
        <SettingLinkContext value={APP_SETTING_LINK_HOST}>
          <AppShell />
          <ConfirmModalHost />
          <DivergenceModalHost />
          <LyricsImportModalHost />
          <ImportConflictModalHost />
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
        </SettingLinkContext>
      </LazyMotion>
    </QueryClientProvider>
  );
};

// -- Exports ------------------------------------------------------------------

export { App };
