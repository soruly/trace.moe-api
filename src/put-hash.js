import Knex from "knex";
import path from "path";
import fs from "fs-extra";
import sendWorkerJobs from "../lib/send-worker-jobs.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  HASH_PATH,
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
  const hashFilePath = path.join(HASH_PATH, anilistID, `${filename}.xml.xz`);
  if (!hashFilePath.startsWith(HASH_PATH)) {
    res.status(403).send("403 Forbidden");
    return;
  }
  console.log(`Saving ${hashFilePath}`);
  fs.ensureDirSync(path.dirname(hashFilePath));
  req.pipe(fs.createWriteStream(hashFilePath));
  req.on("end", async () => {
    await knex(TRACE_ALGO).where("path", `${anilistID}/${filename}`).update({ status: "HASHED" });
    console.log(`Saved ${hashFilePath}`);
    await sendWorkerJobs(req.app.locals.workerPool);
    return res.sendStatus(204);
  });
};
