import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_ALGO,
} = process.env;

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
  const { anilistID, filename } = req.params;
  console.log(`Loaded ${anilistID}/${decodeURIComponent(filename)}`);
  await knex(TRACE_ALGO)
    .where("path", `${anilistID}/${decodeURIComponent(filename)}`)
    .update({ status: "LOADED" });
  req.app.locals.ws.send("checkDB");
  return res.sendStatus(204);
};
