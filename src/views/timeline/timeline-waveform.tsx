import { useAudioStore } from "@/stores/audio";
import { getAgentColor, type LyricLine, useProjectStore } from "@/stores/project";
import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

const LOG_PREFIX = "[TimelineWaveform]";
const TIME_UPDATE_INTERVAL_MS = 66;

function parseRegionId(id: string): { lineId: string; type: "word" | "bg"; index: number } | null {
  const wordMatch = id.match(/^(.+)-word-(\d+)$/);
  if (wordMatch) {
    return { lineId: wordMatch[1], type: "word", index: Number.parseInt(wordMatch[2], 10) };
  }
  const bgMatch = id.match(/^(.+)-bg-(\d+)$/);
  if (bgMatch) {
    return { lineId: bgMatch[1], type: "bg", index: Number.parseInt(bgMatch[2], 10) };
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

interface TimelineWaveformProps {
  lines: LyricLine[];
}

// -- Component -----------------------------------------------------------------

const TimelineWaveform: React.FC<TimelineWaveformProps> = ({ lines }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const loadedSourceRef = useRef<File | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);
  const linesRef = useRef<LyricLine[]>(lines);

  const source = useAudioStore((s) => s.source);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime);
  const setIsPlaying = useAudioStore((s) => s.setIsPlaying);
  const updateLineWithHistory = useProjectStore((s) => s.updateLineWithHistory);

  linesRef.current = lines;

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || wsRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      ...WAVEFORM_OPTIONS,
    });

    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;

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

    return () => {
      regionsRef.current = null;
      ws.destroy();
      wsRef.current = null;
    };
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

  // Render word regions
  useEffect(() => {
    const regions = regionsRef.current;
    const ws = wsRef.current;
    if (!regions || !ws || ws.getDuration() === 0) return;

    regions.clearRegions();

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
  }, [lines]);

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
        updatedWords[parsed.index] = {
          ...updatedWords[parsed.index],
          begin: region.start,
          end: region.end,
        };
        updateLineWithHistory(line.id, { words: updatedWords });
      } else if (parsed.type === "bg" && line.backgroundWords) {
        const updatedWords = [...line.backgroundWords];
        updatedWords[parsed.index] = {
          ...updatedWords[parsed.index],
          begin: region.start,
          end: region.end,
        };
        updateLineWithHistory(line.id, { backgroundWords: updatedWords });
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

  return <div ref={containerRef} className="w-full cursor-pointer" onWheel={handleWheel} />;
};

// -- Exports -------------------------------------------------------------------

export { TimelineWaveform };
