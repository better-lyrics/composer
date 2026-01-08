import { useProjectStore } from "@/stores/project";
import type { LyricLine } from "@/stores/project";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useCallback, useId, useMemo, useState } from "react";

// -- Types --------------------------------------------------------------------

interface ParsedLine {
	lineNumber: number;
	text: string;
	isEmpty: boolean;
	hasBrackets: boolean;
}

// -- Helpers ------------------------------------------------------------------

function parseLyrics(text: string): ParsedLine[] {
	const lines = text.split("\n");
	return lines.map((line, index) => ({
		lineNumber: index + 1,
		text: line,
		isEmpty: line.trim() === "",
		hasBrackets: /\[.*?\]/.test(line),
	}));
}

function parsedToLyricLines(parsed: ParsedLine[], defaultAgentId: string): LyricLine[] {
	return parsed
		.filter((p) => !p.isEmpty)
		.map((p) => ({
			id: crypto.randomUUID(),
			text: p.text.trim(),
			agentId: defaultAgentId,
		}));
}

// -- Components ---------------------------------------------------------------

const BracketWarning: React.FC<{ count: number }> = ({ count }) => {
	if (count === 0) return null;

	return (
		<div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-composer-error/10 text-composer-error">
			<IconAlertTriangle className="w-4 h-4 shrink-0" />
			<span>
				{count} line{count > 1 ? "s" : ""} contain{count === 1 ? "s" : ""} [brackets] — these may
				be timing markers from imported files
			</span>
		</div>
	);
};

const LinePreview: React.FC<{ line: ParsedLine }> = ({ line }) => {
	return (
		<div
			className={`flex items-baseline gap-2 px-3 py-0.5 ${
				line.isEmpty ? "opacity-50" : ""
			} ${line.hasBrackets ? "bg-composer-error/5" : ""}`}
		>
			<span className="w-8 shrink-0 text-right font-mono text-xs text-composer-text-muted tabular-nums">
				{line.lineNumber}
			</span>
			<span
				className={`flex-1 text-sm ${line.isEmpty ? "italic text-composer-text-muted" : "text-composer-text"} ${line.hasBrackets ? "text-composer-error" : ""}`}
			>
				{line.isEmpty ? "(empty line)" : line.text}
			</span>
			{line.hasBrackets && (
				<IconAlertTriangle className="w-4 h-4 text-composer-error shrink-0" />
			)}
		</div>
	);
};

const EditPanel: React.FC = () => {
	const textareaId = useId();
	const agents = useProjectStore((s) => s.agents);
	const setLines = useProjectStore((s) => s.setLines);

	const [rawText, setRawText] = useState("");

	const parsed = useMemo(() => parseLyrics(rawText), [rawText]);
	const bracketCount = useMemo(() => parsed.filter((p) => p.hasBrackets).length, [parsed]);
	const nonEmptyCount = useMemo(() => parsed.filter((p) => !p.isEmpty).length, [parsed]);

	const handleTextChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const text = e.target.value;
			setRawText(text);

			const newParsed = parseLyrics(text);
			const defaultAgent = agents[0]?.id ?? "v1";
			const lyricLines = parsedToLyricLines(newParsed, defaultAgent);
			setLines(lyricLines);
		},
		[agents, setLines],
	);

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 overflow-hidden">
			<div className="flex items-center justify-between select-none">
				<h2 className="text-lg font-medium">Lyrics Editor</h2>
				<span className="text-sm text-composer-text-muted">
					{nonEmptyCount} line{nonEmptyCount !== 1 ? "s" : ""}
				</span>
			</div>

			<BracketWarning count={bracketCount} />

			<div className="flex flex-1 gap-4 min-h-0">
				{/* Input */}
				<div className="flex flex-1 flex-col min-w-0">
					<label
						htmlFor={textareaId}
						className="mb-2 text-sm font-medium text-composer-text-secondary select-none"
					>
						Paste or type lyrics
					</label>
					<textarea
						id={textareaId}
						value={rawText}
						onChange={handleTextChange}
						placeholder="Paste your lyrics here, one line at a time..."
						className="flex-1 p-3 text-sm bg-composer-input border border-composer-border rounded-lg resize-none focus:outline-none focus:border-composer-accent placeholder:text-composer-text-muted"
						spellCheck={false}
					/>
				</div>

				{/* Preview */}
				<div className="flex flex-1 flex-col min-w-0">
					<span className="mb-2 text-sm font-medium text-composer-text-secondary select-none">
						Preview
					</span>
					<div className="flex-1 overflow-y-auto rounded-lg border border-composer-border bg-composer-bg-dark">
						{parsed.length === 0 || (parsed.length === 1 && parsed[0].isEmpty) ? (
							<div className="flex items-center justify-center h-full text-sm text-composer-text-muted">
								Lyrics will appear here
							</div>
						) : (
							<div className="py-2">
								{parsed.map((line) => (
									<LinePreview key={line.lineNumber} line={line} />
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

// -- Exports ------------------------------------------------------------------

export { EditPanel };
