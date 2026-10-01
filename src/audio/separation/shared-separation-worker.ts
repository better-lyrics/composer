import { SeparationWorker } from "@/audio/separation/worker-host";

let worker: SeparationWorker | null = null;

function getSeparationWorker(): SeparationWorker {
  if (!worker) worker = new SeparationWorker();
  return worker;
}

function cancelSeparationWorker(): void {
  worker?.cancel();
}

function disposeSeparationWorker(): void {
  if (worker) {
    worker.dispose();
    worker = null;
  }
}

export { cancelSeparationWorker, disposeSeparationWorker, getSeparationWorker };
