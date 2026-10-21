import type { MbRecording } from "@/domain/musicbrainz/types";

// -- Fixtures -----------------------------------------------------------------

// Captured from musicbrainz.org on 2026-10-20, trimmed to the fields Composer reads.
const YOUR_POWER_ALBUM_RECORDING: MbRecording = {
  id: "977f733d-3fc3-4dbe-8f7c-4be52c9994c0",
  title: "Your Power",
  length: 245896,
  isrcs: ["USUM72105934"],
  "artist-credit": [
    { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
  ],
  releases: [
    {
      id: "c16ad033-0856-4b4b-a0fc-d8c889543b5e",
      title: "Your Power",
      status: "Withdrawn",
      date: "2021-04-29",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      "release-group": { id: "e7134d40-f3e3-4fc2-83e4-49ad363fea34", "primary-type": "Single", "secondary-types": [] },
    },
    {
      id: "c3da4a86-b866-4812-affe-d9458495c103",
      title: "Your Power",
      status: "Promotion",
      date: "2021-04-29",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      "release-group": { id: "e7134d40-f3e3-4fc2-83e4-49ad363fea34", "primary-type": "Single", "secondary-types": [] },
    },
    {
      id: "6e5528c1-a1b0-4bd5-80f8-824186177aae",
      title: "Your Power",
      status: "Official",
      date: "2021-04-29",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      "release-group": { id: "e7134d40-f3e3-4fc2-83e4-49ad363fea34", "primary-type": "Single", "secondary-types": [] },
    },
    {
      id: "1df486b6-625b-41d5-b517-e62133c35134",
      title: "NOW That’s What I Call Music! 79",
      status: "Official",
      date: "2021-06-21",
      "artist-credit": [
        { name: "Various Artists", artist: { id: "89ad4ac3-39f7-470e-963a-56509c546377", name: "Various Artists" } },
      ],
      "release-group": {
        id: "d96ebeb7-077f-4006-a942-2860444a650f",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "dce5cfbb-06df-464e-992b-f8fb79789d63",
      title: "Now That’s What I Call Music! 109",
      status: "Official",
      date: "2021-07-23",
      "artist-credit": [
        { name: "Various Artists", artist: { id: "89ad4ac3-39f7-470e-963a-56509c546377", name: "Various Artists" } },
      ],
      "release-group": {
        id: "2cee73c1-d770-4935-9828-9de1f3320536",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "5a8b1ccd-9695-4c59-8682-5a31561391ba",
      title: "Power Hits Estate 2021",
      status: "Official",
      date: "2021-07-29",
      "artist-credit": [
        { name: "Various Artists", artist: { id: "89ad4ac3-39f7-470e-963a-56509c546377", name: "Various Artists" } },
      ],
      "release-group": {
        id: "2f2964a5-a4d4-4ffe-ac85-8c88e1ac55c5",
        "primary-type": "Album",
        "secondary-types": ["Compilation"],
      },
    },
    {
      id: "d9dc4dce-edf3-4b42-9317-7e42e8a9dd34",
      title: "Happier Than Ever",
      status: "Official",
      date: "2021-07-30",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      "release-group": { id: "3ac5236a-3bd8-44c6-ab60-69b013594ae6", "primary-type": "Album", "secondary-types": [] },
    },
  ],
  relations: [
    {
      type: "performance",
      "target-type": "work",
      work: {
        id: "03a75386-2a79-40dd-aaf0-3304d12f7fe1",
        title: "Your Power",
        relations: [
          {
            type: "composer",
            "target-type": "artist",
            artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" },
          },
          {
            type: "composer",
            "target-type": "artist",
            artist: { id: "151cd917-1ee2-4702-859f-90899ad897f8", name: "FINNEAS" },
          },
          {
            type: "lyricist",
            "target-type": "artist",
            artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" },
          },
          {
            type: "lyricist",
            "target-type": "artist",
            artist: { id: "151cd917-1ee2-4702-859f-90899ad897f8", name: "FINNEAS" },
          },
          { type: "other version", "target-type": "work" },
        ],
      },
    },
  ],
};

const YOUR_POWER_ALBUM_RECORDING_ID = "977f733d-3fc3-4dbe-8f7c-4be52c9994c0";

// -- Exports ------------------------------------------------------------------

export { YOUR_POWER_ALBUM_RECORDING, YOUR_POWER_ALBUM_RECORDING_ID };
