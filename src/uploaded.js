import Knex from "knex";

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

export default async (req, res) => {
  const { anilistID, filename } = req.params;
  console.log(`Uploaded ${anilistID}/${filename}`);
  await knex.raw(
    knex(TRACE_ALGO)
      .insert({
        path: `${anilistID}/${filename}`,
        status: "UPLOADED",
      })
      .toString()
      .replace(/^insert/i, "insert ignore")
  );
  await req.app.locals.checkDB();
  res.sendStatus(204);
};
