import type { MbSearchResponse } from "@/domain/musicbrainz/types";

// -- Fixtures -----------------------------------------------------------------

// Captured from musicbrainz.org on 2026-10-20, trimmed to the fields Composer reads.
const YOUR_POWER_SEARCH: MbSearchResponse = {
  recordings: [
    {
      id: "977f733d-3fc3-4dbe-8f7c-4be52c9994c0",
      title: "Your Power",
      length: 245896,
      score: 100,
      isrcs: ["USUM72105934"],
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "d262ed02-9a5a-43d6-8652-33b8fefbb345",
          title: "L'Intégrale de ses albums",
          status: "Official",
          date: "2025-11-21",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "cb32c113-b2d7-4535-b7ec-04b6218d4702",
            "primary-type": "Album",
            "secondary-types": ["Compilation"],
          },
        },
      ],
    },
    {
      id: "6994dde8-fac7-4118-bebd-f27c8694d3d0",
      title: "Your Power",
      length: 245000,
      score: 100,
      disambiguation: "acapella",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "1f5c26d8-504c-4afe-8483-dc4bc45b07ce",
          title: "Happier Than Ever: Acapellas",
          status: "Bootleg",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "07b12d09-f25f-43ec-9361-600f373843d4",
            "primary-type": "Album",
            "secondary-types": ["Remix"],
          },
        },
      ],
    },
    {
      id: "9032dd6c-8b01-43eb-b3a6-1e67fb711c45",
      title: "YOUR POWER",
      score: 100,
      disambiguation: "live, 2025-07: Co‐op Live, Manchester, England, UK",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "28a698b6-4bcd-4d97-a1ff-c3c676537d1f",
          title: "HIT ME HARD AND SOFT: THE TOUR (LIVE)",
          status: "Official",
          date: "2026-05-01",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "14fcdc7c-8b2c-481c-8f7e-9d53d31a5db1",
            "primary-type": "Album",
            "secondary-types": ["Live"],
          },
        },
      ],
    },
    {
      id: "60dacd14-4dac-4fec-bd57-a16a0f28469b",
      title: "Your Power",
      length: 246000,
      score: 100,
      disambiguation: "Dolby Atmos, explicit",
      isrcs: ["USUM72107142"],
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "adb16df5-9585-4869-9f61-772952bffa19",
          title: "Happier Than Ever",
          status: "Official",
          date: "2021-07-30",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "3ac5236a-3bd8-44c6-ab60-69b013594ae6",
            "primary-type": "Album",
            "secondary-types": [],
          },
        },
      ],
    },
    {
      id: "e8f5be0f-930d-4980-91e7-01bec26268fb",
      title: "Your Power",
      length: 263000,
      score: 100,
      disambiguation: "music video",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
    },
    {
      id: "9a252de5-d1f9-4094-9a1c-99be89be0ed0",
      title: "Your Power",
      length: 232000,
      score: 100,
      disambiguation: "live, Prime Day Show",
      isrcs: ["USUM72110526"],
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "f0a24935-eed6-42f6-a6a4-35238b1bf95c",
          title: "Prime Day Show x Billie Eilish",
          status: "Official",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "84e205d1-64a1-46ca-9749-f4f093d3e8ab",
            "primary-type": "EP",
            "secondary-types": ["Live"],
          },
        },
      ],
    },
    {
      id: "acd65ca1-9d86-4c6f-9db5-fd97e956a200",
      title: "Billie on Your Power",
      length: 29000,
      score: 91,
      disambiguation: "Spotify “Lyric Mode”",
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "b151c401-ab59-448f-a28f-30bca17fefd2",
          title: "Happier Than Ever: Lyric Mode",
          status: "Promotion",
          date: "2021-07-30",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "9716f227-bd74-48a8-b19e-1534624e6411",
            "primary-type": "Other",
            "secondary-types": ["Interview"],
          },
        },
      ],
    },
    {
      id: "93cd1c9f-c369-47d0-8407-2905e4c10060",
      title: "Your Power (Vevo live performance)",
      score: 87,
      "artist-credit": [
        { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
      ],
      releases: [
        {
          id: "a2fa6cac-4acb-45c1-9f7a-feb56c51a62e",
          title: "Happier Than Ever",
          status: "Official",
          date: "2021-07-30",
          "artist-credit": [
            { name: "Billie Eilish", artist: { id: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533", name: "Billie Eilish" } },
          ],
          "release-group": {
            id: "3ac5236a-3bd8-44c6-ab60-69b013594ae6",
            "primary-type": "Album",
            "secondary-types": [],
          },
        },
      ],
    },
  ],
};

// -- Exports ------------------------------------------------------------------

export { YOUR_POWER_SEARCH };
