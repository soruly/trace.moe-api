import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import Knex from "knex";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME } = process.env;

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
    charset: "utf8mb4",
  },
});

const q = {};
q.query = await fs.readFile(path.join(import.meta.dirname, "anilist.graphql"), "utf8");

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
  await knex("anilist").where("id", anime.id).del();
  await knex("anilist").insert({
    id: anime.id,
    json: JSON.stringify(anime),
  });
};

const [arg, value] = process.argv.slice(2);

if (process.argv.slice(2).includes("--clean")) {
  console.log("Truncating database table anilist");
  await knex.truncate("anilist");
  console.log("Truncated database table anilist");
}

if (arg === "--anime" && value) {
  console.log(`Crawling anime ${value}`);
  const anime = (await submitQuery(q, { id: value })).Page.media[0];
  await save(anime);
} else if (arg === "--page" && value) {
  const format = /^(\d+)(-)?(\d+)?$/;
  const startPage = value.match(format)[1];
  const lastPage = value.match(format)[2] ? Number(value.match(format)[3]) : startPage;

  console.log(`Crawling page ${startPage} to ${lastPage || "end"}`);

  let page = startPage;
  while (!lastPage || page <= lastPage) {
    console.log(`Crawling page ${page}`);
    const data = await submitQuery(q, {
      page,
      perPage: 50,
    });
    for (const anime of data.Page.media) {
      await save(anime);
    }
    if (!data.Page.pageInfo.hasNextPage) break;
    page++;
  }
  console.log("Crawling complete");
} else {
  console.log("Usage: node anilist.js --anime 1");
  console.log("       node anilist.js --page 1");
  console.log("       node anilist.js --page 1-");
  console.log("       node anilist.js --page 1-2");
}

await knex.destroy();
