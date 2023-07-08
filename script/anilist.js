import "dotenv/config";
import Knex from "knex";
import fetch from "node-fetch";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME, TRACE_ALGO } =
  process.env;

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
  },
});

const rows = await knex.raw(
  `SELECT DISTINCT SUBSTRING_INDEX(path, '/', 1) AS id FROM ${TRACE_ALGO}`,
);
const idList = rows[0].map((e) => Number(e.id));
await knex.destroy();

const batch = [];
let a = idList.splice(0, 50);
do {
  batch.push(a);
  a = idList.splice(0, 50);
} while (a.length);

for (const idList of batch) {
  let res;
  do {
    // console.log(`Fetching page (${batch.findIndex((e) => e === idList) + 1}/${batch.length})`);
    res = await fetch("https://graphql.anilist.co/", {
      method: "POST",
      body: JSON.stringify({
        query: `query ($ids: [Int]) {
          Page(page: 1, perPage: 50) {
            media(id_in: $ids, type: ANIME) {
              id
            }
          }
        }
        `,
        variables: { ids: idList },
      }),
      headers: { "Content-Type": "application/json" },
    });
  } while (
    res.status === 429 &&
    (await new Promise((resolve) => setTimeout(() => resolve(1), 5000)))
  );

  const json = await res.json();
  for (const id of idList) {
    if (!json.data.Page.media.map((e) => e.id).includes(id)) {
      console.log(id);
    }
  }
}
