import { type AlignmentModel, loadAlignmentModels } from "@/audio/alignment/hubertfa/model-manifest";
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

// -- Exports -------------------------------------------------------------------

export { useAlignmentModels };
