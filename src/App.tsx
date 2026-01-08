import { AudioProvider } from "@/audio/audio-context";
import { AudioPlayer } from "@/audio/audio-player";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Shortcut } from "@/hooks/useKeyboardShortcuts";
import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { TabBar } from "@/ui/tab-bar";
import { EditPanel } from "@/views/edit";
import { ExportPanel } from "@/views/export";
import { ImportPanel } from "@/views/import";
import { PreviewPanel } from "@/views/preview";
import { SyncPanel } from "@/views/sync";
import { Activity, useMemo } from "react";

const TABS_WITH_PLAYER = ["import", "edit", "sync", "preview"];

const AppContent: React.FC = () => {
	const activeTab = useProjectStore((s) => s.activeTab);
	const setActiveTab = useProjectStore((s) => s.setActiveTab);
	const source = useAudioStore((s) => s.source);

	const showPlayer = source && TABS_WITH_PLAYER.includes(activeTab);

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
				action: () => setActiveTab("preview"),
				description: "Preview",
			},
			{
				key: "5",
				ctrl: true,
				action: () => setActiveTab("export"),
				description: "Export",
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
			</header>
			<TabBar />
			<main className="relative flex-1 overflow-hidden">
				<div
					className={`absolute inset-0 flex flex-col ${
						activeTab === "import" ? "visible" : "invisible"
					}`}
				>
					<ImportPanel />
				</div>
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
			{showPlayer && <AudioPlayer />}
		</div>
	);
};

const App: React.FC = () => {
	return (
		<AudioProvider>
			<AppContent />
		</AudioProvider>
	);
};

export { App };
