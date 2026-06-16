import type { ReactDoctorConfig } from "react-doctor/api";

export default {
  ignore: {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    overrides: [
      {
        files: ["src/test/**", "**/*.test-helpers.ts"],
        rules: ["deslop/unused-file"],
      },
      {
        files: ["package.json"],
        rules: ["deslop/unused-dependency"],
      },
      {
        files: [
          "src/views/edit.tsx",
          "src/views/sync/sync-panel.tsx",
          "src/views/timeline/word-track.tsx",
          "src/views/timeline/timeline-context-menu.tsx",
          "src/views/timeline/timeline-panel.tsx",
        ],
        rules: ["react-doctor/no-giant-component"],
      },
      {
        files: [
          "src/views/timeline/word-block.tsx",
          "src/views/timeline/line-row.tsx",
          "src/views/timeline/timeline-playhead.tsx",
          "src/views/timeline/paste-preview.tsx",
          "src/views/timeline/timeline-waveform.tsx",
          "src/views/sync/scrollable-line.tsx",
          "src/views/edit.tsx",
          "src/ui/slider.tsx",
          "src/ui/settings/cobalt-instances.tsx",
        ],
        rules: ["react-doctor/prefer-tag-over-role"],
      },
      {
        files: [
          "src/views/sync/scrollable-line.tsx",
          "src/views/sync/word-renderer.tsx",
          "src/views/timeline/suggestions-banner.tsx",
        ],
        rules: ["react-doctor/no-render-in-render"],
      },
      {
        files: ["src/ui/settings/setting-controls.tsx"],
        rules: ["react-doctor/no-multi-comp"],
      },
      {
        files: [
          "src/views/export.tsx",
          "src/views/sync/scrollable-line.tsx",
          "src/views/sync/split-mode-content.tsx",
          "src/views/timeline/snap-markers-overlay.tsx",
        ],
        rules: ["react-doctor/no-array-index-as-key", "react-doctor/no-array-index-key"],
      },
      {
        files: ["src/ui/help-sections/getting-started.tsx"],
        rules: ["react-doctor/iframe-missing-sandbox"],
      },
      {
        files: ["src/views/sync/sync-panel.tsx"],
        rules: ["react-doctor/prefer-useReducer", "react-doctor/no-cascading-set-state"],
      },
      {
        files: ["src/views/edit.tsx"],
        rules: ["react-doctor/prefer-use-effect-event"],
      },
      {
        files: ["src/ui/client-only.tsx"],
        rules: ["react-doctor/rendering-hydration-no-flicker", "react-doctor/no-initialize-state"],
      },
      {
        files: ["src/stores/settings.ts"],
        rules: ["react-doctor/rendering-hydration-no-flicker", "deslop/unused-export"],
      },
      {
        files: ["src/ui/settings/bridge-section.tsx"],
        rules: [
          "react-doctor/effect-needs-cleanup",
          "react-doctor/exhaustive-deps",
          "react-doctor/query-destructure-result",
        ],
      },
      {
        files: ["src/views/timeline/snap-markers-overlay.tsx"],
        rules: ["react-doctor/exhaustive-deps"],
      },
      {
        files: ["src/ui/settings/split-character-setting.tsx"],
        rules: ["react-doctor/no-cascading-set-state"],
      },
      {
        files: ["src/views/timeline/timeline-playhead.tsx"],
        rules: ["react-doctor/interactive-supports-focus"],
      },
    ],
  },
} satisfies ReactDoctorConfig;
