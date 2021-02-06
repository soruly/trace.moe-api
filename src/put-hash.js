import Knex from "knex";
import path from "path";
import fs from "fs-extra";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  HASH_PATH,
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
  const hashFilePath = path.join(HASH_PATH, anilistID, `${filename}.xml.xz`);
  console.log(`Saving ${hashFilePath}`);
  fs.ensureDirSync(path.dirname(hashFilePath));
  req.pipe(fs.createWriteStream(hashFilePath));
  req.on("end", async () => {
    await knex("files").where("path", `${anilistID}/${filename}`).update({ status: "HASHED" });
    console.log(`Saved ${hashFilePath}`);
    req.app.locals.ws.send("checkDB");
    return res.sendStatus(204);
  });
};
