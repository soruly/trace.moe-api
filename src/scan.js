import path from "node:path";
import fs from "node:fs/promises";
import startWorker from "./worker/start-worker.js";

const { TRACE_ALGO, VIDEO_PATH } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const videoFileList = (await fs.readdir(VIDEO_PATH, { recursive: true, withFileTypes: true }))
    .filter((file) => file.isFile() && [".mkv", ".mp4"].includes(path.extname(file.name)))
    .map((e) => path.join(e.path, e.name));
  if (videoFileList.length) {
    await knex(TRACE_ALGO)
      .insert(
        videoFileList.map((e) => ({
          path: e.replace(VIDEO_PATH, ""),
          status: "UPLOADED",
        })),
      )
      .onConflict("path")
      .ignore();
  }
  res.sendStatus(204);

  await startWorker(req.app);
};
