import child_process from "node:child_process";
import os from "node:os";
import { workerData } from "node:worker_threads";

import sql from "../../sql.ts";

const { id, filePath } = workerData;

console.info(`[scene-changes][doing] ${filePath}`);

const ffmpeg = child_process.spawn("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "info",
  "-nostats",
  "-y",
  "-i",
  `${filePath}`,
  "-filter_complex",
  "select='gt(scene,0.2)',metadata=print",
  "-an",
  "-vsync",
  "vfr",
  "-f",
  "null",
  "-",
]);

os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);

const list: [number, number][] = [];
ffmpeg.stderr.on("data", (data) => {
  const match = data.toString().match(/pts_time:(\d+\.\d+).*scene_score=(\d+\.\d+)/s);
  if (!match) return;
  const [_, pts_time, scene_score] = match;
  list.push([Number(pts_time), Number(scene_score)]);
});

ffmpeg.on("close", async (code) => {
  if (code !== 0) console.error(`[scene-changes][error] ffmpeg exited with code ${code}`);

  await sql`
    UPDATE files
    SET
      scene_changes = ${code === 0 ? list : []},
      updated = now()
    WHERE
      id = ${id}
  `;

  await sql.end();

  console.info(`[scene-changes][done]  ${filePath}`);
});
