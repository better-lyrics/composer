import { downloadText, sanitizeFileName } from "@/lib/download-file";
import type { ConversionResult } from "@/pages/converters/convert-via-parser";
import type { OutputFormat } from "@/pages/converters/output-formats";
import { Button } from "@/ui/button";
import { LinkButton } from "@/ui/link-button";
import { StatusChip } from "@/ui/status-chip";
import { cn } from "@/utils/cn";
import { skippedLinesMessage } from "@/utils/lyrics-parsers/shared";
import { IconAlertTriangle, IconCopy, IconDownload, IconExternalLink } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface ConvertArgs {
  input: string;
  filename: string;
  format: OutputFormat;
}

interface ConverterViewProps {
  title: string;
  inputLabel: string;
  inputPlaceholder: string;
  sampleInput: string;
  convert: (args: ConvertArgs) => ConversionResult;
  outputFormat: OutputFormat;
}

const OPEN_IN_COMPOSER_HASH_PREFIX = "#import=";

const ConverterView: React.FC<ConverterViewProps> = ({
  title,
  inputLabel,
  inputPlaceholder,
  sampleInput,
  convert,
  outputFormat,
}) => {
  const downloadFilename = `lyrics.${outputFormat.extension}`;
  const [input, setInput] = useState("");
  const [filename, setFilename] = useState(() => downloadFilename);

  const { output, error, projectPayload, skippedLines } = useMemo(() => {
    if (!input.trim()) return { output: "", error: null, projectPayload: "", skippedLines: 0 };
    const result = convert({ input, filename, format: outputFormat });
    if ("error" in result) return { output: "", error: result.error, projectPayload: "", skippedLines: 0 };
    return {
      output: result.output,
      error: null,
      projectPayload: result.projectPayload,
      skippedLines: result.skippedLines,
    };
  }, [input, filename, convert, outputFormat]);

  const downloadOutput = () => {
    if (!output) return;
    const name = sanitizeFileName(filename, downloadFilename);
    const suffix = `.${outputFormat.extension}`;
    downloadText(output, name.toLowerCase().endsWith(suffix) ? name : `${name}${suffix}`, outputFormat.mimeType);
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      toast.success(`Copied ${outputFormat.label} to clipboard`);
    } catch (clipboardError) {
      console.error(`[Composer] Failed to copy ${outputFormat.label}`, clipboardError);
      toast.error("Could not copy to clipboard");
    }
  };

  const openInComposerHref = projectPayload
    ? `/${OPEN_IN_COMPOSER_HASH_PREFIX}${encodeURIComponent(projectPayload)}`
    : "/";

  return (
    <section className="px-6 py-14 max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-5xl font-semibold text-composer-text text-center mb-4">{title}</h1>
      <p className="text-composer-text-secondary text-center max-w-2xl mx-auto mb-10">
        Paste your input on the left, download a standard {outputFormat.label} file on the right. Everything runs in
        your browser.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-composer-bg-elevated border border-composer-border p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="converter-input" className="text-sm font-medium text-composer-text select-none">
              {inputLabel}
            </label>
            <button
              type="button"
              className="text-xs text-composer-accent-text hover:text-composer-accent cursor-pointer"
              onClick={() => setInput(sampleInput)}
            >
              Load sample
            </button>
          </div>
          <textarea
            id="converter-input"
            aria-label="Converter input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={inputPlaceholder}
            spellCheck={false}
            className="flex-1 min-h-[280px] md:min-h-[420px] font-mono text-sm bg-composer-bg-dark border border-composer-border rounded-lg p-3 text-composer-text placeholder:text-composer-text-muted resize-y focus:outline-none focus:border-composer-accent cursor-text select-text"
          />
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="converter-filename" className="text-xs text-composer-text-muted select-none">
              Filename
            </label>
            {/* react-doctor-disable-next-line react-doctor/control-has-associated-label */}
            <input
              id="converter-filename"
              type="text"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              className="flex-1 text-xs bg-composer-bg-dark border border-composer-border rounded-md px-2 py-1 text-composer-text focus:outline-none focus:border-composer-accent cursor-text select-text"
            />
          </div>
        </div>
        <div className="rounded-xl bg-composer-bg-elevated border border-composer-border p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-composer-text select-none">{outputFormat.label} output</span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={copyOutput} disabled={!output} hasIcon>
                <IconCopy size={12} />
                Copy
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadOutput} disabled={!output} hasIcon>
                <IconDownload size={12} />
                Download
              </Button>
            </div>
          </div>
          <pre
            className={cn(
              "flex-1 min-h-[280px] md:min-h-[420px] overflow-auto font-mono text-xs rounded-lg p-3 border",
              error
                ? "bg-composer-error/10 border-composer-error/40 text-composer-error-text select-text whitespace-pre-wrap break-words"
                : "bg-composer-bg-dark border-composer-border text-composer-text select-text",
            )}
          >
            {error || output || `Paste input to see ${outputFormat.label} output`}
          </pre>
          <div role="status">
            {skippedLines > 0 && (
              <StatusChip tone="warning" icon={IconAlertTriangle} className="mt-3">
                {skippedLinesMessage(skippedLines)}
              </StatusChip>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-composer-text-muted">Need to fine-tune timing against a waveform?</span>
            <LinkButton
              href={openInComposerHref}
              variant="primary"
              size="sm"
              disabled={!projectPayload}
              hasIcon
              className={cn(!projectPayload && "opacity-25")}
            >
              Open in Composer
              <IconExternalLink size={12} />
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
};

export { ConverterView };
export type { ConvertArgs };
