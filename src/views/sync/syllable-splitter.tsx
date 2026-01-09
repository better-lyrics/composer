import type { SyllableTiming, WordTiming } from "@/stores/project";
import { TimeNudgeInput } from "@/views/sync/time-nudge-input";
import { IconArrowRight, IconScissors } from "@tabler/icons-react";
import { useCallback, useState } from "react";

// -- Interfaces ---------------------------------------------------------------

interface SyllableSplitterProps {
	word: WordTiming;
	currentTime: number;
	onSplit: (syllables: SyllableTiming[]) => void;
	onNudgeSyllable: (syllableIdx: number, delta: number) => void;
	onSetSyllableTime: (syllableIdx: number, newBegin: number) => void;
	onNudgeSyllableEnd: (syllableIdx: number, delta: number) => void;
	onSetSyllableEndTime: (syllableIdx: number, newEnd: number) => void;
}

// -- Helpers ------------------------------------------------------------------

function distributeTiming(
	text: string,
	splitPoints: number[],
	begin: number,
	end: number,
): SyllableTiming[] {
	const syllables: string[] = [];
	let lastIdx = 0;

	const sortedPoints = [...splitPoints].sort((a, b) => a - b);
	for (const point of sortedPoints) {
		if (point > lastIdx && point < text.length) {
			syllables.push(text.slice(lastIdx, point));
			lastIdx = point;
		}
	}
	syllables.push(text.slice(lastIdx));

	const duration = end - begin;
	const charDuration = duration / text.length;

	let currentBegin = begin;
	return syllables.map((syllable) => {
		const syllableEnd = currentBegin + syllable.length * charDuration;
		const timing: SyllableTiming = {
			text: syllable,
			begin: currentBegin,
			end: syllableEnd,
		};
		currentBegin = syllableEnd;
		return timing;
	});
}

// -- Components ---------------------------------------------------------------

const SplitModeView: React.FC<{
	text: string;
	splitPoints: number[];
	onToggleSplit: (index: number) => void;
	onConfirm: () => void;
	onCancel: () => void;
}> = ({ text, splitPoints, onToggleSplit, onConfirm, onCancel }) => {
	const chars = text.split("");

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-1 text-lg tracking-wide">
				{chars.map((char, idx) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: character order is fixed in word
					<span key={idx} className="flex items-center">
						<span className="text-composer-text">{char}</span>
						{idx < chars.length - 1 && (
							<button
								type="button"
								onClick={() => onToggleSplit(idx + 1)}
								className={`w-3 h-6 flex items-center justify-center mx-0.5 rounded transition-colors cursor-pointer ${
									splitPoints.includes(idx + 1)
										? "bg-composer-accent text-white"
										: "bg-composer-bg-elevated hover:bg-composer-button text-composer-text-muted"
								}`}
								title={splitPoints.includes(idx + 1) ? "Remove split" : "Add split"}
							>
								<span className="text-xs font-bold">|</span>
							</button>
						)}
					</span>
				))}
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onConfirm}
					disabled={splitPoints.length === 0}
					className="px-2 py-1 text-xs rounded bg-composer-accent-dark hover:bg-composer-accent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
				>
					Split
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="px-2 py-1 text-xs rounded bg-composer-button hover:bg-composer-button-hover cursor-pointer transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	);
};

const SyllableTimingView: React.FC<{
	syllables: SyllableTiming[];
	currentTime: number;
	onNudge: (idx: number, delta: number) => void;
	onSetTime: (idx: number, newBegin: number) => void;
	onNudgeEnd: (idx: number, delta: number) => void;
	onSetEndTime: (idx: number, newEnd: number) => void;
}> = ({ syllables, currentTime, onNudge, onSetTime, onNudgeEnd, onSetEndTime }) => {
	return (
		<div className="flex flex-wrap gap-2">
			{syllables.map((syllable, idx) => {
				const prevSyllable = syllables[idx - 1];
				const nextSyllable = syllables[idx + 1];
				const minBegin = prevSyllable?.end ?? 0;
				const maxBegin = syllable.end;
				const minEnd = syllable.begin;
				const maxEnd = nextSyllable?.begin ?? Number.POSITIVE_INFINITY;

				const isActive = currentTime >= syllable.begin && currentTime < syllable.end;
				const isCompleted = syllable.end > syllable.begin && currentTime >= syllable.end;
				const progress = isActive
					? (currentTime - syllable.begin) / (syllable.end - syllable.begin)
					: isCompleted
						? 1
						: 0;

				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: syllable order is fixed in word
					<span key={idx} className="inline-flex flex-col items-start">
						<span className="relative inline-block">
							<span className="text-composer-text-muted">{syllable.text}</span>
							<span
								className="absolute inset-0 overflow-hidden text-composer-accent-text"
								style={{ width: `${progress * 100}%` }}
							>
								{syllable.text}
							</span>
						</span>
						<span className="flex items-center gap-1">
							<TimeNudgeInput
								value={syllable.begin}
								currentTime={currentTime}
								canDecrease={syllable.begin > minBegin}
								canIncrease={syllable.begin < maxBegin}
								onNudge={(delta) => onNudge(idx, delta)}
								onSetTime={(newBegin) => onSetTime(idx, newBegin)}
							/>
							<IconArrowRight className="w-2.5 h-2.5 text-composer-text opacity-25 mx-0.5" />
							<TimeNudgeInput
								value={syllable.end}
								currentTime={currentTime}
								canDecrease={syllable.end > minEnd}
								canIncrease={syllable.end < maxEnd}
								onNudge={(delta) => onNudgeEnd(idx, delta)}
								onSetTime={(newEnd) => onSetEndTime(idx, newEnd)}
							/>
						</span>
					</span>
				);
			})}
		</div>
	);
};

const SyllableSplitter: React.FC<SyllableSplitterProps> = ({
	word,
	currentTime,
	onSplit,
	onNudgeSyllable,
	onSetSyllableTime,
	onNudgeSyllableEnd,
	onSetSyllableEndTime,
}) => {
	const [isSplitMode, setIsSplitMode] = useState(false);
	const [splitPoints, setSplitPoints] = useState<number[]>([]);

	const handleToggleSplit = useCallback((index: number) => {
		setSplitPoints((prev) =>
			prev.includes(index) ? prev.filter((p) => p !== index) : [...prev, index],
		);
	}, []);

	const handleConfirmSplit = useCallback(() => {
		const syllables = distributeTiming(word.text, splitPoints, word.begin, word.end);
		onSplit(syllables);
		setIsSplitMode(false);
		setSplitPoints([]);
	}, [word.text, word.begin, word.end, splitPoints, onSplit]);

	const handleCancelSplit = useCallback(() => {
		setIsSplitMode(false);
		setSplitPoints([]);
	}, []);

	if (word.syllables?.length) {
		return (
			<SyllableTimingView
				syllables={word.syllables}
				currentTime={currentTime}
				onNudge={onNudgeSyllable}
				onSetTime={onSetSyllableTime}
				onNudgeEnd={onNudgeSyllableEnd}
				onSetEndTime={onSetSyllableEndTime}
			/>
		);
	}

	if (isSplitMode) {
		return (
			<SplitModeView
				text={word.text}
				splitPoints={splitPoints}
				onToggleSplit={handleToggleSplit}
				onConfirm={handleConfirmSplit}
				onCancel={handleCancelSplit}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setIsSplitMode(true)}
			className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-composer-bg-elevated hover:bg-composer-button text-composer-text-muted hover:text-composer-text transition-colors cursor-pointer"
			title="Split into syllables"
		>
			<IconScissors className="w-3 h-3" />
		</button>
	);
};

// -- Exports ------------------------------------------------------------------

export { SyllableSplitter };
