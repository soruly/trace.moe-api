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
  const result = await knex("anilist_view")
    .select("json")
    .where("id", Number(req.params.anilistID) || 0);

  if (result.length === 0) {
    res.sendStatus(404);
    return;
  }

  return res.json(JSON.parse(result[0].json));
};
