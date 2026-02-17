import path from "node:path";
import fs from "node:fs/promises";
import sql from "../sql.ts";
import startWorker from "./worker/start-worker.ts";

const { VIDEO_PATH } = process.env;
const VIDEO_PATH_NORMALIZED = path.normalize(VIDEO_PATH);

const addAnilist = async () => {
  const [dbSet, dirList] = await Promise.all([
    sql`
      SELECT
        id
      FROM
        anilist
    `.then((e) => new Set(e.map((e) => e.id))),
    fs
      .readdir(VIDEO_PATH_NORMALIZED, { withFileTypes: true })
      .then((e) =>
        e.filter((e) => e.isDirectory() && e.name.match(/^\d+$/)).map((e) => Number(e.name)),
      ),
  ]);

  const newList = dirList.filter((dir) => !dbSet.has(dir));

  return { current: dbSet.size, new: newList.length };
};

const addFile = async () => {
  const [dbSet, fileList] = await Promise.all([
    sql`
      SELECT
        path
      FROM
        files
    `.then((e) => new Set(e.map((e) => e.path))),
    fs
      .readdir(VIDEO_PATH_NORMALIZED, { recursive: true, withFileTypes: true })
      .then((e) =>
        e
          .filter(
            (e) =>
              e.isFile() &&
              path.relative(VIDEO_PATH_NORMALIZED, e.parentPath).match(/^\d+$/) &&
              [".webm", ".mkv", ".mp4"].includes(path.extname(e.name)),
          )
          .map((e) => path.join(path.relative(VIDEO_PATH_NORMALIZED, e.parentPath), e.name)),
      ),
  ]);

  const newFileList = fileList.filter((e) => !dbSet.has(e));

  for (let i = 0; i < newFileList.length; i += 10000) {
    await sql`
      INSERT INTO
        files ${sql(
          newFileList
            .slice(i, i + 10000)
            .map((e) => ({ anilist_id: Number(path.parse(e).dir), path: e, status: "NEW" })),
        )}
    `;
  }
  return { current: dbSet.size, new: newFileList.length };
};

export default async (req, res) => {
  const [anilist, file] = await Promise.all([addAnilist(), addFile()]);

  res.json({
    anilist,
    file,
  });

  await startWorker(req.app);
};
