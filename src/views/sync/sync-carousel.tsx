import type { WordTiming } from "@/stores/project";
import { syncCarouselTransition } from "@/utils/animationVariants";
import { splitIntoWords } from "@/utils/sync-helpers";
import { motion } from "motion/react";

// -- Constants ----------------------------------------------------------------

const LINE_HEIGHT = 100;

// -- Interfaces ---------------------------------------------------------------

interface SyncCarouselProps {
	lines: Array<{
		id: string;
		text: string;
		words?: WordTiming[];
		begin?: number;
	}>;
	lineIndex: number;
	wordIndex: number;
	granularity: "line" | "word";
}

// -- Components ---------------------------------------------------------------

const SyncCarousel: React.FC<SyncCarouselProps> = ({
	lines,
	lineIndex,
	wordIndex,
	granularity,
}) => {
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

// -- Exports ------------------------------------------------------------------

export { LINE_HEIGHT, SyncCarousel };
