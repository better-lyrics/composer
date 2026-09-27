import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { SliderSetting } from "@/ui/settings/setting-controls";

// -- Component -----------------------------------------------------------------

const DefaultPlaybackRateSetting: React.FC = () => {
  const hasAudio = useAudioStore((s) => s.source !== null);
  return (
    <SliderSetting
      id="defaultPlaybackRate"
      min={0.25}
      max={2}
      step={0.05}
      format={(v) => `${v.toFixed(2)}x`}
      action={
        hasAudio
          ? {
              label: "Use current",
              onClick: () =>
                useSettingsStore.getState().set("defaultPlaybackRate", useAudioStore.getState().playbackRate),
            }
          : undefined
      }
    />
  );
};

// -- Exports -------------------------------------------------------------------

export { DefaultPlaybackRateSetting };
