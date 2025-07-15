import path from "node:path";
import fs from "node:fs/promises";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import sql from "../../sql.js";

const { VIDEO_PATH } = process.env;

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

const { stdout, stderr } = child_process.spawnSync("ffprobe", [
  "-v",
  "error",
  "-show_format",
  "-show_streams",
  "-print_format",
  "json=compact=1",
  videoFilePath,
]);
if (stderr.length) console.log(stderr.toString());
if (stdout.length) {
  await sql`
    UPDATE files
    SET
      media_info = ${JSON.parse(stdout)},
      updated = now()
    WHERE
      path = ${filePath}
  `;
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

await sql`
  UPDATE files
  SET
    scene_changes = ${sceneList},
    updated = now()
  WHERE
    path = ${filePath}
`;

await sql.end();

parentPort.postMessage(
  `[${threadId}] Analyzed ${filePath} in ${(performance.now() - start).toFixed(0)} ms`,
);
