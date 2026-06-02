import type { LyricLine } from "@/domain/line/model";
import { isRomanizationManual } from "@/domain/line/romanization";
import type { Script } from "@/domain/romanization/detect";
import { detectScript } from "@/domain/romanization/detect";
import { getGeneratorFactory } from "@/domain/romanization/registry";
import { isKnownScheme, SCHEMES } from "@/domain/romanization/schemes";
import { useProjectStore } from "@/stores/project";
import { generateForLine } from "@/utils/romanization/generate-for-line";
import { RateLimitError } from "@/utils/romanization/google/fetch";

// -- Types --------------------------------------------------------------------

interface GenerateForProjectOptions {
  scheme: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

interface GenerateForProjectError {
  lineId: string;
  message: string;
}

interface GenerateForProjectResult {
  done: number;
  total: number;
  errors: GenerateForProjectError[];
  aborted: boolean;
  rateLimited: boolean;
}

// -- Internal -----------------------------------------------------------------

function resolveScript(scheme: string): Exclude<Script, "latin"> | undefined {
  const entry = SCHEMES.find((s) => s.id === scheme);
  if (!entry || entry.script === "latin") return undefined;
  return entry.script;
}

function selectTargetLines(lines: LyricLine[], targetScript: Script): LyricLine[] {
  return lines.filter((line) => {
    if (isRomanizationManual(line)) return false;
    return detectScript(line.text) === targetScript;
  });
}

// -- Public API ---------------------------------------------------------------

async function generateForProject(options: GenerateForProjectOptions): Promise<GenerateForProjectResult> {
  const { scheme, signal, onProgress } = options;

  if (!isKnownScheme(scheme)) {
    throw new Error(`Unknown romanization scheme: ${scheme}`);
  }
  if (!getGeneratorFactory(scheme)) {
    throw new Error(`No romanization generator registered for scheme: ${scheme}`);
  }
  const targetScript = resolveScript(scheme);
  if (!targetScript) {
    return { done: 0, total: 0, errors: [], aborted: false, rateLimited: false };
  }

  const store = useProjectStore.getState();
  const baseline = store.lines;
  const baselineWasDirty = store.isDirtySinceHistory;
  const targets = selectTargetLines(baseline, targetScript);
  const total = targets.length;

  onProgress?.(0, total);

  if (total === 0) {
    return { done: 0, total: 0, errors: [], aborted: false, rateLimited: false };
  }

  const errors: GenerateForProjectError[] = [];
  let done = 0;
  let aborted = false;
  let rateLimited = false;

  for (const line of targets) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }
    try {
      const romanization = await generateForLine(line, scheme);
      if (signal?.aborted) {
        aborted = true;
        break;
      }
      useProjectStore.getState().setLineRomanization(line.id, romanization);
      done += 1;
      onProgress?.(done, total);
    } catch (err) {
      if (err instanceof RateLimitError) {
        rateLimited = true;
        errors.push({ lineId: line.id, message: "Google romanization rate limit; try again later" });
        onProgress?.(done, total);
        break;
      }
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ lineId: line.id, message });
      onProgress?.(done, total);
    }
  }

  if (aborted) {
    useProjectStore.setState({
      lines: baseline,
      isDirtySinceHistory: baselineWasDirty,
    });
    return { done, total, errors, aborted: true, rateLimited };
  }

  if (done > 0) {
    useProjectStore.getState().commitPendingLineEdit(baseline, baselineWasDirty);
  }

  return { done, total, errors, aborted: false, rateLimited };
}

// -- Exports ------------------------------------------------------------------

export { generateForProject };
export type { GenerateForProjectError, GenerateForProjectOptions, GenerateForProjectResult };
