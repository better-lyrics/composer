import { useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import { Button } from "@/ui/button";
import { IconChevronDown, IconChevronUp, IconClipboard, IconDownload } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// -- Interfaces ----------------------------------------------------------------

interface DriftSample {
  performanceTime: number;
  audioTime: number;
  wallElapsedSinceSessionStart: number;
  audioElapsedSinceSessionStart: number;
  wallDriftMs: number;
  contextTime: number;
  contextOutputTime: number;
  contextOutputPerformanceTime: number;
  playbackRate: number;
  readyState: number;
  networkState: number;
  seeking: boolean;
  paused: boolean;
  rms: number;
  audibleMediaPosition: number | null;
  audibleVsDisplayedMs: number | null;
  documentVisible: boolean;
}

type AudioEventKind =
  | "seeking"
  | "seeked"
  | "play"
  | "pause"
  | "ended"
  | "waiting"
  | "stalled"
  | "ratechange"
  | "visibilitychange";

interface AudioEvent {
  kind: AudioEventKind;
  performanceTime: number;
  audioTime: number;
  audioTimePrev: number | null;
  documentVisible: boolean;
  detail?: Record<string, unknown>;
}

interface SeekTransient {
  startedAt: string;
  seekingAt: { performanceTime: number; audioTimeBefore: number; audioTimeAfter: number } | null;
  seekedAt: { performanceTime: number; audioTime: number; latencyFromSeekingMs: number | null } | null;
  firstAudibleAt: {
    performanceTime: number;
    audioTime: number;
    latencyFromSeekedMs: number;
    rmsAtCrossing: number;
  } | null;
  samples: DriftSample[];
  sessionIndexBefore: number | null;
  sessionIndexAfter: number | null;
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
  events: AudioEvent[];
}

interface LiveMetrics {
  audioTime: number;
  contextTime: number;
  driftMs: number;
  driftRateMsPerMin: number;
  maxDriftMs: number;
  wallDriftMs: number;
  wallDriftRateMsPerMin: number;
  maxWallDriftMs: number;
  sampleCount: number;
  baseLatency: number;
  outputLatency: number;
  rms: number;
  audible: boolean;
  audibleVsDisplayedMs: number | null;
  lastSeekLatencyMs: number | null;
  lastSeekDistanceSec: number | null;
}

interface NavigatorWithExtras extends Navigator {
  connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  deviceMemory?: number;
}

interface RingEntry {
  performanceTime: number;
  audioTime: number;
  paused: boolean;
  playbackRate: number;
}

// -- Constants -----------------------------------------------------------------

const SAMPLE_INTERVAL_MS = 100;
const SEEK_HIGHFREQ_INTERVAL_MS = 16;
const SEEK_HIGHFREQ_WINDOW_MS = 1500;
const RING_BUFFER_SIZE = 512;
const ANALYSER_FFT_SIZE = 2048;
const RMS_AUDIBLE_THRESHOLD = 0.005;
const LOG_PREFIX = "[DriftDiagnostic]";
const REPORT_VERSION = 3;

const INITIAL_METRICS: LiveMetrics = {
  audioTime: 0,
  contextTime: 0,
  driftMs: 0,
  driftRateMsPerMin: 0,
  maxDriftMs: 0,
  wallDriftMs: 0,
  wallDriftRateMsPerMin: 0,
  maxWallDriftMs: 0,
  sampleCount: 0,
  baseLatency: 0,
  outputLatency: 0,
  rms: 0,
  audible: false,
  audibleVsDisplayedMs: null,
  lastSeekLatencyMs: null,
  lastSeekDistanceSec: null,
};

// -- Component -----------------------------------------------------------------

const AudioDriftDiagnostic: React.FC = () => {
  const audioElement = useAudioStore((s) => s.audioElement);
  const source = useAudioStore((s) => s.source);

  const [collapsed, setCollapsed] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>(INITIAL_METRICS);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserBufferRef = useRef<Uint8Array | null>(null);

  const sessionsRef = useRef<DriftSession[]>([]);
  const activeSessionRef = useRef<DriftSession | null>(null);
  const maxDriftRef = useRef(0);
  const maxWallDriftRef = useRef(0);

  const ringBufferRef = useRef<RingEntry[]>([]);
  const ringHeadRef = useRef(0);

  const seekTransientsRef = useRef<SeekTransient[]>([]);
  const activeSeekTransientRef = useRef<SeekTransient | null>(null);
  const seekHighFreqUntilRef = useRef(0);
  const lastSeekLatencyRef = useRef<number | null>(null);
  const lastSeekDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioElement) return;

    let ctx: AudioContext;
    let sourceNode: MediaElementAudioSourceNode;
    let analyser: AnalyserNode;
    try {
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        ctxRef.current = new AudioContext();
      }
      ctx = ctxRef.current;
      sourceNode = ctx.createMediaElementSource(audioElement);
      sourceNode.connect(ctx.destination);
      analyser = ctx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      sourceNode.connect(analyser);
      sourceNodeRef.current = sourceNode;
      analyserRef.current = analyser;
      analyserBufferRef.current = new Uint8Array(analyser.fftSize);
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

    const pushRing = (performanceTime: number, audioTime: number, paused: boolean, playbackRate: number) => {
      const buf = ringBufferRef.current;
      const entry: RingEntry = { performanceTime, audioTime, paused, playbackRate };
      if (buf.length < RING_BUFFER_SIZE) {
        buf.push(entry);
      } else {
        buf[ringHeadRef.current] = entry;
        ringHeadRef.current = (ringHeadRef.current + 1) % RING_BUFFER_SIZE;
      }
    };

    const lookupAudioAt = (targetPerfTime: number): number | null => {
      const buf = ringBufferRef.current;
      if (buf.length === 0) return null;
      let bestDelta = Number.POSITIVE_INFINITY;
      let bestEntry: RingEntry | null = null;
      for (let i = 0; i < buf.length; i++) {
        const d = Math.abs(buf[i].performanceTime - targetPerfTime);
        if (d < bestDelta) {
          bestDelta = d;
          bestEntry = buf[i];
        }
      }
      if (!bestEntry) return null;
      if (bestEntry.paused) return bestEntry.audioTime;
      return bestEntry.audioTime + ((targetPerfTime - bestEntry.performanceTime) / 1000) * bestEntry.playbackRate;
    };

    const readRms = (): number => {
      const a = analyserRef.current;
      const data = analyserBufferRef.current;
      if (!a || !data) return 0;
      try {
        a.getByteTimeDomainData(data);
      } catch {
        return 0;
      }
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSq += v * v;
      }
      return Math.sqrt(sumSq / data.length);
    };

    const recordSample = (audio: HTMLAudioElement, audioCtx: AudioContext) => {
      const performanceTime = performance.now();
      const audioTime = audio.currentTime;
      const contextTime = audioCtx.currentTime;
      const documentVisible = typeof document !== "undefined" ? !document.hidden : true;

      let contextOutputTime = 0;
      let contextOutputPerformanceTime = 0;
      try {
        const ts = audioCtx.getOutputTimestamp();
        contextOutputTime = ts.contextTime ?? 0;
        contextOutputPerformanceTime = ts.performanceTime ?? 0;
      } catch {
        // getOutputTimestamp unsupported (older safari)
      }

      const rms = readRms();
      pushRing(performanceTime, audioTime, audio.paused, audio.playbackRate);

      let audibleMediaPosition: number | null = null;
      let audibleVsDisplayedMs: number | null = null;
      if (contextOutputPerformanceTime > 0) {
        audibleMediaPosition = lookupAudioAt(contextOutputPerformanceTime);
        if (audibleMediaPosition !== null) {
          audibleVsDisplayedMs = (audibleMediaPosition - audioTime) * 1000;
        }
      }

      if (!activeSessionRef.current) {
        const newSession: DriftSession = {
          startedAt: new Date().toISOString(),
          startedAtPerformance: performanceTime,
          startedAtAudio: audioTime,
          startedAtContext: contextTime,
          source: describeSource(source),
          audioAtStart: snapshotAudio(audio),
          samples: [],
          events: [],
        };
        sessionsRef.current.push(newSession);
        activeSessionRef.current = newSession;
        maxDriftRef.current = 0;
        maxWallDriftRef.current = 0;
      }

      const session = activeSessionRef.current;
      const audioElapsed = audioTime - session.startedAtAudio;
      const contextElapsed = contextTime - session.startedAtContext;
      const wallElapsed = (performanceTime - session.startedAtPerformance) / 1000;

      const driftSeconds = audioElapsed - contextElapsed;
      const driftMs = driftSeconds * 1000;
      const absDriftMs = Math.abs(driftMs);
      if (absDriftMs > maxDriftRef.current) maxDriftRef.current = absDriftMs;

      const wallDriftSeconds = audioElapsed - wallElapsed;
      const wallDriftMs = wallDriftSeconds * 1000;
      const absWallDriftMs = Math.abs(wallDriftMs);
      if (absWallDriftMs > maxWallDriftRef.current) maxWallDriftRef.current = absWallDriftMs;

      const sample: DriftSample = {
        performanceTime,
        audioTime,
        wallElapsedSinceSessionStart: wallElapsed,
        audioElapsedSinceSessionStart: audioElapsed,
        wallDriftMs,
        contextTime,
        contextOutputTime,
        contextOutputPerformanceTime,
        playbackRate: audio.playbackRate,
        readyState: audio.readyState,
        networkState: audio.networkState,
        seeking: audio.seeking,
        paused: audio.paused,
        rms,
        audibleMediaPosition,
        audibleVsDisplayedMs,
        documentVisible,
      };
      session.samples.push(sample);

      const transient = activeSeekTransientRef.current;
      if (transient) {
        transient.samples.push(sample);
        if (!transient.firstAudibleAt && transient.seekedAt && rms >= RMS_AUDIBLE_THRESHOLD) {
          const latency = performanceTime - transient.seekedAt.performanceTime;
          transient.firstAudibleAt = {
            performanceTime,
            audioTime,
            latencyFromSeekedMs: latency,
            rmsAtCrossing: rms,
          };
          lastSeekLatencyRef.current = latency;
        }
        if (transient.firstAudibleAt && performanceTime >= seekHighFreqUntilRef.current) {
          transient.sessionIndexAfter = sessionsRef.current.length - 1;
          activeSeekTransientRef.current = null;
        }
      }

      const elapsedMinutes = wallElapsed / 60;
      const driftRateMsPerMin = elapsedMinutes > 0.05 ? driftMs / elapsedMinutes : 0;
      const wallDriftRateMsPerMin = elapsedMinutes > 0.05 ? wallDriftMs / elapsedMinutes : 0;

      setMetrics({
        audioTime,
        contextTime,
        driftMs,
        driftRateMsPerMin,
        maxDriftMs: maxDriftRef.current,
        wallDriftMs,
        wallDriftRateMsPerMin,
        maxWallDriftMs: maxWallDriftRef.current,
        sampleCount: session.samples.length,
        baseLatency: audioCtx.baseLatency ?? 0,
        outputLatency: audioCtx.outputLatency ?? 0,
        rms,
        audible: rms >= RMS_AUDIBLE_THRESHOLD,
        audibleVsDisplayedMs,
        lastSeekLatencyMs: lastSeekLatencyRef.current,
        lastSeekDistanceSec: lastSeekDistanceRef.current,
      });
    };

    const tick = (t: number) => {
      const inHighFreq = t < seekHighFreqUntilRef.current;
      const interval = inHighFreq ? SEEK_HIGHFREQ_INTERVAL_MS : SAMPLE_INTERVAL_MS;
      const shouldSample = t - lastSampleAt >= interval && (!audioElement.paused || inHighFreq);
      if (shouldSample) {
        lastSampleAt = t;
        recordSample(audioElement, ctx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const lastRingAudioBeforeEvent = (): number | null => {
      const buf = ringBufferRef.current;
      if (buf.length === 0) return null;
      let newest: RingEntry | null = null;
      for (let i = 0; i < buf.length; i++) {
        if (!newest || buf[i].performanceTime > newest.performanceTime) newest = buf[i];
      }
      return newest ? newest.audioTime : null;
    };

    const pushEvent = (kind: AudioEventKind, detail?: Record<string, unknown>) => {
      const session = activeSessionRef.current;
      if (!session) return;
      session.events.push({
        kind,
        performanceTime: performance.now(),
        audioTime: audioElement.currentTime,
        audioTimePrev: lastRingAudioBeforeEvent(),
        documentVisible: typeof document !== "undefined" ? !document.hidden : true,
        detail,
      });
    };

    const handleSeeking = () => {
      const performanceTime = performance.now();
      const audioTimeAfter = audioElement.currentTime;
      const audioTimeBefore = lastRingAudioBeforeEvent() ?? audioTimeAfter;
      const transient: SeekTransient = {
        startedAt: new Date().toISOString(),
        seekingAt: { performanceTime, audioTimeBefore, audioTimeAfter },
        seekedAt: null,
        firstAudibleAt: null,
        samples: [],
        sessionIndexBefore: activeSessionRef.current ? sessionsRef.current.length - 1 : null,
        sessionIndexAfter: null,
      };
      seekTransientsRef.current.push(transient);
      activeSeekTransientRef.current = transient;
      lastSeekDistanceRef.current = audioTimeAfter - audioTimeBefore;
      lastSeekLatencyRef.current = null;
      pushEvent("seeking", { audioTimeBefore, audioTimeAfter });
    };

    const handleSeeked = () => {
      const performanceTime = performance.now();
      const transient = activeSeekTransientRef.current;
      if (transient?.seekingAt) {
        transient.seekedAt = {
          performanceTime,
          audioTime: audioElement.currentTime,
          latencyFromSeekingMs: performanceTime - transient.seekingAt.performanceTime,
        };
      }
      seekHighFreqUntilRef.current = performanceTime + SEEK_HIGHFREQ_WINDOW_MS;
      pushEvent("seeked");
      activeSessionRef.current = null;
    };

    const handlePause = () => {
      pushEvent("pause");
      activeSessionRef.current = null;
    };
    const handlePlay = () => pushEvent("play");
    const handleEnded = () => pushEvent("ended");
    const handleWaiting = () => pushEvent("waiting");
    const handleStalled = () => pushEvent("stalled");
    const handleRateChange = () => pushEvent("ratechange", { playbackRate: audioElement.playbackRate });
    const handleVisibility = () =>
      pushEvent("visibilitychange", { hidden: typeof document !== "undefined" ? document.hidden : false });

    audioElement.addEventListener("seeking", handleSeeking);
    audioElement.addEventListener("seeked", handleSeeked);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("waiting", handleWaiting);
    audioElement.addEventListener("stalled", handleStalled);
    audioElement.addEventListener("ratechange", handleRateChange);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(raf);
      audioElement.removeEventListener("play", resumeContext);
      audioElement.removeEventListener("seeking", handleSeeking);
      audioElement.removeEventListener("seeked", handleSeeked);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("waiting", handleWaiting);
      audioElement.removeEventListener("stalled", handleStalled);
      audioElement.removeEventListener("ratechange", handleRateChange);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVisibility);
      try {
        sourceNode.disconnect();
      } catch {
        // node may already be disconnected if context was lost
      }
      try {
        analyser.disconnect();
      } catch {
        // analyser may already be disconnected
      }
      sourceNodeRef.current = null;
      analyserRef.current = null;
      analyserBufferRef.current = null;
      activeSessionRef.current = null;
      activeSeekTransientRef.current = null;
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
      analyser: {
        fftSize: analyserRef.current?.fftSize ?? null,
        audibleRmsThreshold: RMS_AUDIBLE_THRESHOLD,
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
      seekTransients: seekTransientsRef.current,
    };
  }, [audioElement, metrics, source]);

  const downloadJson = useCallback((json: string) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `composer-drift-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

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
      downloadJson(json);
      toast.success("Clipboard blocked, downloaded the file instead. Send that to Boidu.");
    }
  }, [buildReport, downloadJson]);

  const handleDownload = useCallback(() => {
    if (sessionsRef.current.length === 0) {
      toast.error("Play some audio first, nothing's been captured yet.");
      return;
    }
    const json = JSON.stringify(buildReport(), null, 2);
    downloadJson(json);
    toast.success("Report downloaded. Send the JSON file to Boidu.");
  }, [buildReport, downloadJson]);

  const handleReset = useCallback(() => {
    sessionsRef.current = [];
    seekTransientsRef.current = [];
    activeSessionRef.current = null;
    activeSeekTransientRef.current = null;
    ringBufferRef.current = [];
    ringHeadRef.current = 0;
    lastSeekLatencyRef.current = null;
    lastSeekDistanceRef.current = null;
    maxDriftRef.current = 0;
    maxWallDriftRef.current = 0;
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
              label="audible (rms)"
              value={`${metrics.audible ? "Y" : "N"} ${metrics.rms.toFixed(4)}`}
              emphasis={!metrics.audible}
            />
            <DiagRow
              label="audible vs displayed"
              value={
                metrics.audibleVsDisplayedMs === null
                  ? "n/a"
                  : `${metrics.audibleVsDisplayedMs >= 0 ? "+" : ""}${metrics.audibleVsDisplayedMs.toFixed(1)}ms`
              }
              emphasis={metrics.audibleVsDisplayedMs !== null && Math.abs(metrics.audibleVsDisplayedMs) > 100}
            />
            <DiagRow
              label="last seek lag"
              value={metrics.lastSeekLatencyMs === null ? "n/a" : `${metrics.lastSeekLatencyMs.toFixed(1)}ms`}
              emphasis={metrics.lastSeekLatencyMs !== null && metrics.lastSeekLatencyMs > 100}
            />
            <DiagRow
              label="last seek distance"
              value={
                metrics.lastSeekDistanceSec === null
                  ? "n/a"
                  : `${metrics.lastSeekDistanceSec >= 0 ? "+" : ""}${metrics.lastSeekDistanceSec.toFixed(2)}s`
              }
            />
            <DiagRow
              label="audio - wall drift"
              value={`${metrics.wallDriftMs >= 0 ? "+" : ""}${metrics.wallDriftMs.toFixed(1)}ms`}
              emphasis={Math.abs(metrics.wallDriftMs) > 50}
            />
            <DiagRow
              label="audio - wall rate"
              value={`${metrics.wallDriftRateMsPerMin >= 0 ? "+" : ""}${metrics.wallDriftRateMsPerMin.toFixed(1)}ms/min`}
              emphasis={Math.abs(metrics.wallDriftRateMsPerMin) > 20}
            />
            <DiagRow
              label="max |wall drift|"
              value={`${metrics.maxWallDriftMs.toFixed(1)}ms`}
              emphasis={metrics.maxWallDriftMs > 100}
            />
            <DiagRow
              label="audio - context drift"
              value={`${metrics.driftMs >= 0 ? "+" : ""}${metrics.driftMs.toFixed(1)}ms`}
              emphasis={Math.abs(metrics.driftMs) > 50}
            />
            <DiagRow label="samples" value={String(metrics.sampleCount)} />
            <DiagRow label="base latency" value={`${(metrics.baseLatency * 1000).toFixed(1)}ms`} />
            <DiagRow label="output latency" value={`${(metrics.outputLatency * 1000).toFixed(1)}ms`} />
          </div>

          <p className="text-[10px] text-composer-text/60 leading-snug mb-2 select-text">
            Play the song. If the highlighted word ends up ahead of (or behind) what you hear, especially after jumping
            around the timeline, hit Copy report (or Download) and send it to Boidu.
          </p>

          <div className="flex items-center gap-2">
            <Button variant="primary" hasIcon onClick={handleCopy} className="flex-1 text-xs">
              <IconClipboard className="w-3.5 h-3.5" />
              Copy report
            </Button>
            <Button variant="secondary" hasIcon onClick={handleDownload} className="flex-1 text-xs">
              <IconDownload className="w-3.5 h-3.5" />
              Download
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button variant="secondary" onClick={handleReset} className="flex-1 text-xs">
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
