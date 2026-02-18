import { workerData } from "node:worker_threads";
import sql from "../../sql.ts";

const { ids } = workerData;

console.info(`[anilist][doing] ${ids}`);

const query = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      idMal
      title {
        native
        romaji
        english
      }
      type
      format
      status
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      season
      episodes
      duration
      source
      coverImage {
        large
        medium
      }
      bannerImage
      genres
      synonyms
      studios {
        edges {
          isMain
          node {
            id
            name
            siteUrl
          }
        }
      }
      isAdult
      externalLinks {
        id
        url
        site
      }
      siteUrl
    }
  }
}
`;

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
  await new Promise((resolve) => setTimeout(resolve, 1000));

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
      startDate: {
        day: 0,
        year: 0,
        month: 0,
      },
      coverImage: {
        large: "",
        medium: "",
      },
      bannerImage: "",
      externalLinks: [],
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
}
console.info(`[anilist][done]  ${ids}`);
