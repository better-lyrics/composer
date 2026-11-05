import type { ModelTerms } from "@/audio/alignment/hubertfa/model-manifest";
import type { CachedModel } from "@/audio/separation/model-cache";

// -- Types --------------------------------------------------------------------

interface HostedFile {
  name: string;
  bytes: number;
  sha256: string;
}

// -- Constants ----------------------------------------------------------------

// Files are named for their contents (v1 = this export), so a new export never replaces a cached one.
const DIRECTORY = "mel-band-roformer";
const NOTICE_FILE = "MEL_BAND_ROFORMER_KJ_NOTICE.txt";

const PARTS: readonly HostedFile[] = [
  {
    name: "mbr_kj_fp16_v1_part00.onnx",
    bytes: 6335233,
    sha256: "2e061e8fb14c5a996ac251a2de9e48d6d07a9332ab8723f6267c968cb68f1a43",
  },
  {
    name: "mbr_kj_fp16_v1_part01.onnx",
    bytes: 4387711,
    sha256: "b2befff82db52cb9cf2597b577f54e41479870bbf9e562750c71f1ae891d36ae",
  },
  {
    name: "mbr_kj_fp16_v1_part02.onnx",
    bytes: 3996293,
    sha256: "b773fc51f252d88109e4905b1688d6f4a77244ac3f9da567196bffc993d4f490",
  },
  {
    name: "mbr_kj_fp16_v1_part03.onnx",
    bytes: 4182561,
    sha256: "a606398fd02e465a79eb0d91770caca91911eff864be4f8d9a0f33025bd4fc52",
  },
  {
    name: "mbr_kj_fp16_v1_part04.onnx",
    bytes: 3980819,
    sha256: "1d7fc728c2c8621e10e4bbfd9e09653ccd4c4320c2b317957b266af77ad83cc3",
  },
  {
    name: "mbr_kj_fp16_v1_part05.onnx",
    bytes: 4182564,
    sha256: "235eacfe644765939da81fd6131e2e4f4e89bff3a2362e40f0013d5cd1fba1f5",
  },
  {
    name: "mbr_kj_fp16_v1_part06.onnx",
    bytes: 3980825,
    sha256: "f29c39cafce1ca5d618233dc37e1b1e9f9eed23c0cb78f0548bd51f708a75fb1",
  },
  {
    name: "mbr_kj_fp16_v1_part07.onnx",
    bytes: 4182567,
    sha256: "aa5a15c230aaec43f22a796ee805b14e1615d2cdfdcb80d1dbcb1a394de5f3f1",
  },
  {
    name: "mbr_kj_fp16_v1_part08.onnx",
    bytes: 3980825,
    sha256: "6936566ac381cb37066ae65c0ced51a9156034495096817293b07609d96d6172",
  },
  {
    name: "mbr_kj_fp16_v1_part09.onnx",
    bytes: 4182567,
    sha256: "2bb51e79096683a7ea40b398e6343801004a53c69706a12e668b2b68bf254d0a",
  },
  {
    name: "mbr_kj_fp16_v1_part10.onnx",
    bytes: 3980832,
    sha256: "c82e5ed40bf76a17116c7ff5306ea8b168b130d34d468955134da0afa8bea166",
  },
  {
    name: "mbr_kj_fp16_v1_part11.onnx",
    bytes: 4182581,
    sha256: "8831e2f8b2901d6c9c9ab0442f2df49c542ac0bcbe8df2cd98cd8a4789491dcf",
  },
  {
    name: "mbr_kj_fp16_v1_part12.onnx",
    bytes: 3980507,
    sha256: "39c6988a6cb1748c9d01256e8c754edae83159e57e782f256516e2401565e6ee",
  },
  {
    name: "mbr_kj_fp16_v1_part13.onnx",
    bytes: 403191709,
    sha256: "cab5cde9bc85544829a8c3243b2f3d60413481d5123b005a41ce1215d9d99132",
  },
];

const ROFORMER_FILE_NAMES: readonly string[] = PARTS.map((file) => file.name);
const ROFORMER_APPROX_BYTES = PARTS.reduce((sum, file) => sum + file.bytes, 0);

// -- Functions ----------------------------------------------------------------

/** The model's consecutive graphs, in run order. */
function roformerParts(baseUrl: string): CachedModel[] {
  return PARTS.map((file) => ({
    url: `${baseUrl}/${DIRECTORY}/${file.name}`,
    approxBytes: file.bytes,
    sha256: file.sha256,
  }));
}

function roformerTerms(baseUrl: string): ModelTerms {
  return {
    notice: "Mel-Band RoFormer vocal model by Kimberley Jensen, MIT License.",
    url: `${baseUrl}/${DIRECTORY}/${NOTICE_FILE}`,
  };
}

// -- Exports ------------------------------------------------------------------

export { ROFORMER_APPROX_BYTES, ROFORMER_FILE_NAMES, roformerParts, roformerTerms };
