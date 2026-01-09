import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { WordTiming } from "@/stores/project";
import {
	shimmerTransition,
	shimmerVariants,
	syncCarouselTransition,
	syncPulseVariants,
} from "@/utils/animationVariants";
import { IconLock, IconLockOpen, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -- Types --------------------------------------------------------------------

interface SyncPosition {
	lineIndex: number;
	wordIndex: number;
}

interface SyncState {
	position: SyncPosition;
	isActive: boolean;
}

// -- Helpers ------------------------------------------------------------------

function splitIntoWords(text: string): string[] {
	return text.split(/\s+/).filter((w) => w.length > 0);
}

function formatTimeMs(seconds: number): string {
	if (!Number.isFinite(seconds)) return "0:00.000";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 1000);
	return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function parseTimeMs(str: string): number | null {
	const trimmed = str.trim();
	// Format: M:SS.mmm or MM:SS.mmm
	const match = trimmed.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
	if (!match) return null;
	const mins = Number.parseInt(match[1], 10);
	const secs = Number.parseInt(match[2], 10);
	const ms = match[3] ? Number.parseInt(match[3].padEnd(3, "0"), 10) : 0;
	if (secs >= 60) return null;
	return mins * 60 + secs + ms / 1000;
}

function getTotalWords(lines: { text: string }[]): number {
	return lines.reduce((acc, line) => acc + splitIntoWords(line.text).length, 0);
}

function getSyncedWordCount(lines: { words?: WordTiming[] }[]): number {
	return lines.reduce((acc, line) => acc + (line.words?.length ?? 0), 0);
}

function getLineTiming(line: {
	begin?: number;
	end?: number;
	words?: WordTiming[];
}): {
	begin: number;
	end: number;
} | null {
	if (line.words?.length) {
		const firstWord = line.words[0];
		const lastWord = line.words[line.words.length - 1];
		return { begin: firstWord.begin, end: lastWord.end };
	}
	if (line.begin !== undefined && line.end !== undefined) {
		return { begin: line.begin, end: line.end };
	}
	return null;
}

function getSyncedLineCount(
	lines: { begin?: number; end?: number; words?: WordTiming[] }[],
): number {
	return lines.filter((line) => getLineTiming(line) !== null).length;
}

// -- Components ---------------------------------------------------------------

const LINE_HEIGHT = 100;

const SyncCarousel: React.FC<{
	lines: Array<{
		id: string;
		text: string;
		words?: WordTiming[];
		begin?: number;
	}>;
	lineIndex: number;
	wordIndex: number;
	granularity: "line" | "word";
}> = ({ lines, lineIndex, wordIndex, granularity }) => {
	// Container height shows 3 lines (prev, current, next)
	const containerHeight = LINE_HEIGHT * 3;
	// Offset to center the current line in the middle slot
	const translateY = LINE_HEIGHT - lineIndex * LINE_HEIGHT;

	return (
		<div className="relative overflow-hidden" style={{ height: containerHeight }}>
			<motion.div
				initial={{ y: translateY }}
				animate={{ y: translateY }}
				transition={syncCarouselTransition}
				className="flex flex-col items-center"
			>
				{lines.map((line, idx) => {
					const isCurrent = idx === lineIndex;
					const distance = Math.abs(idx - lineIndex);
					const opacity = distance === 0 ? 1 : distance === 1 ? 0.4 : 0;
					const scale = distance === 0 ? 1 : 0.65;

					return (
						<motion.div
							key={line.id}
							initial={{ opacity, scale }}
							animate={{ opacity, scale }}
							transition={syncCarouselTransition}
							style={{ height: LINE_HEIGHT }}
							className="flex items-center justify-center w-full shrink-0"
						>
							<div className="flex flex-wrap items-center justify-center text-4xl font-medium gap-x-4 gap-y-3">
								{granularity === "line" ? (
									<motion.span
										animate={{
											color:
												idx === lineIndex - 1
													? "rgb(129, 140, 248)"
													: isCurrent
														? "rgba(255, 255, 255, 0.7)"
														: "rgba(255, 255, 255, 0.4)",
										}}
										transition={syncCarouselTransition}
									>
										{line.text}
									</motion.span>
								) : (
									splitIntoWords(line.text).map((word, widx) => {
										const lineWordCount = splitIntoWords(line.text).length;
										const isPrevLine = idx === lineIndex - 1;
										const isLastSyncedOnCurrent =
											isCurrent && wordIndex > 0 && widx === wordIndex - 1;
										const isLastWordOfPrevLine =
											isPrevLine && wordIndex === 0 && widx === lineWordCount - 1;
										const isLastSynced = isLastSyncedOnCurrent || isLastWordOfPrevLine;

										const color = isLastSynced
											? "rgb(129, 140, 248)"
											: isCurrent
												? "rgba(255, 255, 255, 0.7)"
												: "rgba(255, 255, 255, 0.4)";

										return (
											<motion.span
												key={`${line.id}-${widx}`}
												animate={{ color }}
												transition={syncCarouselTransition}
											>
												{word}
											</motion.span>
										);
									})
								)}
							</div>
						</motion.div>
					);
				})}
			</motion.div>
		</div>
	);
};

const TimingDisplay: React.FC<{
	currentTime: number;
	lastSyncedTime?: number;
}> = ({ currentTime, lastSyncedTime }) => {
	return (
		<div className="flex items-center justify-center gap-8 font-mono text-sm select-text tabular-nums">
			<div className="text-center">
				<div className="mb-1 text-xs text-composer-text-muted">Current</div>
				<div className="text-xl text-composer-text">{formatTimeMs(currentTime)}</div>
			</div>
			{lastSyncedTime !== undefined && (
				<div className="text-center">
					<div className="mb-1 text-xs text-composer-text-muted">Last Synced</div>
					<div className="text-xl text-composer-accent-text">{formatTimeMs(lastSyncedTime)}</div>
				</div>
			)}
		</div>
	);
};

const NUDGE_AMOUNT = 0.05;

const ScrollableLine: React.FC<{
	text: string;
	lineNumber: number;
	isCurrent: boolean;
	words?: WordTiming[];
	lineBegin?: number;
	lineEnd?: number;
	granularity: "line" | "word";
	currentTime: number;
	editMode: boolean;
	onClick: () => void;
	onNudgeWord?: (wordIndex: number, delta: number) => void;
	onSetWordTime?: (wordIndex: number, newBegin: number) => void;
	onNudgeWordEnd?: (wordIndex: number, delta: number) => void;
	onSetWordEndTime?: (wordIndex: number, newEnd: number) => void;
	onNudgeLine?: (delta: number) => void;
	onSetLineTime?: (newBegin: number) => void;
}> = ({
	text,
	lineNumber,
	isCurrent,
	words,
	lineBegin,
	lineEnd,
	granularity,
	currentTime,
	editMode,
	onClick,
	onNudgeWord,
	onSetWordTime,
	onNudgeWordEnd,
	onSetWordEndTime,
	onNudgeLine,
	onSetLineTime,
}) => {
	const lineRef = useRef<HTMLDivElement>(null);
	const wordTexts = useMemo(() => splitIntoWords(text), [text]);
	const [editingIdx, setEditingIdx] = useState<number | null>(null);
	const [editingEndIdx, setEditingEndIdx] = useState<number | null>(null);
	const [editingLine, setEditingLine] = useState(false);
	const [editValue, setEditValue] = useState("");

	useEffect(() => {
		if (isCurrent && lineRef.current) {
			lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}, [isCurrent]);

	const handleNudge = (e: React.MouseEvent, wordIndex: number, delta: number) => {
		e.stopPropagation();
		onNudgeWord?.(wordIndex, delta);
	};

	const handleNudgeEnd = (e: React.MouseEvent, wordIndex: number, delta: number) => {
		e.stopPropagation();
		onNudgeWordEnd?.(wordIndex, delta);
	};

	const handleStartEdit = (e: React.MouseEvent, idx: number, currentTime: number) => {
		e.stopPropagation();
		setEditingIdx(idx);
		setEditingEndIdx(null);
		setEditValue(formatTimeMs(currentTime));
	};

	const handleStartEditEnd = (e: React.MouseEvent, idx: number, currentTime: number) => {
		e.stopPropagation();
		setEditingEndIdx(idx);
		setEditingIdx(null);
		setEditValue(formatTimeMs(currentTime));
	};

	const handleCommitEdit = (idx: number) => {
		const parsed = parseTimeMs(editValue);
		if (parsed !== null) {
			onSetWordTime?.(idx, parsed);
		}
		setEditingIdx(null);
	};

	const handleCommitEditEnd = (idx: number) => {
		const parsed = parseTimeMs(editValue);
		if (parsed !== null) {
			onSetWordEndTime?.(idx, parsed);
		}
		setEditingEndIdx(null);
	};

	const handleKeyDownEdit = (e: React.KeyboardEvent, idx: number) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			handleCommitEdit(idx);
		} else if (e.key === "Escape") {
			e.preventDefault();
			setEditingIdx(null);
		} else if (e.key === "Tab") {
			e.preventDefault();
			setEditValue(formatTimeMs(currentTime));
		}
	};

	const handleKeyDownEditEnd = (e: React.KeyboardEvent, idx: number) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			handleCommitEditEnd(idx);
		} else if (e.key === "Escape") {
			e.preventDefault();
			setEditingEndIdx(null);
		} else if (e.key === "Tab") {
			e.preventDefault();
			setEditValue(formatTimeMs(currentTime));
		}
	};

	const handleNudgeLine = (e: React.MouseEvent, delta: number) => {
		e.stopPropagation();
		onNudgeLine?.(delta);
	};

	const handleStartEditLine = (e: React.MouseEvent, currentTime: number) => {
		e.stopPropagation();
		setEditingLine(true);
		setEditValue(formatTimeMs(currentTime));
	};

	const handleCommitEditLine = () => {
		const parsed = parseTimeMs(editValue);
		if (parsed !== null) {
			onSetLineTime?.(parsed);
		}
		setEditingLine(false);
	};

	const handleKeyDownEditLine = (e: React.KeyboardEvent) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			handleCommitEditLine();
		} else if (e.key === "Escape") {
			e.preventDefault();
			setEditingLine(false);
		} else if (e.key === "Tab") {
			e.preventDefault();
			setEditValue(formatTimeMs(currentTime));
		}
	};

	return (
		<div
			ref={lineRef}
			// biome-ignore lint/a11y/useSemanticElements: contains nested buttons for nudge controls
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
			className={`flex items-start gap-3 px-4 py-2 w-full text-left cursor-pointer transition-colors hover:bg-composer-button/50 border-l-2 ${
				isCurrent ? "bg-composer-accent/10 border-composer-accent" : "border-transparent"
			}`}
		>
			<span className="w-8 mt-1 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums">
				{lineNumber}
			</span>
			{granularity === "line" ? (
				<div className="flex items-start justify-between flex-1 gap-2">
					{editMode && lineBegin !== undefined && lineEnd !== undefined ? (
						(() => {
							const isActive = currentTime >= lineBegin && currentTime < lineEnd;
							const isCompleted = lineEnd > lineBegin && currentTime >= lineEnd;
							const progress = isActive
								? (currentTime - lineBegin) / (lineEnd - lineBegin)
								: isCompleted
									? 1
									: 0;
							return (
								<span className="relative inline-block">
									<span className="text-composer-text-muted">{text}</span>
									<span
										className="absolute inset-0 overflow-hidden text-composer-accent-text"
										style={{ width: `${progress * 100}%` }}
									>
										{text}
									</span>
								</span>
							);
						})()
					) : (
						<span
							className={
								lineBegin !== undefined ? "text-composer-text-muted" : "text-composer-text"
							}
						>
							{text}
						</span>
					)}
					{lineBegin !== undefined && (
						<span className="flex items-center gap-1 font-mono text-[10px] tabular-nums shrink-0">
							<button
								type="button"
								onClick={(e) => handleNudgeLine(e, -NUDGE_AMOUNT)}
								className="px-1 cursor-pointer text-composer-text-muted hover:text-composer-text"
							>
								-
							</button>
							{editingLine ? (
								<input
									type="text"
									value={editValue}
									onChange={(e) => setEditValue(e.target.value)}
									onBlur={handleCommitEditLine}
									onKeyDown={handleKeyDownEditLine}
									onClick={(e) => e.stopPropagation()}
									// biome-ignore lint/a11y/noAutofocus: intentional focus on user-initiated edit
									autoFocus
									className="w-16 px-1 text-center border rounded select-text bg-composer-bg-elevated border-composer-accent text-composer-accent-text"
								/>
							) : (
								<button
									type="button"
									onClick={(e) => handleStartEditLine(e, lineBegin)}
									className="text-composer-accent-text hover:underline cursor-text"
								>
									{formatTimeMs(lineBegin)}
								</button>
							)}
							<button
								type="button"
								onClick={(e) => handleNudgeLine(e, NUDGE_AMOUNT)}
								className="px-1 cursor-pointer text-composer-text-muted hover:text-composer-text"
							>
								+
							</button>
						</span>
					)}
				</div>
			) : (
				<div className="flex flex-wrap flex-1 gap-x-3 gap-y-1">
					{wordTexts.map((word, idx) => {
						const timing = words?.[idx];
						const isSynced = !!timing;
						const isEditingBegin = editingIdx === idx;
						const isEditingEnd = editingEndIdx === idx;

						// Calculate disabled states for buttons
						const prevWord = words?.[idx - 1];
						const nextWord = words?.[idx + 1];
						const minBegin = prevWord?.end ?? 0;
						const maxBegin = timing?.end ?? 0;
						const minEnd = timing?.begin ?? 0;
						const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;

						const canDecreaseBegin = timing && timing.begin > minBegin;
						const canIncreaseBegin = timing && timing.begin < maxBegin;
						const canDecreaseEnd = timing && timing.end > minEnd;
						const canIncreaseEnd = timing && timing.end < maxEnd;

						// Calculate preview progress for edit mode
						const isWordActive = timing && currentTime >= timing.begin && currentTime < timing.end;
						const isWordCompleted =
							timing && timing.end > timing.begin && currentTime >= timing.end;
						const wordProgress = isWordActive
							? (currentTime - timing.begin) / (timing.end - timing.begin)
							: isWordCompleted
								? 1
								: 0;

						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: word order is fixed in lyrics
							<span key={`${lineNumber}-${idx}`} className="inline-flex flex-col items-start">
								{editMode && isSynced ? (
									<span className="relative inline-block">
										<span className="text-composer-text-muted">{word}</span>
										<span
											className="absolute inset-0 overflow-hidden text-composer-accent-text"
											style={{ width: `${wordProgress * 100}%` }}
										>
											{word}
										</span>
									</span>
								) : (
									<span className={isSynced ? "text-composer-text-muted" : "text-composer-text"}>
										{word}
									</span>
								)}
								{isSynced && (
									<span className="flex items-center gap-1 font-mono text-[10px] tabular-nums">
										<button
											type="button"
											onClick={(e) => canDecreaseBegin && handleNudge(e, idx, -NUDGE_AMOUNT)}
											className={`px-1 ${
												canDecreaseBegin
													? "text-composer-text-muted hover:text-composer-text cursor-pointer"
													: "text-composer-text-muted/30 cursor-not-allowed"
											}`}
										>
											-
										</button>
										{isEditingBegin ? (
											<input
												type="text"
												value={editValue}
												onChange={(e) => setEditValue(e.target.value)}
												onBlur={() => handleCommitEdit(idx)}
												onKeyDown={(e) => handleKeyDownEdit(e, idx)}
												onClick={(e) => e.stopPropagation()}
												// biome-ignore lint/a11y/noAutofocus: intentional focus on user-initiated edit
												autoFocus
												className="w-16 px-1 text-center border rounded select-text bg-composer-bg-elevated border-composer-accent text-composer-accent-text"
											/>
										) : (
											<button
												type="button"
												onClick={(e) => handleStartEdit(e, idx, timing.begin)}
												className="text-composer-accent-text hover:underline cursor-text"
											>
												{formatTimeMs(timing.begin)}
											</button>
										)}
										<button
											type="button"
											onClick={(e) => canIncreaseBegin && handleNudge(e, idx, NUDGE_AMOUNT)}
											className={`px-1 ${
												canIncreaseBegin
													? "text-composer-text-muted hover:text-composer-text cursor-pointer"
													: "text-composer-text-muted/30 cursor-not-allowed"
											}`}
										>
											+
										</button>
										<span className="text-composer-text-muted mx-0.5">→</span>
										<button
											type="button"
											onClick={(e) => canDecreaseEnd && handleNudgeEnd(e, idx, -NUDGE_AMOUNT)}
											className={`px-1 ${
												canDecreaseEnd
													? "text-composer-text-muted hover:text-composer-text cursor-pointer"
													: "text-composer-text-muted/30 cursor-not-allowed"
											}`}
										>
											-
										</button>
										{isEditingEnd ? (
											<input
												type="text"
												value={editValue}
												onChange={(e) => setEditValue(e.target.value)}
												onBlur={() => handleCommitEditEnd(idx)}
												onKeyDown={(e) => handleKeyDownEditEnd(e, idx)}
												onClick={(e) => e.stopPropagation()}
												// biome-ignore lint/a11y/noAutofocus: intentional focus on user-initiated edit
												autoFocus
												className="w-16 px-1 text-center border rounded select-text bg-composer-bg-elevated border-composer-accent text-composer-accent-text"
											/>
										) : (
											<button
												type="button"
												onClick={(e) => handleStartEditEnd(e, idx, timing.end)}
												className="text-composer-accent-text hover:underline cursor-text"
											>
												{formatTimeMs(timing.end)}
											</button>
										)}
										<button
											type="button"
											onClick={(e) => canIncreaseEnd && handleNudgeEnd(e, idx, NUDGE_AMOUNT)}
											className={`px-1 ${
												canIncreaseEnd
													? "text-composer-text-muted hover:text-composer-text cursor-pointer"
													: "text-composer-text-muted/30 cursor-not-allowed"
											}`}
										>
											+
										</button>
									</span>
								)}
							</span>
						);
					})}
				</div>
			)}
		</div>
	);
};

const EmptyState: React.FC<{ message: string; hint: string }> = ({ message, hint }) => (
	<div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
		<p className="text-lg text-composer-text-secondary">{message}</p>
		<p className="text-sm text-composer-text-muted">{hint}</p>
	</div>
);

const SyncPanel: React.FC = () => {
	const lines = useProjectStore((s) => s.lines);
	const updateLine = useProjectStore((s) => s.updateLine);
	const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);
	const undo = useProjectStore((s) => s.undo);
	const redo = useProjectStore((s) => s.redo);
	const granularity = useProjectStore((s) => s.granularity);
	const setGranularity = useProjectStore((s) => s.setGranularity);
	const source = useAudioStore((s) => s.source);
	const currentTime = useAudioStore((s) => s.currentTime);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

	const [syncState, setSyncState] = useState<SyncState>({
		position: { lineIndex: 0, wordIndex: 0 },
		isActive: false,
	});
	const [showPulse, setShowPulse] = useState(false);
	const [editMode, setEditMode] = useState(false);

	const totalWords = useMemo(() => getTotalWords(lines), [lines]);
	const syncedWords = useMemo(() => getSyncedWordCount(lines), [lines]);
	const syncedLines = useMemo(() => getSyncedLineCount(lines), [lines]);

	const progressText =
		granularity === "word" ? `${syncedWords}/${totalWords}` : `${syncedLines}/${lines.length}`;

	// Find the line index that's currently being played based on currentTime
	const playingLineIndex = useMemo(() => {
		// First, find if we're within any line's timing
		for (let i = 0; i < lines.length; i++) {
			const timing = getLineTiming(lines[i]);
			if (timing && currentTime >= timing.begin && currentTime < timing.end) {
				return i;
			}
		}
		// If not in any line, find the last line that started before currentTime
		for (let i = lines.length - 1; i >= 0; i--) {
			const timing = getLineTiming(lines[i]);
			if (timing && currentTime >= timing.end) {
				return i;
			}
		}
		// Find the next upcoming line
		for (let i = 0; i < lines.length; i++) {
			const timing = getLineTiming(lines[i]);
			if (timing && currentTime < timing.begin) {
				return i;
			}
		}
		return -1;
	}, [lines, currentTime]);

	const { lineIndex, wordIndex } = syncState.position;
	const currentLine = lines[lineIndex];
	const prevLine = lines[lineIndex - 1];

	const currentLineWords = currentLine ? splitIntoWords(currentLine.text) : [];
	const currentWord = currentLineWords[wordIndex];
	const isComplete = lineIndex >= lines.length && lines.length > 0;

	const lastSyncedTime = useMemo(() => {
		if (granularity === "line") {
			if (prevLine?.begin !== undefined) return prevLine.begin;
			return undefined;
		}
		if (!currentLine?.words?.length) {
			if (prevLine?.words?.length) {
				return prevLine.words[prevLine.words.length - 1]?.begin;
			}
			return undefined;
		}
		return currentLine.words[currentLine.words.length - 1]?.begin;
	}, [granularity, currentLine?.words, prevLine?.words, prevLine?.begin]);

	const handleTapWord = useCallback(() => {
		if (lines.length === 0 || isComplete) return;

		const line = lines[lineIndex];
		if (!line) return;

		const lineWords = splitIntoWords(line.text);
		const wordText = lineWords[wordIndex];
		if (!wordText) return;

		const existingWords = line.words ?? [];

		// Set end time on previous word
		if (existingWords.length > 0) {
			const updatedWords = [...existingWords];
			updatedWords[updatedWords.length - 1] = {
				...updatedWords[updatedWords.length - 1],
				end: currentTime,
			};
			// Add new word
			updatedWords.push({
				text: wordText,
				begin: currentTime,
				end: currentTime,
			});
			updateLineWithHistory(line.id, { words: updatedWords });
		} else {
			// First word of line
			updateLineWithHistory(line.id, {
				words: [{ text: wordText, begin: currentTime, end: currentTime }],
			});
		}

		// Also set end time on last word of previous line if this is first word of current line
		if (wordIndex === 0 && prevLine?.words?.length) {
			const prevWords = [...prevLine.words];
			prevWords[prevWords.length - 1] = {
				...prevWords[prevWords.length - 1],
				end: currentTime,
			};
			updateLine(prevLine.id, { words: prevWords });
		}

		setShowPulse(true);
		setTimeout(() => setShowPulse(false), 100);

		// Advance to next word or line
		const nextWordIndex = wordIndex + 1;
		if (nextWordIndex >= lineWords.length) {
			setSyncState((prev) => ({
				...prev,
				position: { lineIndex: lineIndex + 1, wordIndex: 0 },
			}));
		} else {
			setSyncState((prev) => ({
				...prev,
				position: { ...prev.position, wordIndex: nextWordIndex },
			}));
		}
	}, [
		lines,
		lineIndex,
		wordIndex,
		currentTime,
		updateLine,
		updateLineWithHistory,
		isComplete,
		prevLine,
	]);

	const handleTapLine = useCallback(() => {
		if (lines.length === 0 || isComplete) return;

		const line = lines[lineIndex];
		if (!line) return;

		// Set end time on previous line
		if (prevLine?.begin !== undefined) {
			updateLine(prevLine.id, { end: currentTime });
		}

		// Set begin time on current line
		updateLineWithHistory(line.id, { begin: currentTime, end: currentTime });

		setShowPulse(true);
		setTimeout(() => setShowPulse(false), 100);

		// Advance to next line
		setSyncState((prev) => ({
			...prev,
			position: { lineIndex: lineIndex + 1, wordIndex: 0 },
		}));
	}, [lines, lineIndex, currentTime, updateLine, updateLineWithHistory, isComplete, prevLine]);

	const handleTap = granularity === "word" ? handleTapWord : handleTapLine;

	const handleReset = useCallback(() => {
		for (const line of lines) {
			updateLine(line.id, {
				words: undefined,
				begin: undefined,
				end: undefined,
			});
		}
		setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: false });
	}, [lines, updateLine]);

	const handleStartSync = useCallback(() => {
		setSyncState({ position: { lineIndex: 0, wordIndex: 0 }, isActive: true });
		setIsPlaying(true);
	}, [setIsPlaying]);

	const handleJumpToLine = useCallback((index: number) => {
		setSyncState((prev) => ({
			...prev,
			position: { lineIndex: index, wordIndex: 0 },
		}));
	}, []);

	const handleNudgeWord = useCallback(
		(lineIdx: number, wordIdx: number, delta: number) => {
			const line = lines[lineIdx];
			if (!line?.words?.[wordIdx]) return;

			const updatedWords = [...line.words];
			const word = updatedWords[wordIdx];
			const prevWord = updatedWords[wordIdx - 1];
			const minBegin = prevWord?.end ?? 0;
			const newBegin = Math.min(word.end, Math.max(minBegin, word.begin + delta));

			updatedWords[wordIdx] = { ...word, begin: newBegin };
			updateLineWithHistory(line.id, { words: updatedWords });
		},
		[lines, updateLineWithHistory],
	);

	const handleSetWordTime = useCallback(
		(lineIdx: number, wordIdx: number, newBegin: number) => {
			const line = lines[lineIdx];
			if (!line?.words?.[wordIdx]) return;

			const updatedWords = [...line.words];
			const word = updatedWords[wordIdx];
			const prevWord = updatedWords[wordIdx - 1];
			const minBegin = prevWord?.end ?? 0;
			const clampedBegin = Math.min(word.end, Math.max(minBegin, newBegin));
			updatedWords[wordIdx] = { ...word, begin: clampedBegin };
			updateLineWithHistory(line.id, { words: updatedWords });
		},
		[lines, updateLineWithHistory],
	);

	const handleNudgeWordEnd = useCallback(
		(lineIdx: number, wordIdx: number, delta: number) => {
			const line = lines[lineIdx];
			if (!line?.words?.[wordIdx]) return;

			const updatedWords = [...line.words];
			const word = updatedWords[wordIdx];
			const nextWord = updatedWords[wordIdx + 1];
			const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;
			const newEnd = Math.min(maxEnd, Math.max(word.begin, word.end + delta));

			updatedWords[wordIdx] = { ...word, end: newEnd };
			updateLineWithHistory(line.id, { words: updatedWords });
		},
		[lines, updateLineWithHistory],
	);

	const handleSetWordEndTime = useCallback(
		(lineIdx: number, wordIdx: number, newEnd: number) => {
			const line = lines[lineIdx];
			if (!line?.words?.[wordIdx]) return;

			const updatedWords = [...line.words];
			const word = updatedWords[wordIdx];
			const nextWord = updatedWords[wordIdx + 1];
			const maxEnd = nextWord?.begin ?? Number.POSITIVE_INFINITY;
			const clampedEnd = Math.min(maxEnd, Math.max(word.begin, newEnd));
			updatedWords[wordIdx] = { ...word, end: clampedEnd };
			updateLineWithHistory(line.id, { words: updatedWords });
		},
		[lines, updateLineWithHistory],
	);

	const handleNudgeLine = useCallback(
		(lineIdx: number, delta: number) => {
			const line = lines[lineIdx];
			if (line?.begin === undefined) return;

			const newBegin = Math.max(0, line.begin + delta);
			const duration = (line.end ?? line.begin) - line.begin;
			updateLineWithHistory(line.id, {
				begin: newBegin,
				end: newBegin + duration,
			});
		},
		[lines, updateLineWithHistory],
	);

	const handleSetLineTime = useCallback(
		(lineIdx: number, newBegin: number) => {
			const line = lines[lineIdx];
			if (line?.begin === undefined) return;

			const duration = (line.end ?? line.begin) - line.begin;
			updateLineWithHistory(line.id, {
				begin: newBegin,
				end: newBegin + duration,
			});
		},
		[lines, updateLineWithHistory],
	);

	const handleNudgeLastSynced = useCallback(
		(delta: number) => {
			if (granularity === "line") {
				// Find the last synced line
				for (let i = lines.length - 1; i >= 0; i--) {
					if (lines[i].begin !== undefined) {
						handleNudgeLine(i, delta);
						return;
					}
				}
			} else {
				// Find the last synced word across all lines
				for (let i = lines.length - 1; i >= 0; i--) {
					const line = lines[i];
					if (line.words?.length) {
						const lastWordIdx = line.words.length - 1;
						handleNudgeWord(i, lastWordIdx, delta);
						return;
					}
				}
			}
		},
		[granularity, lines, handleNudgeWord, handleNudgeLine],
	);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				// Don't trigger sync in edit mode
				if (editMode) return;
				if (!syncState.isActive && lines.length > 0) {
					handleStartSync();
				} else if (isPlaying) {
					handleTap();
				}
			} else if (e.code === "Enter" && !e.repeat) {
				e.preventDefault();
				setIsPlaying(!isPlaying);
			} else if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && !e.repeat) {
				e.preventDefault();
				if (e.shiftKey) {
					redo();
				} else {
					undo();
				}
			} else if (e.code === "ArrowLeft" && !e.repeat) {
				e.preventDefault();
				handleNudgeLastSynced(-NUDGE_AMOUNT);
			} else if (e.code === "ArrowRight" && !e.repeat) {
				e.preventDefault();
				handleNudgeLastSynced(NUDGE_AMOUNT);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		syncState.isActive,
		lines.length,
		handleStartSync,
		handleTap,
		isPlaying,
		setIsPlaying,
		undo,
		redo,
		handleNudgeLastSynced,
		editMode,
	]);

	// Show scrollable view when paused or in edit mode
	const showScrollableView = !isPlaying || editMode;

	if (!source) {
		return (
			<div className="flex flex-col flex-1 p-4">
				<EmptyState message="No audio loaded" hint="Import audio in the Import tab first" />
			</div>
		);
	}

	if (lines.length === 0) {
		return (
			<div className="flex flex-col flex-1 p-4">
				<EmptyState message="No lyrics to sync" hint="Add lyrics in the Edit tab first" />
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 overflow-hidden select-none">
			{/* Header */}
			<div className="flex items-center justify-between px-6 py-4 border-b border-composer-border">
				<div className="flex items-baseline gap-3">
					<h2 className="text-lg font-medium">Sync</h2>
					<span className="font-mono text-sm text-composer-text-muted tabular-nums">
						{progressText}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex h-8 rounded-lg bg-composer-bg-elevated p-0.5">
						<button
							type="button"
							onClick={() => setGranularity("line")}
							className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
								granularity === "line"
									? "bg-composer-button text-composer-text"
									: "text-composer-text-muted hover:text-composer-text"
							}`}
						>
							Line
						</button>
						<button
							type="button"
							onClick={() => setGranularity("word")}
							className={`px-3 text-sm rounded-md transition-colors cursor-pointer ${
								granularity === "word"
									? "bg-composer-button text-composer-text"
									: "text-composer-text-muted hover:text-composer-text"
							}`}
						>
							Word
						</button>
					</div>
					<button
						type="button"
						onClick={() => setEditMode(!editMode)}
						className={`flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg transition-colors cursor-pointer ${
							editMode
								? "bg-composer-accent-dark hover:bg-composer-accent"
								: "bg-composer-button hover:bg-composer-button-hover"
						}`}
						title={editMode ? "Unlock sync mode" : "Lock to edit mode"}
					>
						{editMode ? <IconLock className="w-4 h-4" /> : <IconLockOpen className="w-4 h-4" />}
						Edit
					</button>
					{syncState.isActive && !editMode && (
						<button
							type="button"
							onClick={handleReset}
							className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg bg-composer-button hover:bg-composer-button-hover transition-colors cursor-pointer"
						>
							<IconRefresh className="w-4 h-4" />
							Reset
						</button>
					)}
					{!syncState.isActive && !editMode && (
						<button
							type="button"
							onClick={handleStartSync}
							className="flex items-center gap-1.5 h-8 px-3 text-sm rounded-lg bg-composer-accent-dark hover:bg-composer-accent transition-colors cursor-pointer"
						>
							<IconPlayerPlayFilled className="w-4 h-4" />
							Start
						</button>
					)}
				</div>
			</div>

			{/* Main sync area */}
			{showScrollableView ? (
				// Scrollable list when paused
				<div className="flex-1 overflow-y-auto">
					<div className="py-2">
						{lines.map((line, index) => {
							const timing = getLineTiming(line);
							return (
								<ScrollableLine
									key={line.id}
									text={line.text}
									lineNumber={index + 1}
									isCurrent={editMode ? index === playingLineIndex : index === lineIndex}
									words={line.words}
									lineBegin={timing?.begin}
									lineEnd={timing?.end}
									granularity={granularity}
									currentTime={currentTime}
									editMode={editMode}
									onClick={() => handleJumpToLine(index)}
									onNudgeWord={(wordIdx, delta) => handleNudgeWord(index, wordIdx, delta)}
									onSetWordTime={(wordIdx, newBegin) => handleSetWordTime(index, wordIdx, newBegin)}
									onNudgeWordEnd={(wordIdx, delta) => handleNudgeWordEnd(index, wordIdx, delta)}
									onSetWordEndTime={(wordIdx, newEnd) =>
										handleSetWordEndTime(index, wordIdx, newEnd)
									}
									onNudgeLine={(delta) => handleNudgeLine(index, delta)}
									onSetLineTime={(newBegin) => handleSetLineTime(index, newBegin)}
								/>
							);
						})}
					</div>
				</div>
			) : (
				// Focused view when playing or not started
				<div className="flex flex-col items-center justify-center flex-1 px-8 py-12">
					{isComplete ? (
						<div className="text-center">
							<motion.div
								className="mb-2 text-2xl font-medium"
								variants={shimmerVariants}
								initial="initial"
								animate="animate"
								transition={shimmerTransition}
								style={{
									background:
										"linear-gradient(45deg, rgb(165, 180, 252) 0%, rgb(165, 180, 252) 40%, rgb(237, 240, 255) 50%, rgb(165, 180, 252) 60%, rgb(165, 180, 252) 100%)",
									backgroundSize: "200% 100%",
									backgroundClip: "text",
									WebkitBackgroundClip: "text",
									color: "transparent",
								}}
							>
								Sync complete!
							</motion.div>
							<div className="text-composer-text-muted">Proceed to Preview to review your work</div>
						</div>
					) : (
						<SyncCarousel
							lines={lines}
							lineIndex={lineIndex}
							wordIndex={wordIndex}
							granularity={granularity}
						/>
					)}
				</div>
			)}

			{/* Bottom panel */}
			<div className="px-6 py-4 border-t border-composer-border bg-composer-bg-dark">
				<div className="flex items-center justify-between">
					{/* Timing display */}
					<TimingDisplay currentTime={currentTime} lastSyncedTime={lastSyncedTime} />

					{/* Tap indicator */}
					{!isComplete && isPlaying && (
						<div className="flex items-center gap-4">
							{currentWord && (
								<span className="text-xl font-medium text-composer-text">{currentWord}</span>
							)}
							<motion.div
								variants={syncPulseVariants}
								animate={showPulse ? "pulse" : "idle"}
								transition={syncCarouselTransition}
								className="flex items-center justify-center border-2 rounded-full w-14 h-14 bg-composer-bg-elevated"
							>
								<span className="text-xs font-medium text-composer-text-muted">Space</span>
							</motion.div>
						</div>
					)}

					{/* Paused hint */}
					{!isComplete && !isPlaying && syncState.isActive && (
						<div className="text-sm text-composer-text-muted">
							Paused ・ Click a line to jump, or play to continue
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

// -- Exports ------------------------------------------------------------------

export { SyncPanel };
