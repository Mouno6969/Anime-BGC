/**
 * ANIME BGC — mock data + UI constants.
 * Live data now comes from the backend (see lib/api.ts). This file keeps the
 * shared `Anime` type (re-exported) plus a few static UI constants (LOGO,
 * genres, scheduleDays) and demo arrays still used as graceful fallbacks.
 */
import type { Anime as SharedAnime, MediaType as SharedMediaType } from "@shared/anime";
export type Anime = SharedAnime;
export type { MediaType } from "@shared/anime";

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663772861672/dGtWumMEybNb6qqzta3Ciu";

export const heroBanners = [
  `${CDN}/hero1-JJaSamuTB7JhvhSBqJxa9Z.webp`,
  `${CDN}/hero5-KK5zXrQojFiy4J7gVbhPbH.webp`,
  `${CDN}/hero2-o4xuYCHj5aFJRcwddKaivq.webp`,
  `${CDN}/hero3-UTWzHuAmNmHdAwMJCE7aAy.webp`,
  `${CDN}/hero4-27YAcss2tKsfJY32YXUfKh.webp`,
];

export const LOGO = `${CDN}/logo-CupbMkTQaWreh9tsBsHJVe.webp`;

export const posters = {
  p1: `${CDN}/p1-A8D2JELMtty6QmDVg3ix8E.webp`,
  p2: `${CDN}/p2-FrgTdn3cWphGkZCeDTLYPt.webp`,
  p3: `${CDN}/p3-V7AohMUkgmYcFRzLijnZw5.webp`,
  p4: `${CDN}/p4-YehkHA5kWRfQ8iQBebsxia.webp`,
  p5: `${CDN}/p5-d4xsjpsefHwi8PHhePLJzW.webp`,
  p6: `${CDN}/p6-fVEEeHaSd7UDxDgHQG3gdK.webp`,
  p7: `${CDN}/p7-5FeqjwmkupSZsTqgKkfWMz.webp`,
  p8: `${CDN}/p8-at2pY2sCDBWbwHH837M663.webp`,
  p9: `${CDN}/p9-drNKb7oYJQ5aNaXEnWEodJ.webp`,
  p10: `${CDN}/p10-cxj8vG5BqZnzfEFTDzvbxg.webp`,
};


export const genres = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

export const featured: Anime[] = [
  {
    id: 1,
    title: "Shirai no Kenshi",
    poster: posters.p1,
    banner: heroBanners[0],
    type: "TV",
    year: 2026,
    episodes: 12,
    totalEpisodes: 24,
    score: 88,
    duration: "24 mins",
    genres: ["Action", "Supernatural", "Drama"],
    studio: "Aurora Works",
    synopsis:
      "Under a sky split by violet lightning, a wandering swordsman carries a blade that hums with the storms of the dead. Hunted by an empire that fears his power, he searches the ruined frontier for the one person who can still call him by his name.",
    airingLabel: "EP 12 Airing Now",
  },
  {
    id: 5,
    title: "Twin Blades of the Ash Court",
    poster: posters.p4,
    banner: heroBanners[1],
    type: "TV",
    year: 2026,
    episodes: 9,
    totalEpisodes: 13,
    score: 84,
    duration: "24 mins",
    genres: ["Action", "Fantasy", "Horror"],
    studio: "Nightbloom Studio",
    synopsis:
      "When a shadow older than the kingdom claws its way out of a burning fortress, a hooded duelist with twin energy blades is the only thing standing between the living and a hunger that never sleeps.",
    airingLabel: "EP 9 Airing Now",
  },
  {
    id: 3,
    title: "Grimoire of the Pale Witch",
    poster: posters.p3,
    banner: heroBanners[2],
    type: "ONA",
    year: 2026,
    episodes: 13,
    score: 86,
    duration: "24 mins",
    genres: ["Fantasy", "Mystery", "Mahou Shoujo"],
    studio: "Lumen Pictures",
    synopsis:
      "A silver-haired archivist guards a library of forbidden books on a chain of floating islands. But one volume refuses to stay shut — and the spell it whispers could rewrite the dawn itself.",
    airingLabel: "EP 13 Airing Now",
  },
  {
    id: 11,
    title: "Steel Requiem: Project Violet",
    poster: posters.p5,
    banner: heroBanners[3],
    type: "TV",
    year: 2026,
    episodes: 7,
    totalEpisodes: 12,
    score: 81,
    duration: "24 mins",
    genres: ["Mecha", "Sci-Fi", "Action"],
    studio: "Helix Animation",
    synopsis:
      "In a city reduced to embers and rebar, a salvaged war machine wakes with a pilot who has no memory and a mission carved into its core. Powering up means remembering everything she tried to forget.",
    airingLabel: "EP 7 Airing Now",
  },
  {
    id: 12,
    title: "The Rooftop Where We Said Goodbye",
    poster: posters.p2,
    banner: heroBanners[4],
    type: "TV",
    year: 2026,
    episodes: 8,
    totalEpisodes: 12,
    score: 79,
    duration: "23 mins",
    genres: ["Romance", "Slice of Life", "Drama"],
    studio: "Soft Light Studio",
    synopsis:
      "Two students promise to meet on the school rooftop every sunset until graduation. As the petals fall and the year runs out, they learn that the hardest distance to close is the one between two hearts that already know.",
    airingLabel: "EP 8 Airing Now",
  },
];

function mk(
  id: number,
  title: string,
  poster: string,
  type: SharedMediaType,
  year: number,
  episodes: number,
  score: number,
  genres: string[],
): Anime {
  return {
    id,
    title,
    poster,
    banner: poster,
    type,
    year,
    episodes,
    score,
    duration: "24 mins",
    genres,
    studio: "Studio BGC",
    synopsis: "",
  };
}

export const newest: Anime[] = [
  mk(101, "Shirai no Kenshi", posters.p1, "TV", 2026, 12, 88, ["Action"]),
  mk(102, "Re:Birth Protocol", posters.p5, "TV", 2026, 11, 80, ["Sci-Fi"]),
  mk(103, "Springtime, Twice Over", posters.p2, "TV", 2026, 12, 75, ["Romance"]),
  mk(104, "Grimoire of the Pale Witch", posters.p3, "ONA", 2026, 13, 86, ["Fantasy"]),
  mk(105, "Blade of the Falling Sun", posters.p4, "TV", 2026, 12, 84, ["Action"]),
  mk(106, "Picnic Pals", posters.p9, "TV_SHORT", 2026, 24, 71, ["Slice of Life"]),
  mk(107, "Knight of the Glass Cathedral", posters.p7, "TV", 2026, 12, 83, ["Fantasy"]),
  mk(108, "Neon Rain Detective", posters.p8, "TV", 2026, 11, 78, ["Mystery"]),
  mk(109, "Slime & the Hidden Glade", posters.p10, "ONA", 2026, 13, 82, ["Fantasy"]),
  mk(110, "Grand Line Dawn", posters.p6, "TV", 2026, 14, 87, ["Adventure"]),
  mk(111, "Steel Requiem", posters.p5, "TV", 2026, 7, 81, ["Mecha"]),
  mk(112, "Twin Blades", posters.p4, "TV", 2026, 9, 84, ["Action"]),
];

export const popular: Anime[] = [
  mk(201, "Grand Line Dawn", posters.p6, "TV", 2025, 64, 89, ["Adventure"]),
  mk(202, "Blade of the Falling Sun", posters.p4, "TV", 2026, 12, 90, ["Action"]),
  mk(203, "Re:Birth Protocol", posters.p5, "TV", 2026, 11, 85, ["Sci-Fi"]),
  mk(204, "Knight of the Glass Cathedral", posters.p7, "TV", 2026, 12, 86, ["Fantasy"]),
  mk(205, "Grimoire of the Pale Witch", posters.p3, "ONA", 2026, 13, 88, ["Fantasy"]),
  mk(206, "Shirai no Kenshi", posters.p1, "TV", 2026, 12, 91, ["Action"]),
  mk(207, "Neon Rain Detective", posters.p8, "TV", 2026, 11, 82, ["Mystery"]),
  mk(208, "Slime & the Hidden Glade", posters.p10, "ONA", 2026, 13, 83, ["Fantasy"]),
  mk(209, "Springtime, Twice Over", posters.p2, "TV", 2026, 12, 80, ["Romance"]),
  mk(210, "Picnic Pals", posters.p9, "TV_SHORT", 2026, 24, 76, ["Slice of Life"]),
  mk(211, "Twin Blades", posters.p4, "TV", 2026, 9, 84, ["Action"]),
  mk(212, "Steel Requiem", posters.p5, "TV", 2026, 7, 81, ["Mecha"]),
];

export const topRated: Anime[] = [
  mk(301, "Shirai no Kenshi", posters.p1, "TV", 2026, 12, 94, ["Action"]),
  mk(302, "Blade of the Falling Sun", posters.p4, "MOVIE", 2025, 1, 93, ["Action"]),
  mk(303, "Grand Line Dawn", posters.p6, "TV", 1999, 1167, 92, ["Adventure"]),
  mk(304, "Grimoire of the Pale Witch", posters.p3, "ONA", 2026, 13, 91, ["Fantasy"]),
  mk(305, "Knight of the Glass Cathedral", posters.p7, "TV", 2026, 12, 90, ["Fantasy"]),
  mk(306, "Re:Birth Protocol", posters.p5, "TV", 2026, 11, 89, ["Sci-Fi"]),
  mk(307, "Neon Rain Detective", posters.p8, "MOVIE", 2024, 1, 88, ["Mystery"]),
  mk(308, "The Rooftop Goodbye", posters.p2, "TV", 2026, 12, 87, ["Romance"]),
  mk(309, "Slime & the Hidden Glade", posters.p10, "ONA", 2026, 13, 86, ["Fantasy"]),
  mk(310, "Picnic Pals", posters.p9, "TV_SHORT", 2022, 354, 85, ["Slice of Life"]),
  mk(311, "Twin Blades", posters.p4, "TV", 2026, 9, 85, ["Action"]),
  mk(312, "Steel Requiem", posters.p5, "TV", 2026, 7, 84, ["Mecha"]),
];

export const trending: Anime[] = [
  mk(401, "Shirai no Kenshi", posters.p1, "TV", 2026, 12, 88, ["Action"]),
  mk(402, "Grimoire of the Pale Witch", posters.p3, "ONA", 2026, 13, 86, ["Fantasy"]),
  mk(403, "Steel Requiem", posters.p5, "TV", 2026, 7, 81, ["Mecha"]),
  mk(404, "Twin Blades", posters.p4, "TV", 2026, 9, 84, ["Action"]),
  mk(405, "Knight of the Glass Cathedral", posters.p7, "TV", 2026, 12, 83, ["Fantasy"]),
  mk(406, "Neon Rain Detective", posters.p8, "TV", 2026, 11, 78, ["Mystery"]),
  mk(407, "Grand Line Dawn", posters.p6, "TV", 2025, 64, 89, ["Adventure"]),
  mk(408, "Slime & the Hidden Glade", posters.p10, "ONA", 2026, 13, 82, ["Fantasy"]),
];

export const movies: Anime[] = [
  mk(501, "Blade of the Falling Sun: The Movie", posters.p4, "MOVIE", 2025, 1, 90, ["Action"]),
  mk(502, "Neon Rain: Last Case", posters.p8, "MOVIE", 2024, 1, 88, ["Mystery"]),
  mk(503, "The Rooftop Where We Said Goodbye", posters.p2, "MOVIE", 2023, 1, 87, ["Romance"]),
  mk(504, "Grimoire: Eclipse", posters.p3, "MOVIE", 2025, 1, 86, ["Fantasy"]),
  mk(505, "Grand Line Dawn: Red Tide", posters.p6, "MOVIE", 2024, 1, 89, ["Adventure"]),
  mk(506, "Steel Requiem: Zero Hour", posters.p5, "MOVIE", 2026, 1, 84, ["Mecha"]),
];

export const topAiring: Anime[] = [
  mk(601, "Grand Line Dawn", posters.p6, "TV", 1999, 1167, 87, ["Adventure"]),
  mk(602, "Knight of the Glass Cathedral S2", posters.p7, "TV", 2026, 12, 83, ["Fantasy"]),
  mk(603, "Twin Blades of the Ash Court", posters.p4, "TV", 2026, 24, 78, ["Action"]),
  mk(604, "Slime & the Hidden Glade S4", posters.p10, "TV", 2026, 11, 82, ["Fantasy"]),
  mk(605, "Steel Requiem: Project Violet", posters.p5, "TV", 2026, 16, 79, ["Mecha"]),
  mk(606, "Neon Rain Detective", posters.p8, "TV", 2026, 11, 78, ["Mystery"]),
];

export const scheduleDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
