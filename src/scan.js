import path from "node:path";
import fs from "node:fs/promises";
import startWorker from "./worker/start-worker.js";

const { VIDEO_PATH } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const dbFileList = (await knex("file").select("path")).map((e) => e.path);
  const videoFileList = (await fs.readdir(VIDEO_PATH, { recursive: true, withFileTypes: true }))
    .filter((file) => file.isFile() && [".mkv", ".mp4"].includes(path.extname(file.name)))
    .map((e) => path.join(e.path, e.name).replace(VIDEO_PATH, ""));
  const newFileList = videoFileList.filter((e) => !dbFileList.includes(e));

  if (newFileList.length) {
    await knex("file").insert(
      newFileList.map((e) => ({
        path: e,
        status: "UPLOADED",
      })),
    );
  }

  res.json({
    fs: videoFileList.length,
    db: dbFileList.length,
    added: newFileList.length,
    missing: dbFileList.filter((e) => !videoFileList.includes(e)).length,
  });

  await startWorker(req.app);
};
