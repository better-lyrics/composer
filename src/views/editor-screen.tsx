import { AudioPlayer } from "@/audio/audio-player";
import type { ProjectTab } from "@/domain/project/tab";
import { useMissingAudioNotice } from "@/hooks/useMissingAudioNotice";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { TabBar } from "@/ui/tab-bar";
import { EditPanel } from "@/views/edit";
import { ExportPanel } from "@/views/export";
import { ImportPanel } from "@/views/import";
import { LanguagesPanel } from "@/views/languages";
import { PreviewPanel } from "@/views/preview";
import { SyncPanel } from "@/views/sync/sync-panel";
import { TimelinePanel } from "@/views/timeline/timeline-panel";
import { Activity } from "react";

// -- Constants ----------------------------------------------------------------

const TABS_WITH_PLAYER: readonly ProjectTab[] = ["import", "edit", "languages", "sync", "timeline", "preview"];

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
  const source = useAudioStore((state) => state.source);
  const showPlayer = Boolean(source) && TABS_WITH_PLAYER.includes(activeTab);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <TabBar />
      <main className="relative flex-1 overflow-hidden">
        {PANELS.map(({ tab, Panel }) => (
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
