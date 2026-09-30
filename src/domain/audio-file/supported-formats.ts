// -- Declaration ---------------------------------------------------------------

const ACCEPTED_AUDIO_TYPES: readonly string[] = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/flac",
];

const ACCEPTED_AUDIO_EXTENSIONS: readonly string[] = ["mp3", "wav", "m4a", "ogg", "flac"];

// -- Derived -------------------------------------------------------------------

const ACCEPTED_AUDIO_EXTENSION_REGEX = new RegExp(String.raw`\.(${ACCEPTED_AUDIO_EXTENSIONS.join("|")})$`, "i");

const AUDIO_FORMATS_PROSE = ACCEPTED_AUDIO_EXTENSIONS.map((extension) => extension.toUpperCase()).join(", ");

const UNSUPPORTED_AUDIO_FILE_MESSAGE = `Unsupported file type. Use ${ACCEPTED_AUDIO_EXTENSIONS.map((extension) => `.${extension}`).join(" ")}`;

// -- Predicate -----------------------------------------------------------------

function isSupportedAudioFile(file: Pick<File, "name" | "type">): boolean {
  return ACCEPTED_AUDIO_TYPES.includes(file.type) || ACCEPTED_AUDIO_EXTENSION_REGEX.test(file.name);
}

// -- Exports -------------------------------------------------------------------

export { AUDIO_FORMATS_PROSE, UNSUPPORTED_AUDIO_FILE_MESSAGE, isSupportedAudioFile };
