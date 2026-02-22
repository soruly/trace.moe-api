import { workerData } from "node:worker_threads";
import fs from "node:fs/promises";
import path from "node:path";
import sql from "../../sql.ts";

const { ids } = workerData;

console.info(`[anilist][doing] ${ids}`);

const query = await fs.readFile(
  path.join(import.meta.dirname, "../../script/anilist.graphql"),
  "utf8",
);

const submitQuery = async (body) => {
  for (let retry = 0; retry < 5; retry++) {
    const res = await fetch("https://graphql.anilist.co/", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 200) {
      return (await res.json()).data.Page.media;
    }
    if (res.status === 429) {
      const delay = Number(res.headers.get("retry-after")) || 1;
      console.info(`[anilist][info]  Rate limit reached, retry after ${delay} seconds`);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    } else if (res.status >= 500) {
      console.info(`[anilist][info]  Server side HTTP ${res.status} error, retry after 5 seconds`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      console.error(`[anilist][error] ${await res.json()}`);
      return null;
    }
  }
};

for (let i = 0; i < ids.length; i += 50) {
  const chunk = ids.slice(i, i + 50);
  const list = await submitQuery({ query, variables: { ids: chunk } });

  for (const anilist_id of chunk) {
    if (list.find((e) => e.id === anilist_id)) continue;
    list.push({
      id: anilist_id,
      type: "ANIME",
      idMal: anilist_id,
      title: {
        native: "",
        romaji: "",
        english: "",
      },
      format: "",
      genres: [],
      season: "",
      source: "",
      status: "",
      endDate: {
        day: 0,
        year: 0,
        month: 0,
      },
      isAdult: false,
      siteUrl: "",
      studios: {
        edges: [],
      },
      duration: 0,
      episodes: 0,
      synonyms: [],
      relations: {
        edges: [],
      },
      seasonInt: 0,
      startDate: {
        day: 0,
        year: 0,
        month: 0,
      },
      coverImage: {
        color: "",
        large: "",
        medium: "",
        extraLarge: "",
      },
      popularity: 0,
      seasonYear: 0,
      bannerImage: "",
      externalLinks: [],
      countryOfOrigin: "",
    });
  }

  await sql`
    INSERT INTO
      anilist ${sql(list.map((e) => ({ id: e.id, updated: sql`now()`, json: e })))}
    ON CONFLICT (id) DO UPDATE
    SET
      updated = now(),
      json = EXCLUDED.json
  `;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY anilist_view`;
}
console.info(`[anilist][done]  ${ids}`);
