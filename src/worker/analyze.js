import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import Knex from "knex";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME, VIDEO_PATH } =
  process.env;

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

const { filePath } = workerData;
parentPort.postMessage(`[${threadId}] Analyzing ${filePath}`);

const videoFilePath = path.join(VIDEO_PATH, filePath);
try {
  await fs.access(path.join(VIDEO_PATH, filePath));
} catch {
  parentPort.postMessage(`[${threadId}] Error: No such file ${videoFilePath}`);
  process.exit(1);
}

const start = performance.now();

const { stdout: videoLength } = child_process.spawnSync("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "format=duration",
  "-of",
  "default=noprint_wrappers=1:nokey=1",
  videoFilePath,
]);

if (Number(videoLength)) {
  await knex("file")
    .where("path", filePath)
    .update({ duration: Number(videoLength) });
}

const sceneList = await new Promise((resolve) => {
  const list = [];
  const ls = child_process.spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "info",
    "-nostats",
    "-y",
    "-i",
    `${videoFilePath}`,
    "-filter_complex",
    "select='gt(scene,0.2)',metadata=print",
    "-an",
    "-vsync",
    "vfr",
    "-f",
    "null",
    "-",
  ]);
  ls.stderr.on("data", (data) => {
    const match = data.toString().match(/pts_time:(\d+\.\d+).*scene_score=(\d+\.\d+)/s);
    if (!match) return;
    const [_, pts_time, scene_score] = match;
    list.push([Number(pts_time), Number(scene_score)]);
  });
  ls.on("close", async (code) => {
    resolve(list);
  });
});

await knex("file")
  .where("path", filePath)
  .update({ scene: JSON.stringify(sceneList) });

await knex.destroy();

parentPort.postMessage(
  `[${threadId}] Analyzed ${filePath} in ${(performance.now() - start).toFixed(0)} ms`,
);
