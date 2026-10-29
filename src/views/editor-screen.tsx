import { AudioPlayer } from "@/audio/audio-player";
import type { ProjectTab } from "@/domain/project/tab";
import { useMissingAudioNotice } from "@/hooks/useMissingAudioNotice";
import { useTransportDeckShown } from "@/hooks/use-transport-deck-shown";
import { useProjectStore } from "@/stores/project";
import { EditPanel } from "@/views/edit";
import { ExportPanel } from "@/views/export";
import { ImportPanel } from "@/views/import";
import { LanguagesPanel } from "@/views/languages";
import { PreviewPanel } from "@/views/preview";
import { SyncPanel } from "@/views/sync/sync-panel";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { cn } from "@/utils/cn";
import { Activity, useState } from "react";

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

// -- Component ----------------------------------------------------------------

const EditorScreen: React.FC = () => {
  useMissingAudioNotice();
  const activeTab = useProjectStore((state) => state.activeTab);
  const showPlayer = useTransportDeckShown();
  // A panel mounts on its tab's first visit, then Activity keeps its state across switches.
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<ProjectTab>>(() => new Set([activeTab]));
  if (!visitedTabs.has(activeTab)) setVisitedTabs(new Set([...visitedTabs, activeTab]));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <main className={cn("flex-1 min-h-0 workspace-card", !showPlayer && "mb-2")}>
        {PANELS.filter(({ tab }) => visitedTabs.has(tab)).map(({ tab, Panel }) => (
          <Activity key={tab} mode={activeTab === tab ? "visible" : "hidden"}>
            <div className="absolute inset-0 flex flex-col">
              <Panel />
            </div>
          </Activity>
        ))}
      </main>
      {showPlayer && <AudioPlayer />}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { EditorScreen };
