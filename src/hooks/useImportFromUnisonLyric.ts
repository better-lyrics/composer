import { useUnisonLyric } from "@/hooks/unison/useUnisonLyric";
import { useProjectIndex } from "@/hooks/useProjectIndex";
import { openUnisonLyricFromLink } from "@/lib/unison/open-unison-lyric";
import { getPersistenceSettled, markLinkProjectSettled } from "@/lib/persistence-settled";
import { UNISON_LYRIC_PARAM, readBootUnisonLyric } from "@/utils/incoming-link";
import { showUnisonLyricLinkFailedToast } from "@/utils/unison-toast";
import { stripQueryParams } from "@/utils/url-params";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[Boot]";

// -- Hook ---------------------------------------------------------------------

// A valid link settles the link project, so the ?v= hook leaves that signal to this one.
function useImportFromUnisonLyric(): void {
  // Read at render: the effect below strips the param.
  const [link] = useState(readBootUnisonLyric);
  const lyricQuery = useUnisonLyric(link.id);
  const index = useProjectIndex();
  const navigate = useNavigate();
  const appliedRef = useRef(false);
  const [persistenceSettled, setPersistenceSettled] = useState(false);

  useEffect(() => {
    if (!link.present) return;
    stripQueryParams([UNISON_LYRIC_PARAM]);
    if (link.id === null) {
      showUnisonLyricLinkFailedToast();
      return;
    }
    return () => {
      if (!appliedRef.current) markLinkProjectSettled("failed");
    };
  }, [link]);

  useEffect(() => {
    if (link.id === null) return;
    void getPersistenceSettled().then(() => setPersistenceSettled(true));
  }, [link.id]);

  useEffect(() => {
    if (link.id === null || lyricQuery.status === "pending" || appliedRef.current) return;
    if (lyricQuery.status === "error") {
      appliedRef.current = true;
      console.warn(LOG_PREFIX, "could not fetch the linked Unison lyric", lyricQuery.error);
      showUnisonLyricLinkFailedToast();
      markLinkProjectSettled("failed");
      return;
    }
    if (!persistenceSettled || (!index.entries && !index.error)) return;
    appliedRef.current = true;
    if (!index.entries) console.warn(LOG_PREFIX, "project index unread, opening the Unison lyric unlinked");
    openUnisonLyricFromLink(lyricQuery.data, index.entries ?? null, navigate)
      .then((opened) => markLinkProjectSettled(opened ? "created" : "failed"))
      .catch((error: unknown) => {
        console.error(LOG_PREFIX, "could not open the linked Unison lyric", error);
        showUnisonLyricLinkFailedToast();
        markLinkProjectSettled("failed");
      });
  }, [
    link.id,
    lyricQuery.status,
    lyricQuery.data,
    lyricQuery.error,
    persistenceSettled,
    index.entries,
    index.error,
    navigate,
  ]);
}

// -- Exports ------------------------------------------------------------------

export { useImportFromUnisonLyric };
