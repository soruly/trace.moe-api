import path from "path";
import fs from "fs-extra";
import sendWorkerJobs from "../lib/send-worker-jobs.js";

const { HASH_PATH, TRACE_ALGO } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

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
    await sendWorkerJobs(req.app.locals.knex, req.app.locals.workerPool);
    return res.sendStatus(204);
  });
};
