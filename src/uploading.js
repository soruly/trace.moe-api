import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_MEDIA_UPLOAD_URL,
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
  console.log(`Uploading ${anilistID}/${filename}`);
  await knex.raw(
    knex("files")
      .insert({
        path: `${anilistID}/${filename}`,
        status: "UPLOADING",
      })
      .toString()
      .replace(/^insert/i, "insert ignore")
  );
  return res.send(`${TRACE_MEDIA_UPLOAD_URL}/${anilistID}/${filename}`);
};
