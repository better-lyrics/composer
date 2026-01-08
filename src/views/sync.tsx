import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import type { WordTiming } from "@/stores/project";
import {
	shimmerTransition,
	shimmerVariants,
	syncCarouselTransition,
	syncPulseVariants,
} from "@/utils/animationVariants";
import { IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
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

function getTotalWords(lines: { text: string }[]): number {
	return lines.reduce((acc, line) => acc + splitIntoWords(line.text).length, 0);
}

function getSyncedWordCount(lines: { words?: WordTiming[] }[]): number {
	return lines.reduce((acc, line) => acc + (line.words?.length ?? 0), 0);
}

// -- Components ---------------------------------------------------------------

const LINE_HEIGHT = 100;

const SyncCarousel: React.FC<{
	lines: Array<{ id: string; text: string; words?: WordTiming[] }>;
	lineIndex: number;
	wordIndex: number;
}> = ({ lines, lineIndex, wordIndex }) => {
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
								{splitIntoWords(line.text).map((word, widx) => {
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
								})}
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

const ScrollableLine: React.FC<{
	text: string;
	lineNumber: number;
	isCurrent: boolean;
	words?: WordTiming[];
	onClick: () => void;
}> = ({ text, lineNumber, isCurrent, words, onClick }) => {
	const lineRef = useRef<HTMLButtonElement>(null);
	const wordTexts = useMemo(() => splitIntoWords(text), [text]);

	useEffect(() => {
		if (isCurrent && lineRef.current) {
			lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}, [isCurrent]);

	return (
		<button
			ref={lineRef}
			type="button"
			onClick={onClick}
			className={`flex items-start gap-3 px-4 py-2 w-full text-left cursor-pointer transition-colors hover:bg-composer-button/50 ${
				isCurrent ? "bg-composer-accent/10 border-l-2 border-composer-accent" : ""
			}`}
		>
			<span className="w-8 mt-1 font-mono text-xs text-right shrink-0 text-composer-text-muted tabular-nums">
				{lineNumber}
			</span>
			<div className="flex flex-wrap flex-1 gap-x-3 gap-y-1">
				{wordTexts.map((word, idx) => {
					const timing = words?.[idx];
					const isSynced = !!timing;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: word order is fixed in lyrics
						<span key={`${lineNumber}-${idx}`} className="inline-flex flex-col items-start">
							<span className={isSynced ? "text-composer-text-muted" : "text-composer-text"}>
								{word}
							</span>
							{isSynced && (
								<span className="font-mono text-[10px] text-composer-accent-text tabular-nums">
									{formatTimeMs(timing.begin)}
								</span>
							)}
						</span>
					);
				})}
			</div>
		</button>
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
	const source = useAudioStore((s) => s.source);
	const currentTime = useAudioStore((s) => s.currentTime);
	const isPlaying = useAudioStore((s) => s.isPlaying);
	const setIsPlaying = useAudioStore((s) => s.setIsPlaying);

	const [syncState, setSyncState] = useState<SyncState>({
		position: { lineIndex: 0, wordIndex: 0 },
		isActive: false,
	});
	const [showPulse, setShowPulse] = useState(false);

	const totalWords = useMemo(() => getTotalWords(lines), [lines]);
	const syncedWords = useMemo(() => getSyncedWordCount(lines), [lines]);

	const { lineIndex, wordIndex } = syncState.position;
	const currentLine = lines[lineIndex];
	const prevLine = lines[lineIndex - 1];

	const currentLineWords = currentLine ? splitIntoWords(currentLine.text) : [];
	const currentWord = currentLineWords[wordIndex];
	const isComplete = lineIndex >= lines.length && lines.length > 0;

	const lastSyncedTime = useMemo(() => {
		if (!currentLine?.words?.length) {
			if (prevLine?.words?.length) {
				return prevLine.words[prevLine.words.length - 1]?.begin;
			}
			return undefined;
		}
		return currentLine.words[currentLine.words.length - 1]?.begin;
	}, [currentLine?.words, prevLine?.words]);

	const handleTap = useCallback(() => {
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
				end: currentTime, // Will be updated when next word is tapped
			});
			updateLine(line.id, { words: updatedWords });
		} else {
			// First word of line
			updateLine(line.id, {
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
	}, [lines, lineIndex, wordIndex, currentTime, updateLine, isComplete, prevLine]);

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

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				if (!syncState.isActive && lines.length > 0) {
					handleStartSync();
				} else if (isPlaying) {
					handleTap();
				}
			} else if (e.code === "Enter" && !e.repeat) {
				e.preventDefault();
				setIsPlaying(!isPlaying);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [syncState.isActive, lines.length, handleStartSync, handleTap, isPlaying, setIsPlaying]);

	// Show scrollable view when paused (regardless of sync state)
	const showScrollableView = !isPlaying;

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
						{syncedWords}/{totalWords}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{syncState.isActive && (
						<button
							type="button"
							onClick={handleReset}
							className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-composer-button hover:bg-composer-button-hover transition-colors cursor-pointer"
						>
							<IconRefresh className="w-4 h-4" />
							Reset
						</button>
					)}
					{!syncState.isActive && (
						<button
							type="button"
							onClick={handleStartSync}
							className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-composer-accent-dark hover:bg-composer-accent transition-colors cursor-pointer"
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
						{lines.map((line, index) => (
							<ScrollableLine
								key={line.id}
								text={line.text}
								lineNumber={index + 1}
								isCurrent={index === lineIndex}
								words={line.words}
								onClick={() => handleJumpToLine(index)}
							/>
						))}
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
						<SyncCarousel lines={lines} lineIndex={lineIndex} wordIndex={wordIndex} />
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
							Paused ・ click a line to jump, or play to continue
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

// -- Exports ------------------------------------------------------------------

export { SyncPanel };
