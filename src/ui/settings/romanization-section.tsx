import { DEFAULT_ROMANIZATION_API_BASE, resolveApiBase } from "@/lib/romanization-api";
import { useSettingsStore } from "@/stores/settings";
import { useState } from "react";
import { toast } from "sonner";

// -- Constants ----------------------------------------------------------------

const INPUT_CLASS =
  "h-7 px-2 text-sm rounded-lg bg-composer-input text-composer-text border border-composer-border focus:outline-none focus:border-composer-accent w-full";

// -- Types --------------------------------------------------------------------

interface HealthResponse {
  status?: string;
  version?: string;
  libraries?: string[];
  google_fallback?: boolean;
}

// -- Helpers ------------------------------------------------------------------

function describeCapabilities(body: HealthResponse): string {
  const libs = body.libraries && body.libraries.length > 0 ? body.libraries.join(", ") : "none yet";
  const fallback = body.google_fallback ? "google fallback on" : "google fallback off";
  return `Reachable. Libraries: ${libs}. ${fallback}.`;
}

// -- Romanization Settings Section --------------------------------------------

const RomanizationSettingsSection: React.FC = () => {
  const apiBase = useSettingsStore((s) => s.romanizationApiBase);
  const siteKey = useSettingsStore((s) => s.romanizationTurnstileSiteKey);
  const set = useSettingsStore((s) => s.set);

  const [testing, setTesting] = useState(false);

  async function handleTest(): Promise<void> {
    setTesting(true);
    try {
      const response = await fetch(`${resolveApiBase(apiBase)}/health`);
      if (!response.ok) {
        toast.error(`Could not reach the romanization backend (${response.status}).`);
        return;
      }
      let body: HealthResponse;
      try {
        body = (await response.json()) as HealthResponse;
      } catch {
        toast.error("Backend returned a malformed response.");
        return;
      }
      if (body.status !== "ok") {
        toast.error("Backend reachable but reported an unhealthy status.");
        return;
      }
      toast.success(describeCapabilities(body));
    } catch {
      toast.error("Could not reach the romanization backend. Check the URL and your connection.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <div className="py-3">
        <div className="flex flex-col gap-0.5 mb-3">
          <span className="text-sm font-medium text-composer-text">Romanization backend</span>
          <span className="text-xs text-composer-text-muted">
            Composer sends source lyrics to this backend to get phonetic Latin readings. Override the URL to point at
            your own self-host. Empty falls back to the Composer-hosted backend.
          </span>
        </div>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-sm font-medium text-composer-text">API base URL</span>
          <input
            type="text"
            aria-label="API base URL"
            value={apiBase}
            placeholder={DEFAULT_ROMANIZATION_API_BASE}
            onChange={(e) => set("romanizationApiBase", e.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 mb-3">
          <span className="text-sm font-medium text-composer-text">Turnstile site key</span>
          <input
            type="text"
            aria-label="Turnstile site key"
            value={siteKey}
            placeholder="Optional: your self-host's Turnstile site key"
            onChange={(e) => set("romanizationTurnstileSiteKey", e.target.value)}
            className={INPUT_CLASS}
          />
          <span className="text-xs text-composer-text-muted">
            Empty value falls back to the Composer Turnstile key built into the bundle.
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="h-7 px-3 text-sm rounded-lg bg-composer-button text-composer-text border border-composer-border hover:bg-composer-button-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Test connection
          </button>
          {testing && <span className="text-xs text-composer-text-muted">Testing...</span>}
        </div>
      </div>
    </div>
  );
};

// -- Exports ------------------------------------------------------------------

export { RomanizationSettingsSection };
