import { log } from "@/audio/separation/worker-log";

// Opt-in (localStorage["composer.profileSeparation"] = "1") one-chunk GPU kernel
// profile. ORT's standard timestamp-query mode ends a compute pass per kernel,
// so it is switched on for a single chunk only and only its kernel durations
// are meaningful, not that chunk's wall time.

interface ProfilingEnv {
  webgpu?: { profiling?: { mode?: "off" | "default" } };
}

// Per-program GPU time collected by ORT's profiler while a chunk is profiled.
const kernelStats = new Map<string, { ns: number; count: number }>();

function recordKernel(data: { programName?: string; startTime: number; endTime: number }) {
  const key = data.programName ?? "unknown";
  const entry = kernelStats.get(key) ?? { ns: 0, count: 0 };
  entry.ns += data.endTime - data.startTime;
  entry.count++;
  kernelStats.set(key, entry);
}

function setProfilingMode(env: ProfilingEnv, mode: "off" | "default") {
  const profiling = env.webgpu?.profiling;
  if (profiling) profiling.mode = mode;
}

function startKernelProfile(env: ProfilingEnv) {
  kernelStats.clear();
  setProfilingMode(env, "default");
}

// ORT reads the profiling mode when a run starts, so only switch it off once the
// profiled run has finished.
function stopKernelProfile(env: ProfilingEnv) {
  setProfilingMode(env, "off");
}

async function reportKernelProfile(chunkNumber: number, waitMs: number, adapterHasTimestampQuery: boolean | null) {
  // Timestamp readbacks resolve asynchronously after the run; give them a turn.
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (kernelStats.size === 0) {
    const support =
      adapterHasTimestampQuery === false
        ? "this adapter does not expose timestamp-query (try chrome://flags/#enable-webgpu-developer-features)"
        : "the adapter reports timestamp-query, so ORT did not deliver any timestamps";
    log(`GPU profile (chunk ${chunkNumber}): no timestamps received; ${support}`);
    return;
  }
  let totalNs = 0;
  let kernels = 0;
  for (const { ns, count } of kernelStats.values()) {
    totalNs += ns;
    kernels += count;
  }
  const top = [...kernelStats.entries()]
    .sort((a, b) => b[1].ns - a[1].ns)
    .slice(0, 6)
    .map(([name, { ns, count }]) => `${name} ${(ns / 1e6).toFixed(1)}ms x${count}`);
  log(
    `GPU profile (chunk ${chunkNumber}, profiling slows this chunk, waited ${Math.round(waitMs)} ms): ${kernels} kernels, ${(totalNs / 1e6).toFixed(0)} ms GPU time. Top: ${top.join("; ")}`,
  );
  log("GPU timestamps are quantized to ~100us unless chrome://flags/#enable-webgpu-developer-features is on");
  kernelStats.clear();
}

export { recordKernel, reportKernelProfile, startKernelProfile, stopKernelProfile };
