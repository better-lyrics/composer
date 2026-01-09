import { useProjectStore } from "@/stores/project";
import { generateTTML } from "@/utils/ttml";
import { IconCheck, IconCopy, IconDownload, IconEdit, IconRefresh } from "@tabler/icons-react";
import { Highlight, themes } from "prism-react-renderer";
import { useCallback, useEffect, useMemo, useState } from "react";

// -- Helpers ------------------------------------------------------------------

function getLineTiming(line: {
	begin?: number;
	end?: number;
	words?: { begin: number; end: number }[];
}) {
	if (line.words?.length) {
		return { begin: line.words[0].begin, end: line.words[line.words.length - 1].end };
	}
	if (line.begin !== undefined && line.end !== undefined) {
		return { begin: line.begin, end: line.end };
	}
	return null;
}

// -- Components ---------------------------------------------------------------

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
	<div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
		<p className="text-lg text-composer-text-secondary">{message}</p>
		<p className="text-sm text-composer-text-muted">{hint}</p>
	</div>
);

const ExportPanel: React.FC = () => {
	const metadata = useProjectStore((s) => s.metadata);
	const agents = useProjectStore((s) => s.agents);
	const lines = useProjectStore((s) => s.lines);
	const granularity = useProjectStore((s) => s.granularity);

	const [copied, setCopied] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editedContent, setEditedContent] = useState<string | null>(null);

	const hasSyncedContent = useMemo(() => {
		return lines.some((line) => getLineTiming(line) !== null);
	}, [lines]);

	const syncedLineCount = useMemo(() => {
		return lines.filter((line) => getLineTiming(line) !== null).length;
	}, [lines]);

	const generatedTtml = useMemo(() => {
		if (!hasSyncedContent) return "";
		return generateTTML({ metadata, agents, lines, granularity });
	}, [metadata, agents, lines, granularity, hasSyncedContent]);

	// Reset edited content when generated content changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when generated content changes
	useEffect(() => {
		setEditedContent(null);
		setIsEditing(false);
	}, [generatedTtml]);

	const ttmlContent = editedContent ?? generatedTtml;

	const handleDownload = useCallback(() => {
		if (!ttmlContent) return;

		const blob = new Blob([ttmlContent], { type: "application/ttml+xml;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${metadata.title || "lyrics"}.ttml`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [ttmlContent, metadata.title]);

	const handleCopy = useCallback(async () => {
		if (!ttmlContent) return;

		await navigator.clipboard.writeText(ttmlContent);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [ttmlContent]);

	const handleEdit = useCallback(() => {
		if (!isEditing) {
			setEditedContent(ttmlContent);
		}
		setIsEditing(!isEditing);
	}, [isEditing, ttmlContent]);

	const handleRegenerate = useCallback(() => {
		setEditedContent(null);
		setIsEditing(false);
	}, []);

	if (lines.length === 0) {
		return (
			<div className="flex flex-col flex-1 p-4">
				<EmptyState message="No lyrics to export" hint="Add lyrics in the Edit tab first" />
			</div>
		);
	}

	if (!hasSyncedContent) {
		return (
			<div className="flex flex-col flex-1 p-4">
				<EmptyState message="No synced content" hint="Sync lyrics in the Sync tab first" />
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
				<div className="flex items-baseline gap-3">
					<h2 className="text-lg font-medium">Export</h2>
					<span className="text-sm text-composer-text-muted">
						{syncedLineCount}/{lines.length} lines synced
						{editedContent !== null && " · edited"}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{editedContent !== null && (
						<button
							type="button"
							onClick={handleRegenerate}
							className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg bg-composer-button hover:bg-composer-button-hover transition-colors cursor-pointer"
						>
							<IconRefresh className="w-4 h-4" />
							Regenerate
						</button>
					)}
					<button
						type="button"
						onClick={handleEdit}
						className={`flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg transition-colors cursor-pointer ${
							isEditing
								? "bg-composer-accent-dark hover:bg-composer-accent"
								: "bg-composer-button hover:bg-composer-button-hover"
						}`}
					>
						<IconEdit className="w-4 h-4" />
						{isEditing ? "Done" : "Edit"}
					</button>
					<button
						type="button"
						onClick={handleCopy}
						className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg bg-composer-button hover:bg-composer-button-hover transition-colors cursor-pointer"
					>
						{copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
						{copied ? "Copied" : "Copy"}
					</button>
					<button
						type="button"
						onClick={handleDownload}
						className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg bg-composer-accent-dark hover:bg-composer-accent transition-colors cursor-pointer"
					>
						<IconDownload className="w-4 h-4" />
						Download TTML
					</button>
				</div>
			</div>

			{/* Preview / Editor */}
			<div className="flex-1 overflow-auto p-6">
				{isEditing ? (
					<textarea
						value={editedContent ?? ""}
						onChange={(e) => setEditedContent(e.target.value)}
						className="w-full h-full p-4 rounded-lg font-mono text-xs bg-composer-bg-elevated text-composer-text resize-none focus:outline-none focus:ring-1 focus:ring-composer-accent"
						spellCheck={false}
					/>
				) : (
					<Highlight theme={themes.nightOwl} code={ttmlContent} language="xml">
						{({ style, tokens, getLineProps, getTokenProps }) => (
							<pre
								className="p-4 rounded-lg font-mono text-xs whitespace-pre-wrap break-all select-text"
								style={{ ...style, background: "var(--color-composer-bg-elevated)" }}
							>
								{tokens.map((line, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: stable line indices
									<div key={i} {...getLineProps({ line })}>
										{line.map((token, j) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: stable token indices
											<span key={j} {...getTokenProps({ token })} />
										))}
									</div>
								))}
							</pre>
						)}
					</Highlight>
				)}
			</div>
		</div>
	);
};

// -- Exports ------------------------------------------------------------------

export { ExportPanel };
