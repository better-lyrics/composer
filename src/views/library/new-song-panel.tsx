import { IconFileImport, IconLink, IconUpload } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileDropZone } from "@/audio/file-drop-zone";
import { AUDIO_FORMATS_PROSE } from "@/domain/audio-file/supported-formats";
import { useFieldError } from "@/hooks/useFieldError";
import { useStartNewSong } from "@/hooks/useStartNewSong";
import { PROJECT_FILE_ACCEPT } from "@/lib/project-file-read";
import { importProjectFile, importProjectFromInput } from "@/lib/project-import";
import { Button } from "@/ui/button";
import { DropTileContent } from "@/ui/drop-tile";
import { DROP_TILE_STYLES, RECESSED_TINT } from "@/ui/drop-tile-styles";
import { IconField } from "@/ui/icon-field";
import { EDITOR_PATH } from "@/utils/app-routes";
import { cn } from "@/utils/cn";
import { extractVideoId, INVALID_YOUTUBE_LINK_MESSAGE } from "@/utils/youtube-url";

// -- Types --------------------------------------------------------------------

interface NewSongPanelProps {
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const EMPTY_LINK_MESSAGE = "Paste a YouTube link first";

const PANEL_STYLES =
  "flex flex-col gap-4 p-5 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] select-none";

// -- Sub-components -------------------------------------------------------------

const NewSongLink: React.FC<{ onCreate: (videoId: string) => void }> = ({ onCreate }) => {
  const hintId = useId();
  const [value, setValue] = useState("");
  const { error, showError, clearError, fieldProps } = useFieldError();

  const submit = () => {
    if (value.trim() === "") {
      showError(EMPTY_LINK_MESSAGE);
      return;
    }
    const videoId = extractVideoId(value);
    if (!videoId) {
      showError(INVALID_YOUTUBE_LINK_MESSAGE);
      return;
    }
    clearError();
    setValue("");
    onCreate(videoId);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={fieldProps.id} className="block mb-2 text-xs text-(--muted)">
        Or paste a YouTube link
      </label>
      <div className="flex gap-2">
        <IconField
          id={fieldProps.id}
          icon={IconLink}
          value={value}
          placeholder="youtube.com/watch?v=…"
          autoCapitalize="off"
          aria-invalid={error !== null}
          aria-describedby={hintId}
          onChange={(event) => {
            setValue(event.target.value);
            clearError();
          }}
          wrapperClassName="flex-1"
          className={cn("h-9 rounded-[10px]", RECESSED_TINT)}
        />
        <Button type="submit" variant="secondary" size="lg">
          Create
        </Button>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={cn("mt-2 text-xs", error ? "text-composer-negative select-text" : "text-composer-text-muted")}
      >
        {error ?? "Each song gets its own project."}
      </p>
    </form>
  );
};

// -- Component ----------------------------------------------------------------

const NewSongPanel: React.FC<NewSongPanelProps> = ({ className }) => {
  const headingId = useId();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);
  const { startWithFile, startWithVideo } = useStartNewSong();

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (await importProjectFromInput(event)) navigate(EDITOR_PATH);
  };

  const handleProjectFileDrop = async (file: File) => {
    if (await importProjectFile(file)) navigate(EDITOR_PATH);
  };

  return (
    <section aria-labelledby={headingId} className={cn(PANEL_STYLES, className)}>
      <div className="flex items-center justify-between -my-1 -mr-1.5">
        <h2 id={headingId} className="text-[15px] font-bold">
          Start a new song
        </h2>
        <Button variant="ghost" size="sm" hasIcon onClick={() => importInputRef.current?.click()}>
          <IconFileImport aria-hidden="true" className="size-4" />
          Import project
        </Button>
        <input
          ref={importInputRef}
          type="file"
          aria-label="Import project file"
          accept={PROJECT_FILE_ACCEPT}
          onChange={handleImport}
          className="hidden"
        />
      </div>
      <FileDropZone
        accept="audio/*"
        onFileDrop={startWithFile}
        onProjectFileDrop={(file) => void handleProjectFileDrop(file)}
        className={DROP_TILE_STYLES}
      >
        <DropTileContent
          icon={<IconUpload aria-hidden="true" className="size-[18px]" />}
          title="Drop an audio or project file"
          detail={AUDIO_FORMATS_PROSE}
        />
      </FileDropZone>
      <NewSongLink onCreate={startWithVideo} />
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { NewSongPanel };
