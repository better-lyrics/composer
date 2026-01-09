import { useAudioStore } from "@/stores/audio";
import { getAgentColor, type LyricLine, useProjectStore } from "@/stores/project";
import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

const LOG_PREFIX = "[TimelineWaveform]";
const TIME_UPDATE_INTERVAL_MS = 66;

function parseRegionId(id: string): { lineId: string; type: "word" | "bg" | "line"; index: number } | null {
  const wordMatch = id.match(/^(.+)-word-(\d+)$/);
  if (wordMatch) {
    return { lineId: wordMatch[1], type: "word", index: Number.parseInt(wordMatch[2], 10) };
  }
  const bgMatch = id.match(/^(.+)-bg-(\d+)$/);
  if (bgMatch) {
    return { lineId: bgMatch[1], type: "bg", index: Number.parseInt(bgMatch[2], 10) };
  }
  const lineMatch = id.match(/^(.+)-line$/);
  if (lineMatch) {
    return { lineId: lineMatch[1], type: "line", index: -1 };
  }
  return null;
}

function getLineTiming(line: LyricLine): { begin: number; end: number } | null {
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

const WAVEFORM_OPTIONS = {
  waveColor: "rgba(255, 255, 255, 0.3)",
  progressColor: "rgb(129, 140, 248)",
  cursorColor: "rgb(129, 140, 248)",
  cursorWidth: 2,
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  height: 120,
  normalize: true,
  hideScrollbar: true,
};

// -- Interfaces ----------------------------------------------------------------

interface WordSelection {
  lineId: string;
  lineIndex: number;
  wordIndex: number;
  type: "word" | "bg";
}

interface TimelineWaveformProps {
  lines: LyricLine[];
  rippleEnabled: boolean;
  granularity: "line" | "word";
  loopRegion: { start: number; end: number } | null;
  onLoopRegionChange?: (region: { start: number; end: number } | null) => void;
  onSelectWord?: (selection: WordSelection | null) => void;
}

// -- Component -----------------------------------------------------------------

const LOOP_REGION_ID = "loop-region";

const TimelineWaveform: React.FC<TimelineWaveformProps> = ({
  lines,
  rippleEnabled,
  granularity,
  loopRegion,
  onLoopRegionChange,
  onSelectWord,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const loadedSourceRef = useRef<File | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);
  const linesRef = useRef<LyricLine[]>(lines);
  const rippleEnabledRef = useRef(rippleEnabled);
  const granularityRef = useRef(granularity);
  const onLoopRegionChangeRef = useRef(onLoopRegionChange);

  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);

  const onSelectWordRef = useRef(onSelectWord);

  linesRef.current = lines;
  rippleEnabledRef.current = rippleEnabled;
  granularityRef.current = granularity;
  onLoopRegionChangeRef.current = onLoopRegionChange;
  onSelectWordRef.current = onSelectWord;

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || wsRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      ...WAVEFORM_OPTIONS,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;

    regions.enableDragSelection({
      color: "rgba(129, 140, 248, 0.2)",
    });

    regions.on("region-created", (region) => {
      // User-created regions (drag selection) don't have word/bg/line in their ID
      if (
        !region.id.includes("-word-") &&
        !region.id.includes("-bg-") &&
        !region.id.endsWith("-line") &&
        region.id !== LOOP_REGION_ID
      ) {
        onLoopRegionChangeRef.current?.({ start: region.start, end: region.end });
        region.remove();
      }
    });

    regions.on("region-clicked", (region) => {
      const parsed = parseRegionId(region.id);
      if (!parsed) return;

      // Only handle word/bg selection, not line regions
      if (parsed.type === "line") return;

      const currentLines = linesRef.current;
      const lineIndex = currentLines.findIndex((l) => l.id === parsed.lineId);
      if (lineIndex === -1) return;

      onSelectWordRef.current?.({
        lineId: parsed.lineId,
        lineIndex,
        wordIndex: parsed.index,
        type: parsed.type,
      });
    });

    ws.on("ready", () => {
      ws.setPlaybackRate(playbackRate);
    });

    ws.on("timeupdate", (time) => {
      const now = performance.now();
      if (now - lastTimeUpdateRef.current >= TIME_UPDATE_INTERVAL_MS) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(time);
      }
    });

    ws.on("seeking", (time) => setCurrentTime(time));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    ws.on("error", (err) => console.error(LOG_PREFIX, "Error:", err));

    wsRef.current = ws;

    // No cleanup needed - WaveSurfer instance lives for app lifetime
    // (Activity component preserves state, avoids unmount/remount issues)
  }, [playbackRate, setCurrentTime, setIsPlaying]);

  // Load audio file
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !source || source.type !== "file") return;
    if (loadedSourceRef.current === source.file) return;

    loadedSourceRef.current = source.file;
    const url = URL.createObjectURL(source.file);
    ws.load(url);

    return () => URL.revokeObjectURL(url);
  }, [source]);

  // Sync playback state
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    if (isPlaying && !ws.isPlaying()) {
      ws.play();
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause();
    }
  }, [isPlaying]);

  // Sync playback rate
  useEffect(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.setPlaybackRate(playbackRate);
    }
  }, [playbackRate]);

  // Sync seek from external changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.isPlaying()) return;

    const duration = ws.getDuration();
    if (duration > 0) {
      const wsTime = ws.getCurrentTime();
      if (Math.abs(wsTime - currentTime) > 0.1) {
        ws.seekTo(currentTime / duration);
      }
    }
  }, [currentTime]);

  // Render regions based on granularity and loop region
  useEffect(() => {
    const regions = regionsRef.current;
    const ws = wsRef.current;
    if (!regions || !ws || ws.getDuration() === 0) return;

    regions.clearRegions();

    if (granularity === "word") {
      for (const line of lines) {
        if (!line.words?.length) continue;

        const color = getAgentColor(line.agentId);

        for (let i = 0; i < line.words.length; i++) {
          const word = line.words[i];
          if (word.begin === word.end) continue;

          regions.addRegion({
            id: `${line.id}-word-${i}`,
            start: word.begin,
            end: word.end,
            content: word.text,
            color: `${color}40`,
            drag: true,
            resize: true,
          });
        }

        if (line.backgroundWords?.length) {
          for (let i = 0; i < line.backgroundWords.length; i++) {
            const bgWord = line.backgroundWords[i];
            if (bgWord.begin === bgWord.end) continue;

            regions.addRegion({
              id: `${line.id}-bg-${i}`,
              start: bgWord.begin,
              end: bgWord.end,
              content: bgWord.text,
              color: `${color}20`,
              drag: true,
              resize: true,
            });
          }
        }
      }
    } else {
      // Line markers
      for (const line of lines) {
        const timing = getLineTiming(line);
        if (!timing) continue;

        const color = getAgentColor(line.agentId);

        regions.addRegion({
          id: `${line.id}-line`,
          start: timing.begin,
          end: timing.end,
          content: line.text.slice(0, 20) + (line.text.length > 20 ? "..." : ""),
          color: `${color}40`,
          drag: true,
          resize: true,
        });
      }
    }

    // Render loop region if set
    if (loopRegion) {
      regions.addRegion({
        id: LOOP_REGION_ID,
        start: loopRegion.start,
        end: loopRegion.end,
        color: "rgba(129, 140, 248, 0.15)",
        drag: false,
        resize: false,
      });
    }
  }, [lines, granularity, loopRegion]);

  // Handle region drag updates
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;

    const handleRegionUpdated = (region: { id: string; start: number; end: number }) => {
      const parsed = parseRegionId(region.id);
      if (!parsed) return;

      const currentLines = linesRef.current;
      const line = currentLines.find((l) => l.id === parsed.lineId);
      if (!line) return;

      if (parsed.type === "word" && line.words) {
        const updatedWords = [...line.words];
        const word = updatedWords[parsed.index];
        const oldBegin = word.begin;
        const oldEnd = word.end;

        updatedWords[parsed.index] = {
          ...word,
          begin: region.start,
          end: region.end,
        };

        if (rippleEnabledRef.current) {
          if (region.start !== oldBegin && parsed.index > 0) {
            updatedWords[parsed.index - 1] = {
              ...updatedWords[parsed.index - 1],
              end: region.start,
            };
          }
          if (region.end !== oldEnd && parsed.index < updatedWords.length - 1) {
            updatedWords[parsed.index + 1] = {
              ...updatedWords[parsed.index + 1],
              begin: region.end,
            };
          }
        }

        updateLineWithHistory(line.id, { words: updatedWords });
      } else if (parsed.type === "bg" && line.backgroundWords) {
        const updatedWords = [...line.backgroundWords];
        const bgWord = updatedWords[parsed.index];
        const oldBegin = bgWord.begin;
        const oldEnd = bgWord.end;

        updatedWords[parsed.index] = {
          ...bgWord,
          begin: region.start,
          end: region.end,
        };

        if (rippleEnabledRef.current) {
          if (region.start !== oldBegin && parsed.index > 0) {
            updatedWords[parsed.index - 1] = {
              ...updatedWords[parsed.index - 1],
              end: region.start,
            };
          }
          if (region.end !== oldEnd && parsed.index < updatedWords.length - 1) {
            updatedWords[parsed.index + 1] = {
              ...updatedWords[parsed.index + 1],
              begin: region.end,
            };
          }
        }

        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
      } else if (parsed.type === "line") {
        updateLineWithHistory(line.id, {
          begin: region.start,
          end: region.end,
        });
      }
    };

    regions.on("region-updated", handleRegionUpdated);

    return () => {
      regions.un("region-updated", handleRegionUpdated);
    };
  }, [updateLineWithHistory]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const ws = wsRef.current;
    if (!ws) return;

    e.preventDefault();
    const currentZoom = ws.options.minPxPerSec ?? 50;
    const delta = e.deltaY > 0 ? -10 : 10;
    const newZoom = Math.max(10, Math.min(500, currentZoom + delta));
    ws.zoom(newZoom);
  }, []);

  if (!source) return null;

  return <div ref={containerRef} className="w-full h-32 cursor-pointer" onWheel={handleWheel} />;
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform };
export type { WordSelection };
