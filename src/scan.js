import path from "node:path";
import fs from "node:fs/promises";
import sql from "../sql.js";
import startWorker from "./worker/start-worker.js";

const { VIDEO_PATH } = process.env;

export default async (req, res) => {
  const [dbFileList, fileList] = await Promise.all([
    sql`
      SELECT
        path
      FROM
        files
    `,
    fs.readdir(VIDEO_PATH, { recursive: true, withFileTypes: true }),
  ]);
  const dbFileSet = new Set(dbFileList.map((e) => e.path));

  const videoFileList = fileList
    .filter((file) => file.isFile() && [".webm", ".mkv", ".mp4"].includes(path.extname(file.name)))
    .map((e) => path.join(e.path, e.name).replace(VIDEO_PATH, ""));
  const videoFileSet = new Set(videoFileList);

  const newFileList = videoFileList.filter((e) => !dbFileSet.has(e));

  for (let i = 0; i < newFileList.length; i += 10000) {
    await sql`
      INSERT INTO
        files ${sql(newFileList.slice(i, i + 10000).map((e) => ({ path: e, status: "NEW" })))}
    `;
  }

  res.json({
    fs: videoFileList.length,
    db: dbFileList.length,
    added: newFileList.length,
    missing: dbFileList.map((e) => e.path).filter((e) => !videoFileSet.has(e)).length,
  });

  await startWorker(req.app);
};
