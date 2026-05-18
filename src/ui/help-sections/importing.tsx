import { getEffectiveKeysArray } from "@/stores/shortcut-bindings";
import { HEADING, PROSE } from "@/ui/help-sections/shared";
import { InlineKeyBadge } from "@/ui/inline-key-badge";

// -- Importing Audio ----------------------------------------------------------

const ImportSection: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h4 className={HEADING}>Audio files</h4>
      <p className={PROSE}>Supported formats: MP3, WAV, M4A, OGG, FLAC.</p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>Use the Import tab's drop zone, or drop a file directly onto the Timeline empty state.</li>
        <li>Once loaded, the waveform renders across the top of Timeline.</li>
        <li>The file name auto-fills the project title in metadata.</li>
        <li>To replace audio, just drop a new file on the Import tab.</li>
      </ul>
      <p className={`${PROSE} mt-3`}>
        For YouTube imports, audio comes from a Cobalt backend. Composer ships with a default instance that handles
        verification automatically. If it's slow or unreachable, add or pick a different one in Settings → Advanced.
        Each custom instance shows a small status icon next to its name reflecting the last attempt, with the actual
        error in the tooltip if anything went wrong.
      </p>
    </div>

    <div>
      <h4 className={HEADING}>YouTube URLs</h4>
      <p className={PROSE}>
        Paste any YouTube link (full URL, share link, or just the video ID) into the Import tab. Composer downloads the
        audio once and keeps it in memory, so seeking and waveform rendering stay instant after that.
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>The video title fills in as your project title.</li>
        <li>To swap videos, paste a new URL into the same input on the Import tab.</li>
        <li>If a download fails, check that the URL is right and that the video is public.</li>
        <li>
          A small number of videos won't download due to geo-restrictions or rights blocks. In that case, grab the audio
          some other way and drop the file into the Import tab.
        </li>
      </ul>
    </div>

    <div>
      <h4 className={HEADING}>Lyrics files</h4>
      <p className={PROSE}>
        Supported formats: .txt (plain text), .lrc (line-level timing), .srt (subtitles), .ttml (full timing + agents).
      </p>
      <ul className={`${PROSE} list-disc pl-4 mt-1.5 space-y-1`}>
        <li>In the Edit tab, use the import button at the top.</li>
        <li>
          In Timeline, press <InlineKeyBadge keys={getEffectiveKeysArray("timeline.importLyrics")} /> or click the
          import button in the header.
        </li>
        <li>When importing .lrc, .srt, or .ttml files, existing timing is preserved.</li>
        <li>Plain .txt files get no timing. You'll sync them manually.</li>
      </ul>
    </div>
  </div>
);

// -- Exports ------------------------------------------------------------------

export { ImportSection };
