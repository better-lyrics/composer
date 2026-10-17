import {
  type RecoverableProject,
  downloadAllRecoverableProjects,
  downloadRecoverableProject,
  listRecoverableProjects,
} from "@/lib/recovery";
import { Button } from "@/ui/button";
import { formatSavedWorkSummary } from "@/utils/format-saved-at";
import { formatProjectCount } from "@/utils/project-count";
import { IconDownload } from "@tabler/icons-react";
import { useEffect, useId, useState } from "react";

// -- Constants ----------------------------------------------------------------

const LOG_PREFIX = "[RecoverProjectList]";
const MIN_PROJECTS_FOR_LIST = 2;

// -- Component ----------------------------------------------------------------

const RecoverProjectList: React.FC = () => {
  const headingId = useId();
  const [projects, setProjects] = useState<RecoverableProject[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRecoverableProjects().then(
      (list) => {
        if (!cancelled) setProjects(list);
      },
      (error: unknown) => console.error(LOG_PREFIX, "could not list the projects", error),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (projects.length < MIN_PROJECTS_FOR_LIST) return null;

  const downloadAll = async () => {
    try {
      const count = await downloadAllRecoverableProjects();
      setMessage(count === 0 ? "Nothing to download." : `Downloaded ${formatProjectCount(count)} as one file.`);
    } catch (error) {
      console.error(LOG_PREFIX, "could not download every project", error);
      setMessage("Couldn't download your projects. Try again.");
    }
  };

  const downloadOne = async (key: string) => {
    try {
      const result = await downloadRecoverableProject(key);
      setMessage(result.found ? null : "Couldn't download that project. Try again.");
    } catch (error) {
      console.error(LOG_PREFIX, "could not download a project", error);
      setMessage("Couldn't download that project. Try again.");
    }
  };

  return (
    <section aria-labelledby={headingId} className="w-full flex flex-col gap-3 text-left">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 id={headingId} className="text-sm font-medium text-composer-text">
            Every project on this device
          </h2>
          <p className="text-xs text-composer-text-muted">{formatProjectCount(projects.length)}</p>
        </div>
        <Button variant="secondary" size="sm" hasIcon onClick={downloadAll}>
          <IconDownload size={14} aria-hidden="true" />
          Download all
        </Button>
      </div>
      <ul className="flex flex-col max-h-72 overflow-y-auto rounded-lg border border-composer-border divide-y divide-composer-border">
        {projects.map((project) => (
          <li key={project.key} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-composer-text truncate select-text">{project.title}</p>
              <p className="text-xs text-composer-text-muted select-text">
                {formatSavedWorkSummary(project.lineCount, project.savedAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              hasIcon
              aria-label={`Download ${project.title}`}
              onClick={() => downloadOne(project.key)}
            >
              <IconDownload size={14} aria-hidden="true" />
              Download
            </Button>
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="text-xs text-composer-text-muted select-text">
          {message}
        </p>
      )}
    </section>
  );
};

// -- Exports ------------------------------------------------------------------

export { RecoverProjectList };
