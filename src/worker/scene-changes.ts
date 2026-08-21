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
  filePath,
  "-map",
  "0:v:0",
  "-an",
  "-sn",
  "-dn",
  "-vf",
  "select='gt(scene,0.2)',metadata=print",
  "-fps_mode",
  "passthrough",
  "-f",
  "null",
  "-",
]);

os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);

const list: [number, number][] = [];
let stderrBuffer = "";
let currentPtsTime: number | null = null;

ffmpeg.stderr.on("data", (data) => {
  const str = data.toString();
  if (str.includes("Error") || str.includes("error")) console.error(`[scene-changes][error] ${str}`);
  stderrBuffer += str;
  const lines = stderrBuffer.split("\n");
  stderrBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const ptsMatch = line.match(/pts_time:\s*(\d+\.?\d*)/);
    if (ptsMatch) {
      currentPtsTime = parseFloat(ptsMatch[1]);
    }
    const scoreMatch = line.match(/scene_score\s*=\s*(\d+\.?\d*)/);
    if (scoreMatch && currentPtsTime !== null) {
      list.push([currentPtsTime, parseFloat(scoreMatch[1])]);
      currentPtsTime = null;
    }
  }
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
