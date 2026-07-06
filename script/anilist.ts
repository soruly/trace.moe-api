import fs from "node:fs/promises";
import path from "node:path";

import "../env.ts";
import sql from "../sql.ts";

const q = {
  query: await fs.readFile(path.join(import.meta.dirname, "anilist.graphql"), "utf8"),
  variables: {},
};

const anilistChinese = await fetch(
  "https://raw.githubusercontent.com/soruly/anilist-chinese/refs/heads/master/anilist-chinese.json",
).then((e) => e.json());

const submitQuery = async (query, variables) => {
  query.variables = variables;
  for (let retry = 0; retry < 5; retry++) {
    const res = await fetch("https://graphql.anilist.co/", {
      method: "POST",
      body: JSON.stringify(query),
      headers: { "Content-Type": "application/json" },
    });
    if (res.status === 200) {
      return (await res.json()).data;
    }
    if (res.status === 429) {
      const delay = Number(res.headers.get("retry-after")) || 1;
      console.log(`Rate limit reached, retry after ${delay} seconds`);
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    } else if (res.status >= 500) {
      console.log(`Server side HTTP ${res.status} error, retry after 5 seconds`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      console.log(res);
      return null;
    }
  }
};

const save = async (anime) => {
  console.log(`Saving anime ${anime.id} (${anime.title.native ?? anime.title.romaji})`);
  const chinese = anilistChinese.find((e) => e.id === anime.id);
  if (chinese) {
    anime.title.chinese = chinese.title;
    anime.synonyms_chinese = chinese.synonyms;
  }
  await sql`
    INSERT INTO
      anilist (id, updated, json)
    VALUES
      (
        ${Number(anime.id)},
        now(),
        ${anime}
      )
    ON CONFLICT (id) DO UPDATE
    SET
      updated = now(),
      json = EXCLUDED.json
  `;
};

const [arg, value] = process.argv.slice(2);

if (process.argv.slice(2).includes("--clean")) {
  console.log("Truncating database table anilist");
  await sql`TRUNCATE TABLE anilist`;
  console.log("Truncated database table anilist");
}

if (arg === "--anime" && value) {
  console.log(`Crawling anime ${value}`);
  const ids = value
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id));
  if (ids.length > 0) {
    const data = await submitQuery(q, { ids });
    if (data?.Page?.media) {
      for (const anime of data.Page.media) {
        await save(anime);
      }
    }
  }
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY anilist_view`;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY anilist_title`;
} else if (arg === "--anime") {
  console.log("Crawling all new anime");

  const [{ max }] = await sql`
    SELECT
      MAX(id) AS max
    FROM
      anilist
  `;
  let currentId = max ?? 1;
  let lastFoundId = max ?? 0;
  while (true) {
    const ids = Array.from({ length: 50 }, (_, i) => currentId + i);
    console.log(`Crawling anime ID ${ids[0]} - ${ids[ids.length - 1]}`);
    const data = await submitQuery(q, { ids });
    if (!data || !data.Page || !data.Page.media) {
      break;
    }
    if (data.Page.media.length > 0) {
      for (const anime of data.Page.media) {
        await save(anime);
      }
      const idsFound = data.Page.media.map((anime: any) => Number(anime.id));
      lastFoundId = Math.max(lastFoundId, ...idsFound);
    }
    if (ids[ids.length - 1] - lastFoundId >= 200) {
      break;
    }
    currentId += 50;
  }
  console.log("No more new IDs found");

  console.log("Update all existing anime");
  const existingIds = (
    await sql`
      SELECT
        id
      FROM
        anilist
      WHERE
        id < ${max}
      ORDER BY
        id DESC
    `
  ).map((r) => r.id);
  for (let i = 0; i < existingIds.length; i += 50) {
    const ids = existingIds.slice(i, i + 50);
    console.log(`Updating anime ID ${ids[0]} - ${ids[ids.length - 1]}`);
    const data = await submitQuery(q, { ids });
    if (data?.Page?.media) {
      for (const anime of data.Page.media) {
        await save(anime);
      }
    }
  }

  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY anilist_view`;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY anilist_title`;
  console.log("Crawling complete");
} else {
  console.log("Usage: node anilist.ts --anime [id,id,...]");
}

await sql.end();
