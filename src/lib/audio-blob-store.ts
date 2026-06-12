// -- Types --------------------------------------------------------------------

interface AudioBlobStore {
  get(projectId: string): Promise<ArrayBuffer | undefined>;
  put(projectId: string, bytes: ArrayBuffer): Promise<void>;
  delete(projectId: string): Promise<void>;
  has(projectId: string): Promise<boolean>;
  listIds(): Promise<string[]>;
}

// -- Constants ----------------------------------------------------------------

const FILE_SUFFIX = ".bin";

// -- Implementations ----------------------------------------------------------

class MemoryAudioBlobStore implements AudioBlobStore {
  private readonly entries = new Map<string, ArrayBuffer>();

  async get(projectId: string) {
    return this.entries.get(projectId);
  }
  async put(projectId: string, bytes: ArrayBuffer) {
    this.entries.set(projectId, bytes);
  }
  async delete(projectId: string) {
    this.entries.delete(projectId);
  }
  async has(projectId: string) {
    return this.entries.has(projectId);
  }
  async listIds() {
    return [...this.entries.keys()];
  }
}

class OpfsAudioBlobStore implements AudioBlobStore {
  private async dir() {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle("audio", { create: true });
  }

  async get(projectId: string) {
    try {
      const dir = await this.dir();
      const fh = await dir.getFileHandle(`${projectId}${FILE_SUFFIX}`);
      const file = await fh.getFile();
      return file.arrayBuffer();
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") return undefined;
      throw err;
    }
  }

  async put(projectId: string, bytes: ArrayBuffer) {
    const dir = await this.dir();
    const fh = await dir.getFileHandle(`${projectId}${FILE_SUFFIX}`, { create: true });
    const writable = await fh.createWritable();
    await writable.write(bytes);
    await writable.close();
  }

  async delete(projectId: string) {
    try {
      const dir = await this.dir();
      await dir.removeEntry(`${projectId}${FILE_SUFFIX}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") return;
      throw err;
    }
  }

  async has(projectId: string) {
    try {
      const dir = await this.dir();
      await dir.getFileHandle(`${projectId}${FILE_SUFFIX}`);
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") return false;
      throw err;
    }
  }

  async listIds() {
    const dir = await this.dir();
    const ids: string[] = [];
    for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      if (handle.kind === "file" && name.endsWith(FILE_SUFFIX)) {
        ids.push(name.slice(0, -FILE_SUFFIX.length));
      }
    }
    return ids;
  }
}

// -- Exports ------------------------------------------------------------------

export { MemoryAudioBlobStore, OpfsAudioBlobStore };
export type { AudioBlobStore };
