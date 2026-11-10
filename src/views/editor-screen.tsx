import { AudioPlayer } from "@/audio/audio-player";
import type { ProjectTab } from "@/domain/project/tab";
import { useHistoryShortcuts } from "@/hooks/useHistoryShortcuts";
import { useMissingAudioNotice } from "@/hooks/useMissingAudioNotice";
import { useTransportDeckShown } from "@/hooks/use-transport-deck-shown";
import { GuideHost } from "@/guide/guide-host";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { EditPanel } from "@/views/edit";
import { ExportPanel } from "@/views/export";
import { ImportPanel } from "@/views/import";
import { LanguagesPanel } from "@/views/languages";
import { PreviewPanel } from "@/views/preview";
import { SyncPanel } from "@/views/sync/sync-panel";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { cn } from "@/utils/cn";
import { Activity, memo, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface TabPanelProps {
  tab: ProjectTab;
  Panel: React.FC;
  isActive: boolean;
}

interface PanelContentProps {
  Panel: React.FC;
  isActive: boolean;
}

// -- Constants ----------------------------------------------------------------

const PANELS: readonly { tab: ProjectTab; Panel: React.FC }[] = [
  { tab: "import", Panel: ImportPanel },
  { tab: "edit", Panel: EditPanel },
  { tab: "languages", Panel: LanguagesPanel },
  { tab: "sync", Panel: SyncPanel },
  { tab: "timeline", Panel: TimelinePanel },
  { tab: "preview", Panel: PreviewPanel },
  { tab: "export", Panel: ExportPanel },
];

const TABS_WITH_OWN_HISTORY_KEYS: ReadonlySet<ProjectTab> = new Set(["edit", "sync", "timeline"]);

// -- Components ---------------------------------------------------------------

const rendersOnlyOnReveal = (previous: PanelContentProps, next: PanelContentProps): boolean =>
  previous.Panel === next.Panel && (previous.isActive || !next.isActive);

// Panels read their own stores; the shell renders one only as it is revealed, so it shows current state.
const PanelContent = memo<PanelContentProps>(({ Panel }) => <Panel />, rendersOnlyOnReveal);

const TabPanel = memo<TabPanelProps>(({ tab, Panel, isActive }) => (
  <Activity mode={isActive ? "visible" : "hidden"}>
    <div data-tab-panel={tab} className="absolute inset-0 flex flex-col">
      <PanelContent Panel={Panel} isActive={isActive} />
    </div>
  </Activity>
));

const EditorScreen: React.FC = () => {
  useMissingAudioNotice();
  const activeTab = useProjectStore((state) => state.activeTab);
  const showPlayer = useTransportDeckShown();
  const showGuide = useSettingsStore((state) => state.showGuide);
  useHistoryShortcuts(!TABS_WITH_OWN_HISTORY_KEYS.has(activeTab));
  // A panel mounts on its tab's first visit, then Activity keeps its state across switches.
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<ProjectTab>>(() => new Set([activeTab]));
  if (!visitedTabs.has(activeTab)) setVisitedTabs(new Set([...visitedTabs, activeTab]));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <main className={cn("flex-1 min-h-0 workspace-card", !showPlayer && "mb-2")}>
        {PANELS.filter(({ tab }) => visitedTabs.has(tab)).map(({ tab, Panel }) => (
          <TabPanel key={tab} tab={tab} Panel={Panel} isActive={activeTab === tab} />
        ))}
        {showGuide && <GuideHost />}
      </main>
      {showPlayer && <AudioPlayer />}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditorScreen };
