import { decodeFileToFloat32, floatChannelsToWavBlob, TARGET_SAMPLE_RATE } from "@/audio/separation/audio-codec";
import { computeInstrumental } from "@/audio/separation/derived-stems";
import { SeparationWorker } from "@/audio/separation/worker-host";
import { Controls, FileSlot } from "@/pages/diagnostics/separation-controls";
import {
  computeOverallLag,
  computePerChunkLag,
  drawOverlaidWaveforms,
} from "@/pages/diagnostics/separation-diagnostics";
import { type Diagnostics, DiagnosticsResults, PLOT_DURATION_SEC } from "@/pages/diagnostics/separation-results";
import { useSettingsStore } from "@/stores/settings";
import { ClientOnly } from "@/ui/client-only";
import { useEffect, useRef, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[SeparationDiag]";

// -- Types --------------------------------------------------------------------

interface DecodedFile {
  name: string;
  channels: Float32Array[];
  sampleRate: number;
  numFrames: number;
}

interface ProcessOutput {
  vocals: Float32Array[];
  instrumental: Float32Array[];
}

type Phase =
  | { kind: "idle" }
  | { kind: "decoding" }
  | { kind: "decoded"; file: DecodedFile }
  | { kind: "initializing"; file: DecodedFile; loaded: number; total: number }
  | { kind: "ready"; file: DecodedFile }
  | { kind: "processing"; file: DecodedFile; processed: number; total: number }
  | { kind: "done"; file: DecodedFile; output: ProcessOutput }
  | { kind: "error"; message: string };

// -- Helpers ------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function phaseFile(phase: Phase): DecodedFile | undefined {
  if ("file" in phase) return phase.file;
  return undefined;
}

// -- Panel --------------------------------------------------------------------

const DiagnosticsPanel: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const workerRef = useRef<SeparationWorker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const variant = useSettingsStore((s) => s.vocalModelVariant);

  useEffect(() => {
    return () => {
      workerRef.current?.dispose();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase.kind !== "done") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { file, output } = phase;
    drawOverlaidWaveforms(
      canvas,
      [
        { label: "original", color: "rgba(160, 160, 160, 0.9)", samples: file.channels[0] },
        { label: "vocals", color: "rgba(100, 200, 255, 0.9)", samples: output.vocals[0] },
        { label: "instrumental", color: "rgba(255, 180, 100, 0.9)", samples: output.instrumental[0] },
      ],
      file.sampleRate,
      PLOT_DURATION_SEC,
    );
  }, [phase]);

  const handleFile = async (file: File) => {
    setPhase({ kind: "decoding" });
    setDiagnostics(null);
    try {
      const decoded = await decodeFileToFloat32(file);
      setPhase({
        kind: "decoded",
        file: {
          name: file.name,
          channels: decoded.channels,
          sampleRate: decoded.sampleRate,
          numFrames: decoded.numFrames,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${LOG_PREFIX} decode failed`, err);
      setPhase({ kind: "error", message: `Decode failed: ${message}` });
    }
  };

  const handleInit = async () => {
    if (phase.kind !== "decoded" && phase.kind !== "ready") return;
    const file = phase.file;
    setPhase({ kind: "initializing", file, loaded: 0, total: 0 });
    try {
      const worker = new SeparationWorker();
      workerRef.current = worker;
      await worker.init({
        variant,
        onProgress: (loaded, total) => {
          setPhase({ kind: "initializing", file, loaded, total });
        },
      });
      setPhase({ kind: "ready", file });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${LOG_PREFIX} init failed`, err);
      setPhase({ kind: "error", message: `Init failed: ${message}` });
    }
  };

  const handleRun = async () => {
    if (phase.kind !== "ready") return;
    const worker = workerRef.current;
    if (!worker) {
      setPhase({ kind: "error", message: "Worker not initialised." });
      return;
    }
    const file = phase.file;
    setPhase({ kind: "processing", file, processed: 0, total: 0 });
    try {
      const result = await worker.process({
        channels: file.channels,
        totalFrames: file.numFrames,
        onProgress: (processed, total) => {
          setPhase({ kind: "processing", file, processed, total });
        },
      });
      const instrumental = computeInstrumental(file.channels, result.vocals);
      const vocalsLag = computeOverallLag(file.channels, result.vocals);
      const instrumentalLag = computeOverallLag(file.channels, instrumental);
      const perChunkLag = computePerChunkLag(file.channels, result.vocals);
      setDiagnostics({ vocalsLag, instrumentalLag, perChunkLag });
      setPhase({ kind: "done", file, output: { vocals: result.vocals, instrumental } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${LOG_PREFIX} process failed`, err);
      setPhase({ kind: "error", message: `Process failed: ${message}` });
    } finally {
      workerRef.current = null;
    }
  };

  const handleReset = () => {
    workerRef.current?.dispose();
    workerRef.current = null;
    setPhase({ kind: "idle" });
    setDiagnostics(null);
  };

  const handleDownloadVocals = () => {
    if (phase.kind !== "done") return;
    const blob = floatChannelsToWavBlob(phase.output.vocals, phase.file.sampleRate);
    triggerDownload(blob, `${phase.file.name.replace(/\.[^.]+$/, "")}.vocals.wav`);
  };

  const handleDownloadInstrumental = () => {
    if (phase.kind !== "done") return;
    const blob = floatChannelsToWavBlob(phase.output.instrumental, phase.file.sampleRate);
    triggerDownload(blob, `${phase.file.name.replace(/\.[^.]+$/, "")}.instrumental.wav`);
  };

  const busy = phase.kind === "decoding" || phase.kind === "initializing" || phase.kind === "processing";
  const initProgress = phase.kind === "initializing" ? { loaded: phase.loaded, total: phase.total } : null;
  const processProgress = phase.kind === "processing" ? { processed: phase.processed, total: phase.total } : null;

  return (
    <div className="min-h-screen bg-composer-bg text-composer-text p-6 select-none">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Separation Diagnostic</h1>
          <p className="text-xs text-composer-text-muted select-text cursor-text">
            Dev-only. Drop a stereo audio file, init the model, run separation, and inspect stage-by-stage timing
            offsets between original, vocals, and instrumental. Sample rate forced to {TARGET_SAMPLE_RATE} Hz.
          </p>
        </header>

        <FileSlot phase={{ kind: phase.kind, file: phaseFile(phase) }} busy={busy} onFile={handleFile} />

        <Controls
          variant={variant}
          canInit={phase.kind === "decoded"}
          canRun={phase.kind === "ready"}
          initBusy={phase.kind === "initializing"}
          runBusy={phase.kind === "processing"}
          decoding={phase.kind === "decoding"}
          initProgress={initProgress}
          processProgress={processProgress}
          onInit={handleInit}
          onRun={handleRun}
          onReset={handleReset}
        />

        {phase.kind === "error" && (
          <div className="rounded-md border border-composer-border bg-composer-button p-3">
            <p className="text-xs text-composer-error-text select-text cursor-text break-all">{phase.message}</p>
          </div>
        )}

        {phase.kind === "done" && diagnostics && (
          <DiagnosticsResults
            diagnostics={diagnostics}
            sampleRate={phase.file.sampleRate}
            canvasRef={canvasRef}
            onDownloadVocals={handleDownloadVocals}
            onDownloadInstrumental={handleDownloadInstrumental}
          />
        )}
      </div>
    </div>
  );
};

// -- Page Shell ---------------------------------------------------------------

const DiagnosticsFallback: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-composer-bg text-composer-text-muted text-sm">
    Loading diagnostics
  </div>
);

const SeparationDiagnosticPage: React.FC = () => {
  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen bg-composer-bg text-composer-text flex items-center justify-center p-6">
        <p className="text-sm text-composer-text-muted">Not available in production.</p>
      </div>
    );
  }
  return (
    <ClientOnly fallback={<DiagnosticsFallback />}>
      <DiagnosticsPanel />
    </ClientOnly>
  );
};

// -- Exports ------------------------------------------------------------------

export default SeparationDiagnosticPage;
export { DiagnosticsPanel };
