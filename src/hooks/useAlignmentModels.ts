import {
  type AlignmentModel,
  loadAlignmentModels,
  pickAlignmentModel,
} from "@/audio/alignment/hubertfa/model-manifest";
import { useSettingsStore } from "@/stores/settings";
import { useQuery } from "@tanstack/react-query";

// -- Hooks ---------------------------------------------------------------------

// The hosted manifest loads once per page and is shared with auto-align, so the
// query neither refetches nor cancels it.
const useAlignmentModels = (): AlignmentModel[] | undefined =>
  useQuery({
    queryKey: ["alignment-models"],
    queryFn: loadAlignmentModels,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
  }).data;

/** The model auto-align will use, once the manifest has loaded. */
const useSelectedAlignmentModel = (): AlignmentModel | null => {
  const modelId = useSettingsStore((s) => s.alignmentModelId);
  const models = useAlignmentModels();
  return models ? pickAlignmentModel(models, modelId) : null;
};

// -- Exports -------------------------------------------------------------------

export { useAlignmentModels, useSelectedAlignmentModel };
