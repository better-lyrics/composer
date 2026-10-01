let context: AudioContext | null = null;

// Created on first use: constructing an AudioContext starts the audio device, which can block for 100+ ms.
function sharedAudioContext(): AudioContext {
  if (!context) context = new AudioContext();
  return context;
}

export { sharedAudioContext };
