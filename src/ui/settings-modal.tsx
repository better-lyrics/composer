import { useAudioStore } from "@/stores/audio";
import { useConfirm } from "@/stores/confirm-store";
import { BUILTIN_COBALT_INSTANCE, DEFAULT_COBALT_INSTANCE_ID, DEFAULTS, useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { CobaltInstanceStatus, SettingsState } from "@/stores/settings";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { cn } from "@/utils/cn";
import { ConfirmationsSettingsSection } from "@/ui/confirmations-settings-section";
import { Scroll } from "@/ui/scroll";
import { displayHostFromUrl, ensureHttpScheme, isValidHttpUrl } from "@/utils/url";
import { ShortcutsSettingsSection } from "@/ui/shortcuts-settings-section";
import {
  IconAlertTriangle,
  IconClock,
  IconDeviceFloppy,
  IconExternalLink,
  IconKeyboard,
  IconLayoutRows,
  IconLock,
  IconMoodCheck,
  IconMoodHappy,
  IconMoodSadDizzy,
  IconPlayerPlay,
  IconPlugConnected,
  IconRefresh,
  IconRoute,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";

// -- Types --------------------------------------------------------------------

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetTour: () => void;
}

interface SectionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

// -- Helpers ------------------------------------------------------------------

const focusOnMount = (el: HTMLInputElement | null) => el?.focus();

// -- Sections -----------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "playback", label: "Playback", icon: IconPlayerPlay },
  { id: "timeline", label: "Timeline", icon: IconLayoutRows },
  { id: "sync", label: "Sync & Timing", icon: IconClock },
  { id: "shortcuts", label: "Shortcuts", icon: IconKeyboard },
  { id: "confirmations", label: "Confirmations", icon: IconAlertTriangle },
  { id: "storage", label: "Save & Storage", icon: IconDeviceFloppy },
  { id: "advanced", label: "Advanced", icon: IconPlugConnected },
];

// -- Setting Controls ---------------------------------------------------------

const SliderSetting: React.FC<{
  label: string;
  description: string;
  settingKey: keyof SettingsState;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  action?: { label: string; onClick: () => void };
}> = ({ label, description, settingKey, min, max, step, format, action }) => {
  const value = useSettingsStore((s) => s[settingKey]) as number;
  const set = useSettingsStore((s) => s.set);
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-composer-text">{label}</span>
          <span className="text-xs text-composer-text-muted">{description}</span>
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="text-xs text-composer-accent-text hover:text-composer-accent cursor-pointer transition-colors"
            >
              {action.label}
            </button>
          )}
          <span className="text-sm font-mono text-composer-text-secondary tabular-nums min-w-12 text-right">
            {format ? format(value) : value}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(settingKey, Number(e.target.value))}
        className="settings-slider w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--color-composer-accent) ${percent}%, var(--color-composer-button) ${percent}%)`,
        }}
      />
    </div>
  );
};

const ToggleSetting: React.FC<{
  label: string;
  description: string;
  settingKey: keyof SettingsState;
}> = ({ label, description, settingKey }) => {
  const value = useSettingsStore((s) => s[settingKey]) as boolean;
  const set = useSettingsStore((s) => s.set);

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-composer-text">{label}</span>
        <span className="text-xs text-composer-text-muted">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => set(settingKey, !value)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
          value ? "bg-composer-accent" : "bg-composer-button",
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block size-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
            value ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
};

const SelectSetting: React.FC<{
  label: string;
  description: string;
  settingKey: keyof SettingsState;
  options: { value: string; label: string }[];
}> = ({ label, description, settingKey, options }) => {
  const value = useSettingsStore((s) => s[settingKey]) as string;
  const set = useSettingsStore((s) => s.set);

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-composer-text">{label}</span>
        <span className="text-xs text-composer-text-muted">{description}</span>
      </div>
      <select
        value={value}
        onChange={(e) => set(settingKey, e.target.value as SettingsState[typeof settingKey])}
        className="h-7 px-2 text-sm rounded-lg bg-composer-input text-composer-text border border-composer-border focus:outline-none focus:border-composer-accent cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// -- Split Character Setting --------------------------------------------------

const BLOCKED_CHARS = new Set([" ", "\n", "\t", "\r"]);
const WARNED_CHARS = new Set([",", ".", "'", '"', "-", "!", "?", ":", ";", "(", ")", "&"]);

type SplitCaptureState =
  | { status: "idle" }
  | { status: "listening"; error?: string }
  | { status: "warning"; char: string };

function validateSplitChar(char: string): "blocked" | "warned" | "allowed" {
  if (BLOCKED_CHARS.has(char) || /[a-zA-Z0-9]/.test(char)) return "blocked";
  if (WARNED_CHARS.has(char)) return "warned";
  return "allowed";
}

const SplitCharacterSetting: React.FC = () => {
  const splitCharacter = useSettingsStore((s) => s.splitCharacter);
  const set = useSettingsStore((s) => s.set);
  const isDefault = splitCharacter === DEFAULTS.splitCharacter;
  const [captureState, setCaptureState] = useState<SplitCaptureState>({
    status: "idle",
  });

  const cancelCapture = useCallback(() => {
    setCaptureState({ status: "idle" });
  }, []);

  useEffect(() => {
    if (captureState.status !== "listening") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        cancelCapture();
        return;
      }

      if (e.key === "Shift" || e.key === "Alt" || e.key === "Control" || e.key === "Meta") return;
      if (e.key.length !== 1) return;

      const result = validateSplitChar(e.key);

      if (result === "blocked") {
        setCaptureState({
          status: "listening",
          error: "Letters, numbers, and whitespace cannot be used",
        });
        return;
      }

      if (result === "warned") {
        setCaptureState({ status: "warning", char: e.key });
        return;
      }

      set("splitCharacter", e.key);
      setCaptureState({ status: "idle" });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [captureState.status, set, cancelCapture]);

  return (
    <>
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-composer-text">Split character</span>
          <span className="text-xs text-composer-text-muted">
            Character used to mark syllable boundaries in the edit view
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <button
              type="button"
              onClick={() => set("splitCharacter", DEFAULTS.splitCharacter)}
              className="text-xs text-composer-text-muted hover:text-composer-text cursor-pointer transition-colors"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setCaptureState({ status: "listening" })}
            className="flex items-center justify-center min-w-8 h-7 px-2 rounded-lg bg-composer-input border border-composer-border cursor-pointer transition-colors hover:border-composer-accent"
          >
            <span className="text-sm font-mono text-composer-text">{splitCharacter}</span>
          </button>
        </div>
      </div>

      <Modal isOpen={captureState.status === "listening"} onClose={cancelCapture} title="Change split character">
        <div className="text-center py-4 pb-0 space-y-10">
          <div className="space-y-2">
            <p className="text-sm text-composer-text-secondary">
              Press a character to use as the syllable split marker
            </p>
            <p className="text-xs text-composer-text-muted">Press Escape to cancel</p>
          </div>
          <p className="text-xs text-composer-text-muted bg-composer-button/50 rounded-lg px-3 py-2 text-left">
            Pick a symbol you won't use in lyrics. Characters like commas, apostrophes, and hyphens appear in lyrics and
            will cause unintended splits.
          </p>
        </div>
        {captureState.status === "listening" && captureState.error && (
          <p className="text-xs text-red-400 text-center mt-4">{captureState.error}</p>
        )}
      </Modal>

      {captureState.status === "warning" && (
        <Modal isOpen onClose={cancelCapture} title="Character warning">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-composer-text">
              <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-md bg-composer-button border border-composer-border font-mono">
                {captureState.char}
              </span>
              <span className="text-composer-text-secondary">commonly appears in lyrics.</span>
            </div>
            <p className="text-xs text-composer-text-muted">
              Using it as a split marker means every occurrence in your text will be treated as a syllable break.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={cancelCapture}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  set("splitCharacter", captureState.char);
                  setCaptureState({ status: "idle" });
                }}
              >
                Use anyway
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// -- Section Content ----------------------------------------------------------

const PlaybackSection: React.FC = () => {
  const set = useSettingsStore((s) => s.set);
  const hasAudio = useAudioStore((s) => s.source !== null);

  return (
    <div className="divide-y divide-composer-border">
      <SliderSetting
        label="Default playback rate"
        description="Starting playback speed when audio is loaded."
        settingKey="defaultPlaybackRate"
        min={0.25}
        max={2}
        step={0.05}
        format={(v) => `${v.toFixed(2)}x`}
        action={
          hasAudio
            ? {
                label: "Use current",
                onClick: () => set("defaultPlaybackRate", useAudioStore.getState().playbackRate),
              }
            : undefined
        }
      />
      <ToggleSetting
        label="Remember volume"
        description="Keep your volume level between sessions."
        settingKey="rememberVolume"
      />
    </div>
  );
};

const TimelineSection: React.FC = () => {
  const set = useSettingsStore((s) => s.set);

  return (
    <div className="divide-y divide-composer-border">
      <SliderSetting
        label="Default zoom"
        description="Initial zoom level (px/sec) when opening the timeline."
        settingKey="defaultZoom"
        min={20}
        max={500}
        step={20}
        format={(v) => `${v} px/s`}
        action={{
          label: "Use current",
          onClick: () => set("defaultZoom", useTimelineStore.getState().zoom),
        }}
      />
      <SliderSetting
        label="Default row height"
        description="Starting height of each lyric row in the timeline."
        settingKey="defaultRowHeight"
        min={32}
        max={120}
        step={4}
        format={(v) => `${v}px`}
        action={{
          label: "Use current",
          onClick: () => set("defaultRowHeight", useTimelineStore.getState().defaultRowHeight),
        }}
      />
      <ToggleSetting
        label="Snap (magnet)"
        description="Word edges snap to nearby anchors when dragging or resizing."
        settingKey="timelineSnap"
      />
      <SliderSetting
        label="Snap threshold"
        description="Distance (in pixels) at which the moving block locks onto an anchor."
        settingKey="timelineSnapThreshold"
        min={4}
        max={24}
        step={1}
        format={(v) => `${v}px`}
      />
      <ToggleSetting
        label="Follow playhead"
        description="Auto-scroll the timeline to keep the playhead visible."
        settingKey="followPlayhead"
      />
    </div>
  );
};

const SyncSection: React.FC = () => (
  <div className="divide-y divide-composer-border">
    <SplitCharacterSetting />
    <SliderSetting
      label="Nudge amount"
      description="How far timing shifts when using nudge controls."
      settingKey="nudgeAmount"
      min={0.01}
      max={0.2}
      step={0.01}
      format={(v) => `${(v * 1000).toFixed(0)}ms`}
    />
    <SliderSetting
      label="Default word duration"
      description="Length assigned to newly created words in the timeline."
      settingKey="defaultWordDuration"
      min={0.1}
      max={1}
      step={0.05}
      format={(v) => `${(v * 1000).toFixed(0)}ms`}
    />
    <SliderSetting
      label="Min word duration"
      description="Shortest allowed duration for a word."
      settingKey="minWordDuration"
      min={0.01}
      max={0.2}
      step={0.01}
      format={(v) => `${(v * 1000).toFixed(0)}ms`}
    />
    <SelectSetting
      label="Default granularity"
      description="Whether new projects start in word or line timing mode."
      settingKey="defaultGranularity"
      options={[
        { value: "word", label: "Word" },
        { value: "line", label: "Line" },
      ]}
    />
    <SelectSetting
      label="Language automatic split assist"
      description="Automatically place the split points based on the choosen language when splitting a syllable"
      settingKey="languageAutoSplit"
      options={[ // add more languages here with patterns that are supported by @hyphen
        { label: "English (United States)", value: "en-us" },
        { label: "English (United Kingdom)", value: "en-gb" },
        { label: "Bulgarian", value: "bg" },
        { label: "Dutch", value: "nl" },
        { label: "Deutsch (German)", value: "de" },
        { label: "Français (French)", value: "fr" },
        { label: "Español (Spanish)", value: "es" },
        { label: "Bahasa Indonesia (Indonesian)", value: "id" },
        { label: "Italiano (Italian)", value: "it" },
        { label: "Português (Portuguese)", value: "pt" },
        { label: "Pусский (Russian)", value: "ru" },
      ]}
    />
  </div>
);

const StorageSection: React.FC = () => (
  <div className="divide-y divide-composer-border">
    <SliderSetting
      label="Auto-save delay"
      description="How long to wait after your last edit before auto-saving."
      settingKey="autoSaveDelay"
      min={500}
      max={10000}
      step={500}
      format={(v) => `${(v / 1000).toFixed(1)}s`}
    />
  </div>
);

const CobaltDirectoryLink: React.FC = () => (
  <div className="flex flex-col gap-0.5 mt-4 pt-3 border-t border-composer-border">
    <a
      href="https://cobalt.directory/service"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-composer-text-secondary hover:text-composer-text transition-colors w-fit"
    >
      <IconExternalLink size={12} />
      Find more on cobalt.directory
    </a>
    <span className="text-[11px] text-composer-text-muted">
      Set the Service filter to <strong>YouTube Music</strong> when browsing.
    </span>
  </div>
);

const CobaltInstanceRow: React.FC<{
  instance: { id: string; label: string; url: string };
  isSelected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
  status?: CobaltInstanceStatus;
}> = ({ instance, isSelected, onSelect, onRemove, onEdit, status }) => (
  <button
    type="button"
    onClick={() => {
      if (isSelected && onEdit) onEdit();
      else onSelect();
    }}
    onDoubleClick={
      onEdit
        ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }
        : undefined
    }
    className={cn(
      "group flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer text-left min-w-0",
      isSelected
        ? "bg-composer-accent/15 border-composer-accent/50"
        : "bg-composer-input border-transparent hover:bg-composer-button",
    )}
  >
    <span
      className={cn(
        "size-3.5 rounded-full border-[1.5px] shrink-0 relative transition-colors",
        isSelected ? "border-composer-accent" : "border-composer-text opacity-50",
      )}
    >
      {isSelected && <span className="absolute inset-[2.5px] rounded-full bg-composer-accent" />}
    </span>
    <span className="flex items-center gap-1.5 min-w-0 max-w-[50%]">
      <span className="text-sm font-medium text-composer-text truncate">{instance.label}</span>
      {!onRemove ? (
        <span
          aria-label="Composer's default instance"
          title="Composer's default instance"
          className="inline-flex items-center justify-center shrink-0 text-composer-text-faint"
        >
          <IconMoodHappy size={14} />
        </span>
      ) : status ? (
        <CobaltInstanceStatusIcon status={status} />
      ) : null}
    </span>
    <span className="text-[11px] text-composer-text-muted font-mono truncate ml-auto text-right min-w-0">
      {displayHostFromUrl(instance.url)}
    </span>
    {onRemove ? (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Remove instance"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="size-6 rounded text-composer-text-faint hover:text-composer-error hover:bg-transparent shrink-0"
      >
        <IconTrash size={14} />
      </Button>
    ) : (
      <span aria-hidden className="size-6 shrink-0 flex items-center justify-center text-composer-text-faint">
        <IconLock size={13} />
      </span>
    )}
  </button>
);

const CobaltInstanceStatusIcon: React.FC<{ status: CobaltInstanceStatus }> = ({ status }) => {
  const tooltip =
    status.status === "success"
      ? `Last attempt worked (${formatRelativeTime(status.at)})`
      : `Last attempt failed: ${status.errorMessage ?? "unknown error"} (${formatRelativeTime(status.at)})`;
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        status.status === "success" ? "text-emerald-400" : "text-amber-400",
      )}
    >
      {status.status === "success" ? <IconMoodCheck size={14} /> : <IconMoodSadDizzy size={14} />}
    </span>
  );
};

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

const CobaltInstanceEditRow: React.FC<{
  initialLabel: string;
  initialUrl: string;
  onSave: (label: string, url: string) => void;
  onCancel: () => void;
}> = ({ initialLabel, initialUrl, onSave, onCancel }) => {
  const [label, setLabel] = useState(() => initialLabel);
  const [url, setUrl] = useState(() => displayHostFromUrl(initialUrl));

  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  const urlValid = trimmedUrl.length > 0 && isValidHttpUrl(trimmedUrl);
  const showUrlError = trimmedUrl.length > 0 && !urlValid;
  const canSave = trimmedLabel.length > 0 && urlValid;

  const submit = () => {
    if (!canSave) return;
    onSave(trimmedLabel, ensureHttpScheme(url));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-lg border border-composer-accent/50 bg-composer-accent/10">
      <div className="flex items-center gap-2">
        <input
          ref={focusOnMount}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-32 h-6 px-2 text-xs rounded-md bg-composer-input border border-composer-border focus:outline-none focus:border-composer-accent text-composer-text"
        />
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value.replace(/\s+/g, ""))}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 h-6 px-2 text-xs rounded-md bg-composer-input border focus:outline-none text-composer-text font-mono",
            showUrlError ? "border-composer-error" : "border-composer-border focus:border-composer-accent",
          )}
        />
        <Button size="sm" variant="primary" onClick={submit} disabled={!canSave} className="h-6 px-2.5">
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} className="h-6 px-2.5">
          Cancel
        </Button>
      </div>
      {showUrlError && <span className="text-[11px] text-composer-error-text">Enter a valid http(s) URL.</span>}
    </div>
  );
};

const CobaltInstanceAddForm: React.FC<{
  onAdd: (label: string, url: string) => void;
}> = ({ onAdd }) => {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  const urlValid = trimmedUrl.length > 0 && isValidHttpUrl(trimmedUrl);
  const showUrlError = trimmedUrl.length > 0 && !urlValid;
  const canAdd = trimmedLabel.length > 0 && urlValid;

  const submit = () => {
    if (!canAdd) return;
    onAdd(trimmedLabel, ensureHttpScheme(url));
    setLabel("");
    setUrl("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip whitespace as it's typed/pasted; URLs can never contain spaces
    setUrl(e.target.value.replace(/\s+/g, ""));
  };

  return (
    <div className="flex flex-col gap-1.5 mt-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-32 h-7 px-2 text-xs rounded-md bg-composer-input border border-composer-border focus:outline-none focus:border-composer-accent text-composer-text placeholder:text-composer-text-muted"
        />
        <input
          type="url"
          inputMode="url"
          placeholder="https://your-cobalt-instance"
          value={url}
          onChange={handleUrlChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 h-7 px-2 text-xs rounded-md bg-composer-input border focus:outline-none text-composer-text placeholder:text-composer-text-muted font-mono",
            showUrlError ? "border-composer-error" : "border-composer-border focus:border-composer-accent",
          )}
        />
        <Button size="sm" variant="primary" onClick={submit} disabled={!canAdd}>
          Add
        </Button>
      </div>
      {showUrlError && <span className="text-[11px] text-composer-error-text">Enter a valid http(s) URL.</span>}
    </div>
  );
};

const AdvancedSection: React.FC = () => {
  const cobaltInstances = useSettingsStore((s) => s.cobaltInstances);
  const selectedCobaltInstanceId = useSettingsStore((s) => s.selectedCobaltInstanceId);
  const cobaltInstanceStatus = useSettingsStore((s) => s.cobaltInstanceStatus);
  const addCobaltInstance = useSettingsStore((s) => s.addCobaltInstance);
  const updateCobaltInstance = useSettingsStore((s) => s.updateCobaltInstance);
  const removeCobaltInstance = useSettingsStore((s) => s.removeCobaltInstance);
  const selectCobaltInstance = useSettingsStore((s) => s.selectCobaltInstance);

  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <SelectSetting
        label="Preview renderer"
        description="Which engine renders synced lyrics in the Preview tab."
        settingKey="previewRenderer"
        options={[
          { value: "braccato", label: "Braccato (default)" },
          { value: "am-lyrics", label: "am-lyrics" },
        ]}
      />

      <div className="pt-3 mt-3 border-t border-composer-border">
        <div className="flex flex-col gap-0.5 mb-3">
          <span className="text-sm font-medium text-composer-text">Cobalt instance</span>
          <span className="text-xs text-composer-text-muted">
            Composer uses a Cobalt backend to fetch YouTube audio. Switch instances if the default is slow or
            unreachable. Self-hosting is encouraged for serious use.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <CobaltInstanceRow
            instance={BUILTIN_COBALT_INSTANCE}
            isSelected={selectedCobaltInstanceId === DEFAULT_COBALT_INSTANCE_ID}
            onSelect={() => selectCobaltInstance(DEFAULT_COBALT_INSTANCE_ID)}
          />
          {cobaltInstances.map((inst) =>
            editingId === inst.id ? (
              <CobaltInstanceEditRow
                key={inst.id}
                initialLabel={inst.label}
                initialUrl={inst.url}
                onSave={(label, url) => {
                  updateCobaltInstance(inst.id, { label, url });
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <CobaltInstanceRow
                key={inst.id}
                instance={inst}
                isSelected={selectedCobaltInstanceId === inst.id}
                onSelect={() => selectCobaltInstance(inst.id)}
                onRemove={() => removeCobaltInstance(inst.id)}
                onEdit={() => setEditingId(inst.id)}
                status={cobaltInstanceStatus[inst.id]}
              />
            ),
          )}
        </div>

        <CobaltInstanceAddForm onAdd={(label, url) => addCobaltInstance({ label, url })} />

        <CobaltDirectoryLink />
      </div>
    </div>
  );
};

const GeneralSection: React.FC<{
  onResetTour: () => void;
  onClose: () => void;
}> = ({ onResetTour, onClose }) => {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const confirm = useConfirm();

  const handleResetSettings = async () => {
    const ok = await confirm({
      title: "Reset all settings?",
      description: "Restore every setting to its default value. Your project data is not affected.",
      confirmLabel: "Reset",
      variant: "destructive",
      settingsKey: "confirmResetSettings",
    });
    if (ok) resetToDefaults();
  };

  return (
    <div className="divide-y divide-composer-border">
      <ToggleSetting
        label="Show shortcut hints"
        description="Display keyboard shortcut badges on toolbar buttons."
        settingKey="showShortcutHints"
      />
      <ToggleSetting
        label="Show syllable indicators"
        description="Visually group syllables split from one word."
        settingKey="showSyllableIndicators"
      />
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-composer-text">Reset product tour</span>
          <span className="text-xs text-composer-text-muted">
            Restart the guided walkthrough that introduces Composer's features.
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          hasIcon
          onClick={() => {
            onResetTour();
            onClose();
          }}
        >
          <IconRoute size={14} />
          Reset tour
        </Button>
      </div>
      <div className="flex items-center justify-between py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-composer-text">Reset to defaults</span>
          <span className="text-xs text-composer-text-muted">Restore all settings to their original values.</span>
        </div>
        <Button size="sm" variant="secondary" hasIcon onClick={handleResetSettings}>
          <IconRefresh size={14} />
          Reset all
        </Button>
      </div>
    </div>
  );
};

// -- Section Map --------------------------------------------------------------

const SECTION_CONTENT: Record<string, React.FC<{ onResetTour: () => void; onClose: () => void }>> = {
  playback: PlaybackSection,
  timeline: TimelineSection,
  sync: SyncSection,
  shortcuts: ShortcutsSettingsSection,
  confirmations: ConfirmationsSettingsSection,
  storage: StorageSection,
  advanced: AdvancedSection,
  general: GeneralSection,
};

// -- Settings Modal -----------------------------------------------------------

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetTour }) => {
  const [activeSection, setActiveSection] = useState("general");

  const Content = SECTION_CONTENT[activeSection];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="max-w-3xl h-[70%] flex flex-col"
      bodyClassName="p-0 flex-1 min-h-0 flex flex-col"
    >
      <div className="flex flex-1 min-h-0">
        <Scroll className="w-44 shrink-0 border-r border-composer-border select-none">
          <div className="flex flex-col gap-px p-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors",
                    isActive
                      ? "bg-composer-button text-composer-text font-medium"
                      : "text-composer-text-secondary hover:bg-composer-button/50 hover:text-composer-text",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </Scroll>

        <Scroll className="flex-1 px-6 py-2">
          {Content && <Content onResetTour={onResetTour} onClose={onClose} />}
        </Scroll>
      </div>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none">
        Settings are saved automatically
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
