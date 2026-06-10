import { decodeFileToFloat32, floatChannelsToWavBlob, TARGET_SAMPLE_RATE } from "@/audio/separation/audio-codec";
import { computeInstrumental } from "@/audio/separation/derived-stems";
import { SeparationWorker } from "@/audio/separation/worker-host";
import { Controls, FileSlot, TrimPanel } from "@/pages/diagnostics/separation-controls";
import {
  computeOverallLag,
  computePerChunkLag,
  detectLeadingSilence,
  drawOverlaidWaveforms,
} from "@/pages/diagnostics/separation-diagnostics";
import { type Diagnostics, DiagnosticsResults, PLOT_DURATION_SEC } from "@/pages/diagnostics/separation-results";
import { useSettingsStore } from "@/stores/settings";
import { ClientOnly } from "@/ui/client-only";
import { useEffect, useRef, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[SeparationDiag]";
const TRIM_PRESETS: ReadonlyArray<{ label: string; samples: number }> = [
  { label: "0", samples: 0 },
  { label: "1105 (LAME CBR)", samples: 1105 },
  { label: "2257 (LAME VBR)", samples: 2257 },
];

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
  const [inputTrim, setInputTrim] = useState(0);
  const workerRef = useRef<SeparationWorker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const variant = useSettingsStore((s) => s.vocalModelVariant);
  const decodedFile = phaseFile(phase);
  const leadingSilence = decodedFile ? detectLeadingSilence(decodedFile.channels) : null;

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
    const trim = Math.max(0, Math.min(inputTrim, file.numFrames));
    const trimmedChannels = trim > 0 ? file.channels.map((c) => c.slice(trim)) : file.channels;
    const trimmedFrames = file.numFrames - trim;
    setPhase({ kind: "processing", file, processed: 0, total: 0 });
    try {
      const result = await worker.process({
        channels: trimmedChannels,
        totalFrames: trimmedFrames,
        onProgress: (processed, total) => {
          setPhase({ kind: "processing", file, processed, total });
        },
      });
      const instrumental = computeInstrumental(trimmedChannels, result.vocals);
      const vocalsLag = computeOverallLag(trimmedChannels, result.vocals);
      const instrumentalLag = computeOverallLag(trimmedChannels, instrumental);
      const perChunkLag = computePerChunkLag(trimmedChannels, result.vocals);
      setDiagnostics({ vocalsLag, instrumentalLag, perChunkLag });
      const doneFile: DecodedFile = trim > 0 ? { ...file, channels: trimmedChannels, numFrames: trimmedFrames } : file;
      setPhase({ kind: "done", file: doneFile, output: { vocals: result.vocals, instrumental } });
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

        {decodedFile && (
          <TrimPanel
            inputTrim={inputTrim}
            sampleRate={decodedFile.sampleRate}
            maxTrim={decodedFile.numFrames}
            leadingSilence={leadingSilence}
            presets={TRIM_PRESETS}
            busy={busy}
            onChange={setInputTrim}
          />
        )}

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

const SeparationDiagnosticPage: React.FC = () => (
  <ClientOnly fallback={<DiagnosticsFallback />}>
    <DiagnosticsPanel />
  </ClientOnly>
);

// -- Exports ------------------------------------------------------------------

export default SeparationDiagnosticPage;
export { DiagnosticsPanel };
