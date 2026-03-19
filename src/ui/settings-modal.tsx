import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { useTimelineStore } from "@/views/timeline/timeline-store";
import type { SettingsState } from "@/stores/settings";
import { Button } from "@/ui/button";
import { Modal } from "@/ui/modal";
import { cn } from "@/utils/cn";
import {
  IconClock,
  IconPlayerPlay,
  IconRefresh,
  IconRoute,
  IconLayoutRows,
  IconSettings,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { useState } from "react";

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

// -- Sections -----------------------------------------------------------------

const SECTIONS: SectionDef[] = [
  { id: "playback", label: "Playback", icon: IconPlayerPlay },
  { id: "timeline", label: "Timeline", icon: IconLayoutRows },
  { id: "sync", label: "Sync & Timing", icon: IconClock },
  { id: "storage", label: "Save & Storage", icon: IconDeviceFloppy },
  { id: "general", label: "General", icon: IconSettings },
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
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
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
        label="Follow playhead"
        description="Auto-scroll the timeline to keep the playhead visible."
        settingKey="followPlayhead"
      />
    </div>
  );
};

const SyncSection: React.FC = () => (
  <div className="divide-y divide-composer-border">
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

const GeneralSection: React.FC<{ onResetTour: () => void; onClose: () => void }> = ({ onResetTour, onClose }) => {
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  return (
    <div className="divide-y divide-composer-border">
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
        <Button size="sm" variant="secondary" hasIcon onClick={resetToDefaults}>
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
  storage: StorageSection,
  general: GeneralSection,
};

// -- Settings Modal -----------------------------------------------------------

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onResetTour }) => {
  const [activeSection, setActiveSection] = useState("playback");

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
        <nav className="w-44 shrink-0 border-r border-composer-border p-2 space-y-px overflow-y-auto select-none">
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
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {Content && <Content onResetTour={onResetTour} onClose={onClose} />}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-composer-border text-xs text-composer-text-muted text-center shrink-0 select-none">
        Settings are saved automatically
      </div>
    </Modal>
  );
};

// -- Exports ------------------------------------------------------------------

export { SettingsModal };
