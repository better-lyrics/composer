import { useProjectStore } from "@/stores/project";
import type { SimpleTab } from "@/stores/project";

const TABS: { id: SimpleTab; label: string }[] = [
	{ id: "import", label: "Import" },
	{ id: "edit", label: "Edit" },
	{ id: "sync", label: "Sync" },
	{ id: "preview", label: "Preview" },
	{ id: "export", label: "Export" },
];

const TabBar: React.FC = () => {
	const activeTab = useProjectStore((s) => s.activeTab);
	const setActiveTab = useProjectStore((s) => s.setActiveTab);

	return (
		<nav className="flex border-b border-composer-border select-none">
			{TABS.map((tab) => {
				const isActive = activeTab === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={`cursor-pointer px-4 py-3 text-sm font-medium transition-colors ${
							isActive
								? "border-b-2 border-composer-accent text-composer-text"
								: "text-composer-text-muted hover:text-composer-text-secondary"
						}`}
					>
						{tab.label}
					</button>
				);
			})}
		</nav>
	);
};

export { TabBar, TABS };
