declare module "signalsmith-stretch" {
  interface StretchSchedule {
    outputTime?: number;
    active?: boolean;
    input?: number;
    rate?: number;
  }

  interface StretchNode extends AudioWorkletNode {
    inputTime: number;
    schedule(change: StretchSchedule, adjustPrevious?: boolean): Promise<StretchSchedule>;
    addBuffers(channels: Float32Array[]): Promise<number>;
    dropBuffers(): Promise<{ start: number; end: number }>;
    latency(): Promise<number>;
    configure(config: { blockMs?: number; intervalMs?: number }): Promise<void>;
  }

  const SignalsmithStretch: {
    (context: BaseAudioContext, options?: AudioWorkletNodeOptions): Promise<StretchNode>;
    moduleUrl?: string;
  };
  export default SignalsmithStretch;
  export type { StretchNode };
}
