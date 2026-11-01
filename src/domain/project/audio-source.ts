import type { SourceMetadata } from "@/domain/project/source-metadata";

// -- Types --------------------------------------------------------------------

type SavedAudioSource = { kind: "file"; name: string } | { kind: "youtube"; videoId: string; details?: SourceMetadata };

// -- Exports ------------------------------------------------------------------

export type { SavedAudioSource };
