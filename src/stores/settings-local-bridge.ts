interface BridgeExperiments {
  experiments: { youtubeBridge: boolean };
}

const RUNS_LOCALLY =
  import.meta.env.MODE !== "test" &&
  (import.meta.env.DEV ||
    (typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1")));

function mergeSettingsForLocalBridge<State extends BridgeExperiments>(persisted: unknown, current: State): State {
  const merged = { ...current, ...(persisted as Partial<State>) };
  if (!RUNS_LOCALLY) return merged;
  return { ...merged, experiments: { ...merged.experiments, youtubeBridge: true } };
}

export { RUNS_LOCALLY, mergeSettingsForLocalBridge };
