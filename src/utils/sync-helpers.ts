import type { WordTiming } from "@/stores/project";

// -- Types --------------------------------------------------------------------

interface SyncPosition {
	lineIndex: number;
	wordIndex: number;
}

interface SyncState {
	position: SyncPosition;
	isActive: boolean;
}

interface LineTiming {
	begin: number;
	end: number;
}

// -- Constants ----------------------------------------------------------------

const NUDGE_AMOUNT = 0.05;

// -- Functions ----------------------------------------------------------------

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
}): LineTiming | null {
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

// -- Exports ------------------------------------------------------------------

export {
	NUDGE_AMOUNT,
	formatTimeMs,
	getLineTiming,
	getSyncedLineCount,
	getSyncedWordCount,
	getTotalWords,
	parseTimeMs,
	splitIntoWords,
};
export type { LineTiming, SyncPosition, SyncState };
