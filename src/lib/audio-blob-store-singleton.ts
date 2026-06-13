import { type AudioBlobStore, OpfsAudioBlobStore } from "@/lib/audio-blob-store";

const audioBlobs: AudioBlobStore = new OpfsAudioBlobStore();

export { audioBlobs };
