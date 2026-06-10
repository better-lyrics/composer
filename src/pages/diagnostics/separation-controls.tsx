import { Button } from "@/ui/button";
import { IconPlayerPlay, IconReload, IconUpload } from "@tabler/icons-react";
import { useRef } from "react";

// -- Types --------------------------------------------------------------------

interface FileSlotPhase {
  kind: string;
  file?: { name: string; numFrames: number; sampleRate: number; channels: Float32Array[] };
}

interface FileSlotProps {
  phase: FileSlotPhase;
  busy: boolean;
  onFile: (file: File) => void;
}

interface ControlsProps {
  variant: string;
  canInit: boolean;
  canRun: boolean;
  initBusy: boolean;
  runBusy: boolean;
  decoding: boolean;
  initProgress: { loaded: number; total: number } | null;
  processProgress: { processed: number; total: number } | null;
  onInit: () => void;
  onRun: () => void;
  onReset: () => void;
}

interface TrimPanelProps {
  inputTrim: number;
  sampleRate: number;
  maxTrim: number;
  leadingSilence: number | null;
  presets: ReadonlyArray<{ label: string; samples: number }>;
  busy: boolean;
  onChange: (samples: number) => void;
}

// -- Components ---------------------------------------------------------------

const FileSlot: React.FC<FileSlotProps> = ({ phase, busy, onFile }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const file = phase.file ?? null;

  return (
    <div className="rounded-md border border-composer-border bg-composer-button p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium">Audio file</span>
          {file ? (
            <span className="text-xs text-composer-text-muted select-text cursor-text truncate" title={file.name}>
              {file.name} ・ {file.numFrames} frames ・ {(file.numFrames / file.sampleRate).toFixed(2)} s ・{" "}
              {file.channels.length} ch ・ {file.sampleRate} Hz
            </span>
          ) : (
            <span className="text-xs text-composer-text-muted">No file selected</span>
          )}
        </div>
        <Button variant="secondary" hasIcon onClick={() => inputRef.current?.click()} disabled={busy}>
          <IconUpload size={16} />
          Choose file
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        aria-label="Audio file input"
        className="sr-only"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onFile(picked);
          e.target.value = "";
        }}
      />
    </div>
  );
};

const Controls: React.FC<ControlsProps> = ({
  variant,
  canInit,
  canRun,
  initBusy,
  runBusy,
  decoding,
  initProgress,
  processProgress,
  onInit,
  onRun,
  onReset,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" hasIcon onClick={onInit} disabled={!canInit || initBusy}>
          <IconPlayerPlay size={16} />
          Init model ({variant})
        </Button>
        <Button variant="primary" hasIcon onClick={onRun} disabled={!canRun || runBusy}>
          <IconPlayerPlay size={16} />
          Run separation
        </Button>
        <Button variant="ghost" hasIcon onClick={onReset}>
          <IconReload size={16} />
          Reset
        </Button>
      </div>
      {decoding && <p className="text-xs text-composer-text-muted">Decoding audio…</p>}
      {initProgress && (
        <p className="text-xs text-composer-text-muted select-text cursor-text">
          Init progress: {initProgress.loaded} / {initProgress.total || "?"} bytes
        </p>
      )}
      {processProgress && (
        <p className="text-xs text-composer-text-muted select-text cursor-text">
          Processing chunk {processProgress.processed} / {processProgress.total || "?"}
        </p>
      )}
    </div>
  );
};

const TrimPanel: React.FC<TrimPanelProps> = ({
  inputTrim,
  sampleRate,
  maxTrim,
  leadingSilence,
  presets,
  busy,
  onChange,
}) => {
  const trimMs = (inputTrim / sampleRate) * 1000;
  return (
    <div className="rounded-md border border-composer-border bg-composer-button p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Trim input samples</span>
          <span className="text-xs text-composer-text-muted select-text cursor-text">
            Strips this many samples from the start of the decoded buffer before the model runs. Use to A/B against an
            externally-decoded reference that already had LAME priming stripped.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={maxTrim}
            step={1}
            value={inputTrim}
            onChange={(e) => onChange(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
            disabled={busy}
            aria-label="Trim input samples"
            className="w-28 bg-composer-bg border border-composer-border rounded px-2 py-1 text-sm text-right tabular-nums select-text cursor-text"
          />
          <span className="text-xs text-composer-text-muted tabular-nums select-text cursor-text">
            {trimMs.toFixed(2)} ms
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={inputTrim === preset.samples ? "primary" : "secondary"}
            onClick={() => onChange(preset.samples)}
            disabled={busy}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      {leadingSilence !== null && (
        <p className="text-xs text-composer-text-muted select-text cursor-text">
          Detected leading silence: {leadingSilence} samples ({((leadingSilence / sampleRate) * 1000).toFixed(2)} ms).
          LAME priming is typically 1105 samples (CBR) or 2257 (VBR).
        </p>
      )}
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { Controls, FileSlot, TrimPanel };
