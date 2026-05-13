import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconChevronDown, IconChevronUp, IconClipboard } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// -- Interfaces ----------------------------------------------------------------

interface DriftSample {
  performanceTime: number;
  audioTime: number;
  contextTime: number;
  contextOutputTime: number;
  contextOutputPerformanceTime: number;
  playbackRate: number;
  readyState: number;
  networkState: number;
  seeking: boolean;
  paused: boolean;
}

interface AudioSnapshot {
  duration: number;
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  defaultPlaybackRate: number;
  volume: number;
  muted: boolean;
  networkState: number;
  readyState: number;
  crossOrigin: string | null;
  preservesPitch: boolean | null;
  error: { code: number; message: string } | null;
  buffered: Array<[number, number]>;
  played: Array<[number, number]>;
  seekable: Array<[number, number]>;
}

interface SourceDescriptor {
  kind: "file" | "youtube" | "unknown";
  label: string;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  fileLastModified: number | null;
  youtubeVideoId: string | null;
  youtubeResolved: boolean | null;
}

interface DriftSession {
  startedAt: string;
  startedAtPerformance: number;
  startedAtAudio: number;
  startedAtContext: number;
  source: SourceDescriptor;
  audioAtStart: AudioSnapshot | null;
  samples: DriftSample[];
}

interface LiveMetrics {
  audioTime: number;
  contextTime: number;
  driftMs: number;
  driftRateMsPerMin: number;
  maxDriftMs: number;
  sampleCount: number;
  baseLatency: number;
  outputLatency: number;
}

interface NavigatorWithExtras extends Navigator {
  connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  deviceMemory?: number;
}

// -- Constants -----------------------------------------------------------------

const SAMPLE_INTERVAL_MS = 100;
const LOG_PREFIX = "[DriftDiagnostic]";
const REPORT_VERSION = 1;

const INITIAL_METRICS: LiveMetrics = {
  audioTime: 0,
  contextTime: 0,
  driftMs: 0,
  driftRateMsPerMin: 0,
  maxDriftMs: 0,
  sampleCount: 0,
  baseLatency: 0,
  outputLatency: 0,
};

// -- Component -----------------------------------------------------------------

const AudioDriftDiagnostic: React.FC = () => {
  const audioElement = useAudioStore((s) => s.audioElement);
  const source = useAudioStore((s) => s.source);

  const [collapsed, setCollapsed] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL_METRICS);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sessionsRef = useRef<DriftSession[]>([]);
  const activeSessionRef = useRef<DriftSession | null>(null);
  const maxDriftRef = useRef(0);

  useEffect(() => {
    if (!audioElement) return;

    let ctx: AudioContext;
    let sourceNode: MediaElementAudioSourceNode;
    try {
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        ctxRef.current = new AudioContext();
      }
      ctx = ctxRef.current;
      sourceNode = ctx.createMediaElementSource(audioElement);
      sourceNode.connect(ctx.destination);
      sourceNodeRef.current = sourceNode;
    } catch (err) {
      console.error(LOG_PREFIX, "failed to instrument audio element", err);
      return;
    }

    const resumeContext = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    };
    audioElement.addEventListener("play", resumeContext);

    let raf = 0;
    let lastSampleAt = 0;

    const recordSample = (audio: HTMLAudioElement, audioCtx: AudioContext) => {
      const performanceTime = performance.now();
      const audioTime = audio.currentTime;
      const contextTime = audioCtx.currentTime;
      let contextOutputTime = 0;
      let contextOutputPerformanceTime = 0;
      try {
        const ts = audioCtx.getOutputTimestamp();
        contextOutputTime = ts.contextTime ?? 0;
        contextOutputPerformanceTime = ts.performanceTime ?? 0;
      } catch {
        // getOutputTimestamp unsupported (older safari)
      }

      const sample: DriftSample = {
        performanceTime,
        audioTime,
        contextTime,
        contextOutputTime,
        contextOutputPerformanceTime,
        playbackRate: audio.playbackRate,
        readyState: audio.readyState,
        networkState: audio.networkState,
        seeking: audio.seeking,
        paused: audio.paused,
      };

      if (!activeSessionRef.current) {
        const newSession: DriftSession = {
          startedAt: new Date().toISOString(),
          startedAtPerformance: performanceTime,
          startedAtAudio: audioTime,
          startedAtContext: contextTime,
          source: describeSource(source),
          audioAtStart: snapshotAudio(audio),
          samples: [],
        };
        sessionsRef.current.push(newSession);
        activeSessionRef.current = newSession;
        maxDriftRef.current = 0;
      }

      const session = activeSessionRef.current;
      session.samples.push(sample);

      const audioElapsed = audioTime - session.startedAtAudio;
      const contextElapsed = contextTime - session.startedAtContext;
      const driftSeconds = audioElapsed - contextElapsed;
      const driftMs = driftSeconds * 1000;
      const absDriftMs = Math.abs(driftMs);
      if (absDriftMs > maxDriftRef.current) maxDriftRef.current = absDriftMs;

      const elapsedMinutes = contextElapsed / 60;
      const driftRateMsPerMin = elapsedMinutes > 0.05 ? driftMs / elapsedMinutes : 0;

      setMetrics({
        audioTime,
        contextTime,
        driftMs,
        driftRateMsPerMin,
        maxDriftMs: maxDriftRef.current,
        sampleCount: session.samples.length,
        baseLatency: audioCtx.baseLatency ?? 0,
        outputLatency: audioCtx.outputLatency ?? 0,
      });
    };

    const tick = (t: number) => {
      if (t - lastSampleAt >= SAMPLE_INTERVAL_MS && !audioElement.paused) {
        lastSampleAt = t;
        recordSample(audioElement, ctx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const handlePause = () => {
      activeSessionRef.current = null;
    };
    const handleSeeked = () => {
      activeSessionRef.current = null;
    };
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("seeked", handleSeeked);

    return () => {
      cancelAnimationFrame(raf);
      audioElement.removeEventListener("play", resumeContext);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("seeked", handleSeeked);
      try {
        sourceNode.disconnect();
      } catch {
        // node may already be disconnected if context was lost
      }
      sourceNodeRef.current = null;
      activeSessionRef.current = null;
    };
  }, [audioElement, source]);

  const buildReport = useCallback(() => {
    const audio = audioElement;
    const project = useProjectStore.getState();
    return {
      version: REPORT_VERSION,
      generatedAt: new Date().toISOString(),
      environment: snapshotEnvironment(),
      audioContext: {
        sampleRate: ctxRef.current?.sampleRate ?? null,
        baseLatency: ctxRef.current?.baseLatency ?? null,
        outputLatency: ctxRef.current?.outputLatency ?? null,
        state: ctxRef.current?.state ?? null,
      },
      codecSupport: snapshotCodecSupport(audio),
      sourceAtReport: describeSource(source),
      audioAtReport: snapshotAudio(audio),
      project: {
        title: project.metadata.title ?? null,
        lineCount: project.lines.length,
        granularity: project.granularity,
        firstLineBegin: project.lines.find((l) => l.begin !== undefined)?.begin ?? null,
        lastLineEnd: [...project.lines].reverse().find((l) => l.end !== undefined)?.end ?? null,
      },
      liveMetricsAtReport: metrics,
      sessions: sessionsRef.current,
    };
  }, [audioElement, metrics, source]);

  const handleCopy = useCallback(async () => {
    if (sessionsRef.current.length === 0) {
      toast.error("Play some audio first, nothing's been captured yet.");
      return;
    }
    const json = JSON.stringify(buildReport(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Report copied. Paste it back to Boidu.");
    } catch (err) {
      console.error(LOG_PREFIX, "clipboard write failed, falling back to download", err);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `composer-drift-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Clipboard blocked, downloaded the file instead. Send that to Boidu.");
    }
  }, [buildReport]);

  const handleReset = useCallback(() => {
    sessionsRef.current = [];
    activeSessionRef.current = null;
    maxDriftRef.current = 0;
    setMetrics(INITIAL_METRICS);
    toast.success("Cleared. Next play starts a fresh session.");
  }, []);

  if (!source) return null;

  return (
    <div className="fixed top-16 right-3 z-[9999] w-80 rounded-md border border-composer-border bg-composer-bg-elevated shadow-lg select-none">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 cursor-pointer"
      >
        <span className="text-xs font-semibold">Audio sync debug</span>
        {collapsed ? (
          <IconChevronUp className="w-3.5 h-3.5 text-composer-text/60" />
        ) : (
          <IconChevronDown className="w-3.5 h-3.5 text-composer-text/60" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 border-t border-composer-border">
          <div className="py-2 text-[11px] font-mono space-y-0.5">
            <DiagRow label="audio time" value={`${metrics.audioTime.toFixed(3)}s`} />
            <DiagRow label="context time" value={`${metrics.contextTime.toFixed(3)}s`} />
            <DiagRow
              label="drift (audio - context)"
              value={`${metrics.driftMs >= 0 ? "+" : ""}${metrics.driftMs.toFixed(1)}ms`}
              emphasis={Math.abs(metrics.driftMs) > 50}
            />
            <DiagRow
              label="drift rate"
              value={`${metrics.driftRateMsPerMin >= 0 ? "+" : ""}${metrics.driftRateMsPerMin.toFixed(1)}ms/min`}
              emphasis={Math.abs(metrics.driftRateMsPerMin) > 20}
            />
            <DiagRow
              label="max abs drift"
              value={`${metrics.maxDriftMs.toFixed(1)}ms`}
              emphasis={metrics.maxDriftMs > 100}
            />
            <DiagRow label="samples" value={String(metrics.sampleCount)} />
            <DiagRow label="base latency" value={`${(metrics.baseLatency * 1000).toFixed(1)}ms`} />
            <DiagRow label="output latency" value={`${(metrics.outputLatency * 1000).toFixed(1)}ms`} />
          </div>

          <p className="text-[10px] text-composer-text/60 leading-snug mb-2 select-text">
            Play the song for a minute or two. If the highlighted word on the timeline ends up clearly ahead of (or
            behind) the lyric you can actually hear, hit Copy report and paste it back to Boidu.
          </p>

          <div className="flex items-center gap-2">
            <Button variant="primary" hasIcon onClick={handleCopy} className="flex-1 text-xs">
              <IconClipboard className="w-3.5 h-3.5" />
              Copy report
            </Button>
            <Button variant="secondary" onClick={handleReset} className="text-xs">
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const DiagRow: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({ label, value, emphasis }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-composer-text/60">{label}</span>
    <span className={emphasis ? "text-amber-300" : "text-composer-text"}>{value}</span>
  </div>
);

// -- Helpers ------------------------------------------------------------------

function describeSource(source: ReturnType<typeof useAudioStore.getState>["source"]): SourceDescriptor {
  if (!source) {
    return {
      kind: "unknown",
      label: "none",
      fileName: null,
      fileSize: null,
      fileMimeType: null,
      fileLastModified: null,
      youtubeVideoId: null,
      youtubeResolved: null,
    };
  }
  if (source.type === "file") {
    return {
      kind: "file",
      label: `file:${source.file.name}`,
      fileName: source.file.name,
      fileSize: source.file.size,
      fileMimeType: source.file.type || null,
      fileLastModified: source.file.lastModified,
      youtubeVideoId: null,
      youtubeResolved: null,
    };
  }
  if (source.type === "youtube") {
    return {
      kind: "youtube",
      label: `youtube:${source.videoId}`,
      fileName: source.file?.name ?? null,
      fileSize: source.file?.size ?? null,
      fileMimeType: source.file?.type ?? null,
      fileLastModified: source.file?.lastModified ?? null,
      youtubeVideoId: source.videoId,
      youtubeResolved: !!source.file,
    };
  }
  return {
    kind: "unknown",
    label: "unknown",
    fileName: null,
    fileSize: null,
    fileMimeType: null,
    fileLastModified: null,
    youtubeVideoId: null,
    youtubeResolved: null,
  };
}

function snapshotCodecSupport(audio: HTMLAudioElement | null): Record<string, string> | null {
  if (!audio) return null;
  const types = [
    "audio/mpeg",
    "audio/mp4",
    'audio/mp4; codecs="mp4a.40.2"',
    "audio/aac",
    "audio/wav",
    "audio/flac",
    "audio/ogg",
    'audio/ogg; codecs="opus"',
    'audio/ogg; codecs="vorbis"',
    'audio/webm; codecs="opus"',
    'audio/webm; codecs="vorbis"',
  ];
  const out: Record<string, string> = {};
  for (const t of types) {
    try {
      out[t] = audio.canPlayType(t);
    } catch {
      out[t] = "error";
    }
  }
  return out;
}

function timeRangesToArray(tr: TimeRanges | null): Array<[number, number]> {
  if (!tr) return [];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < tr.length; i++) out.push([tr.start(i), tr.end(i)]);
  return out;
}

function snapshotAudio(audio: HTMLAudioElement | null): AudioSnapshot | null {
  if (!audio) return null;
  return {
    duration: audio.duration,
    currentTime: audio.currentTime,
    paused: audio.paused,
    playbackRate: audio.playbackRate,
    defaultPlaybackRate: audio.defaultPlaybackRate,
    volume: audio.volume,
    muted: audio.muted,
    networkState: audio.networkState,
    readyState: audio.readyState,
    crossOrigin: audio.crossOrigin,
    preservesPitch: typeof audio.preservesPitch === "boolean" ? audio.preservesPitch : null,
    error: audio.error ? { code: audio.error.code, message: audio.error.message } : null,
    buffered: timeRangesToArray(audio.buffered),
    played: timeRangesToArray(audio.played),
    seekable: timeRangesToArray(audio.seekable),
  };
}

function snapshotEnvironment() {
  const nav = navigator as NavigatorWithExtras;
  const conn = nav.connection;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    languages: Array.from(navigator.languages),
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: nav.deviceMemory ?? null,
    connection: conn
      ? {
          effectiveType: conn.effectiveType ?? null,
          downlink: conn.downlink ?? null,
          rtt: conn.rtt ?? null,
        }
      : null,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio,
    },
    timeOrigin: performance.timeOrigin,
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  };
}

// -- Exports ------------------------------------------------------------------

export { AudioDriftDiagnostic };
