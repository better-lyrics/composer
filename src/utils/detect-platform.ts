type Platform =
  | { os: "mac"; arch: "arm64" | "amd64" | "unknown" }
  | { os: "windows" }
  | { os: "linux" }
  | { os: "unknown" };

const detectPlatform = (ua: string): Platform => {
  const lower = ua.toLowerCase();
  if (lower.includes("mac os x") || lower.includes("macintosh")) {
    if (ua.includes("ARM64") || ua.includes("aarch64")) {
      return { os: "mac", arch: "arm64" };
    }
    if (ua.includes("Intel") || ua.includes("x86_64")) {
      return { os: "mac", arch: "amd64" };
    }
    return { os: "mac", arch: "unknown" };
  }
  if (lower.includes("windows")) return { os: "windows" };
  if (lower.includes("linux") || lower.includes("x11")) return { os: "linux" };
  return { os: "unknown" };
};

export { detectPlatform };
export type { Platform };
