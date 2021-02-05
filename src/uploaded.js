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
  const { anilistID, filename } = req.params;
  console.log(`Uploaded ${anilistID}/${filename}`);
  const result = await knex("files").select("status").where("path", `${anilistID}/${filename}`);
  if (result[0].status !== "UPLOADING") {
    return res.sendStatus(500);
  }
  await knex("files").where("path", `${anilistID}/${filename}`).update({ status: "UPLOADED" });
  return res.sendStatus(204);
};
