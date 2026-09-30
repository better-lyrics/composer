import { FileDropZone } from "@/audio/file-drop-zone";
import { AUDIO_FORMATS_PROSE } from "@/domain/audio-file/supported-formats";
import { useStartNewSong } from "@/hooks/useStartNewSong";
import { PROJECT_FILE_ACCEPT } from "@/lib/project-file-read";
import { importProjectFile, importProjectFromInput } from "@/lib/project-import";
import { Button } from "@/ui/button";
import { IconField } from "@/ui/icon-field";
import { EDITOR_PATH } from "@/utils/app-routes";
import { cn } from "@/utils/cn";
import { INVALID_YOUTUBE_LINK_MESSAGE, extractVideoId } from "@/utils/youtube-url";
import { IconFileImport, IconLink, IconUpload } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Types --------------------------------------------------------------------

interface NewSongPanelProps {
  className?: string;
}

// -- Constants ----------------------------------------------------------------

const PANEL_STYLES =
  "flex flex-col gap-4 p-5 rounded-2xl bg-composer-input shadow-[inset_0_0_0_1px_var(--color-composer-border)] select-none";

const DROP_STYLES = cn(
  "size-auto w-full flex-row justify-start gap-3.5 p-3.5 rounded-[10px] border border-dashed border-composer-text/18",
  "hover:border-composer-accent hover:bg-composer-accent/6",
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-composer-accent",
);

// -- Sub-components -------------------------------------------------------------

const NewSongLink: React.FC<{ onCreate: (videoId: string) => void }> = ({ onCreate }) => {
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const videoId = extractVideoId(value);
    if (!videoId) {
      setError(INVALID_YOUTUBE_LINK_MESSAGE);
      return;
    }
    setError(null);
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
      <label htmlFor={inputId} className="block mb-1.5 text-[13px] font-medium text-composer-text-secondary">
        Or paste a YouTube link
      </label>
      <div className="flex gap-2">
        <IconField
          id={inputId}
          icon={IconLink}
          value={value}
          placeholder="youtube.com/watch?v=…"
          autoCapitalize="off"
          aria-invalid={error !== null}
          aria-describedby={hintId}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          wrapperClassName="flex-1"
        />
        <Button type="submit" variant="secondary" disabled={value.trim() === ""}>
          Create
        </Button>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={cn("mt-1.5 text-xs", error ? "text-composer-negative select-text" : "text-composer-text-muted")}
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
      <div className="flex items-center justify-between -my-1 -mr-3">
        <h2 id={headingId} className="text-[15px] font-bold">
          Start a new song
        </h2>
        <Button variant="quiet" size="sm" hasIcon onClick={() => importInputRef.current?.click()}>
          <IconFileImport aria-hidden="true" className="size-3.5" />
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
        className={DROP_STYLES}
      >
        <span className="grid place-items-center size-10 shrink-0 rounded-lg bg-composer-button text-composer-accent-text">
          <IconUpload aria-hidden="true" className="size-5" />
        </span>
        <span className="flex flex-col text-left">
          <strong className="text-sm font-medium">Drop an audio or project file, or choose one</strong>
          <small className="text-xs text-composer-text-muted">{AUDIO_FORMATS_PROSE}</small>
        </span>
      </FileDropZone>
      <NewSongLink onCreate={startWithVideo} />
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { NewSongPanel };
