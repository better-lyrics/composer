import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEnsureAuth } from "@/hooks/useEnsureAuth";
import { type AudioSource, useAudioStore } from "@/stores/audio";
import { useProjectStore } from "@/stores/project";
import {
  DEFAULT_COBALT_INSTANCE_ID,
  getActiveCobaltInstance,
  isUsingDefaultCobaltInstance,
  useSettingsStore,
} from "@/stores/settings";
import { CobaltApiError, formatCobaltErrorForToast, getAudio, getAudioFromStandardCobalt } from "@/utils/cobalt-api";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[YouTubeTunnel]";
const AUDIO_MIME = "audio/ogg";

interface TunnelResult {
  file: File;
  filename: string | undefined;
  instanceLabel: string;
  instanceId: string;
  wasDefault: boolean;
}

// -- Helpers ------------------------------------------------------------------

function buildAudioFile(buffer: ArrayBuffer, filename: string | undefined, videoId: string): File {
  const safeName = (filename ?? videoId).replace(/[\\/:*?"<>|]/g, "").trim() || videoId;
  return new File([buffer], `${safeName}.opus`, { type: AUDIO_MIME });
}

async function fetchTunnel(
  videoId: string,
  signal: AbortSignal,
  ensureAuth: () => Promise<string>,
): Promise<TunnelResult> {
  const instanceAtStart = getActiveCobaltInstance();
  const wasDefault = isUsingDefaultCobaltInstance();

  let tunnelUrl: string;
  let filename: string | undefined;
  if (wasDefault) {
    const jwt = await ensureAuth();
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    ({ tunnelUrl, filename } = await getAudio(videoId, jwt));
  } else {
    ({ tunnelUrl, filename } = await getAudioFromStandardCobalt(videoId));
  }
  if (signal.aborted) throw new DOMException("aborted", "AbortError");

  const res = await fetch(tunnelUrl, { signal });
  if (!res.ok) throw new CobaltApiError("cobalt_failed", res.status);
  const buffer = await res.arrayBuffer();
  if (signal.aborted) throw new DOMException("aborted", "AbortError");
  if (buffer.byteLength === 0) throw new CobaltApiError("empty_audio", res.status);

  return {
    file: buildAudioFile(buffer, filename, videoId),
    filename,
    instanceLabel: instanceAtStart.label,
    instanceId: instanceAtStart.id,
    wasDefault,
  };
}

// -- Hook ---------------------------------------------------------------------

function useResolveYouTubeTunnel(): void {
  const ensureAuth = useEnsureAuth();
  const ensureRef = useRef(ensureAuth);
  ensureRef.current = ensureAuth;

  const source = useAudioStore((s) => s.source);
  const previousSourceRef = useRef<AudioSource>(null);
  useEffect(() => {
    previousSourceRef.current = source;
  });

  const videoId = source?.type === "youtube" && !source.file ? source.videoId : null;

  const query = useQuery<TunnelResult>({
    queryKey: ["youtube-tunnel", videoId],
    enabled: videoId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    queryFn: ({ signal }) => fetchTunnel(videoId as string, signal, () => ensureRef.current()),
  });

  useEffect(() => {
    if (!videoId) {
      useAudioStore.getState().setIsLoading(false);
      return;
    }
    useAudioStore.getState().setIsLoading(query.isFetching);
  }, [videoId, query.isFetching]);

  useEffect(() => {
    const data = query.data;
    if (!data || !videoId) return;
    const current = useAudioStore.getState().source;
    if (current?.type !== "youtube" || current.videoId !== videoId) return;
    useAudioStore.getState().setYouTubeFile(data.file);

    if (data.filename) {
      const project = useProjectStore.getState();
      const currentTitle = project.metadata.title;
      if (!currentTitle || currentTitle === videoId) {
        project.setMetadata({ title: data.filename });
      }
    }
    if (!data.wasDefault && data.instanceId !== DEFAULT_COBALT_INSTANCE_ID) {
      useSettingsStore.getState().recordCobaltInstanceResult(data.instanceId, "success");
    }
  }, [query.data, videoId]);

  useEffect(() => {
    const err = query.error;
    if (!err || !videoId) return;
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error(LOG_PREFIX, "tunnel fetch failed", err);
    const instance = getActiveCobaltInstance();
    const wasDefault = isUsingDefaultCobaltInstance();
    const message = formatCobaltErrorForToast(err, { isDefault: wasDefault, instanceLabel: instance.label });
    toast.error(message);
    if (!wasDefault && instance.id !== DEFAULT_COBALT_INSTANCE_ID) {
      useSettingsStore.getState().recordCobaltInstanceResult(instance.id, "error", message);
    }
    const current = useAudioStore.getState().source;
    if (current?.type === "youtube" && current.videoId === videoId) {
      useAudioStore.getState().setSource(previousSourceRef.current);
    }
  }, [query.error, videoId]);
}

// -- Exports ------------------------------------------------------------------

export { useResolveYouTubeTunnel };
