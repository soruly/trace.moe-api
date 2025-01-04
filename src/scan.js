import path from "node:path";
import fs from "node:fs/promises";
import startWorker from "./worker/start-worker.js";

const { VIDEO_PATH } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const [dbFileList, fileList] = await Promise.all([
    knex("file").select("path"),
    fs.readdir(VIDEO_PATH, { recursive: true, withFileTypes: true }),
  ]);
  const dbFileSet = new Set(dbFileList.map((e) => e.path));

  const videoFileList = fileList
    .filter((file) => file.isFile() && [".webm", ".mkv", ".mp4"].includes(path.extname(file.name)))
    .map((e) => path.join(e.path, e.name).replace(VIDEO_PATH, ""));
  const videoFileSet = new Set(videoFileList);

  const newFileList = videoFileList.filter((e) => !dbFileSet.has(e));

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
    missing: dbFileList.map((e) => e.path).filter((e) => !videoFileSet.has(e)).length,
  });

  await startWorker(req.app);
};
