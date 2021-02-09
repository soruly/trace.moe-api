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
  },
});

export default async (req, res) => {
  const rows = await knex.raw(
    "INSERT INTO anilist_chinese (id, json) values (?, ?) ON DUPLICATE KEY UPDATE json=?",
    [Number(req.params.anilistID), JSON.stringify(req.body), JSON.stringify(req.body)]
  );
  return res.json(rows);
};
