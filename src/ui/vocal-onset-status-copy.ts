import { pluralize } from "@/utils/pluralize";

const DETECTING_VOCAL_ONSETS = "Detecting vocal onsets";

function describeOnsetStatus(
  status: "idle" | "processing" | "error",
  pointCount: number,
  error: string | null,
): string {
  if (status === "processing") return DETECTING_VOCAL_ONSETS;
  if (status === "error") return error ? `Detection failed: ${error}` : "Detection failed";
  if (pointCount > 0) return pluralize(pointCount, "snap point");
  return "Separate vocals to detect onsets";
}

export { DETECTING_VOCAL_ONSETS, describeOnsetStatus };
