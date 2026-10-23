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
  "flex flex-col gap-4 p-5 rounded-xl bg-(--layer-1) shadow-[inset_0_0_0_1px_var(--edge)] select-none";

const FIELD_TINT = "bg-[color-mix(in_oklab,var(--color-composer-bg-dark)_28%,transparent)]";

const DROP_STYLES = cn(
  "size-auto w-full flex-row justify-start gap-3.5 p-3.5 rounded-[10px] border-[1.5px] border-dashed transition-colors",
  FIELD_TINT,
  "border-[color-mix(in_oklab,var(--ink)_13%,transparent)] hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]",
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
      <label htmlFor={inputId} className="block mb-2 text-xs text-(--muted)">
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
          className={cn("h-9 rounded-[10px]", FIELD_TINT)}
        />
        <Button type="submit" variant="secondary" size="lg" disabled={value.trim() === ""}>
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
        className={DROP_STYLES}
      >
        <span className="grid place-items-center size-10 shrink-0 rounded-[10px] btn-raised text-(--label)">
          <IconUpload aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="flex flex-col text-left">
          <strong className="text-sm font-medium">Drop an audio or project file</strong>
          <small className="mt-0.5 text-xs text-(--muted)">{AUDIO_FORMATS_PROSE}</small>
        </span>
      </FileDropZone>
      <NewSongLink onCreate={startWithVideo} />
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { NewSongPanel };
