import {
  LYRICS_FILE_ACCEPT_ATTRIBUTE,
  LYRICS_FORMATS_COMPACT,
  UNSUPPORTED_LYRICS_FILE_MESSAGE,
  isSupportedLyricsFile,
} from "@/domain/lyrics-file/supported-formats";
import { PROJECT_FILE_ACCEPT, PROJECT_FILE_EXTENSIONS_LABEL, isProjectFileName } from "@/lib/project-file-read";

// -- Derived ------------------------------------------------------------------

const LYRICS_IMPORT_ACCEPT_ATTRIBUTE = `${LYRICS_FILE_ACCEPT_ATTRIBUTE},${PROJECT_FILE_ACCEPT}`;

const LYRICS_IMPORT_FORMATS_COMPACT = `${LYRICS_FORMATS_COMPACT} ${PROJECT_FILE_EXTENSIONS_LABEL}`;

const PROJECT_FILE_PROSE = `a project file (${PROJECT_FILE_EXTENSIONS_LABEL})`;

const UNSUPPORTED_LYRICS_IMPORT_MESSAGE = `${UNSUPPORTED_LYRICS_FILE_MESSAGE} or ${PROJECT_FILE_PROSE}`;

// -- Predicate ----------------------------------------------------------------

function isLyricsImportFileName(name: string): boolean {
  return isSupportedLyricsFile(name) || isProjectFileName(name);
}

// -- Exports ------------------------------------------------------------------

export {
  LYRICS_IMPORT_ACCEPT_ATTRIBUTE,
  LYRICS_IMPORT_FORMATS_COMPACT,
  PROJECT_FILE_PROSE,
  UNSUPPORTED_LYRICS_IMPORT_MESSAGE,
  isLyricsImportFileName,
};
