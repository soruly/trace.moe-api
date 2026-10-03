import child_process from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { workerData } from "node:worker_threads";
import zlib from "node:zlib";

import sql from "../../sql.ts";
import { ColorLayout } from "trace.moe-id";

const zstdCompress = promisify(zlib.zstdCompress);

const { id, filePath } = workerData;

console.info(`[color-layout][doing] ${filePath}`);

interface FrameData {
  time: number;
  vector: number[];
}

const frameData: FrameData[] = [];

const VIDEO_WIDTH = 320;
const VIDEO_HEIGHT = 180;
const FRAME_SIZE = VIDEO_WIDTH * VIDEO_HEIGHT * 3; // RGB

let stdoutBuffer = Buffer.alloc(0);
const timeCodes: number[] = [];

const processFrames = () => {
  while (stdoutBuffer.length >= FRAME_SIZE && timeCodes.length > 0) {
    const frameBuffer = stdoutBuffer.subarray(0, FRAME_SIZE);
    stdoutBuffer = stdoutBuffer.subarray(FRAME_SIZE);
    frameData.push({
      time: timeCodes.shift(),
      vector: ColorLayout.extract({
        data: frameBuffer,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        channels: 3,
      }),
    });
  }
};

const sceneChanges: [number, number][] = [];
let currentScenePtsTime: number | null = null;
let stderrBuffer = "";

const parseStderrLine = (line: string) => {
  if (line.includes("showinfo@clr")) {
    const match = line.match(/pts_time:\s*(\d+\.?\d*)/);
    if (match) timeCodes.push(parseFloat(match[1]));
  } else if (line.includes("metadata@scn")) {
    const ptsMatch = line.match(/pts_time:\s*(\d+\.?\d*)/);
    if (ptsMatch) {
      currentScenePtsTime = parseFloat(ptsMatch[1]);
    }
    const scoreMatch = line.match(/scene_score\s*=\s*(\d+\.?\d*)/);
    if (scoreMatch && currentScenePtsTime !== null) {
      sceneChanges.push([currentScenePtsTime, parseFloat(scoreMatch[1])]);
      currentScenePtsTime = null;
    }
  }
};

const ffmpeg = child_process.spawn("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "info",
  "-nostats",
  "-y",
  "-i",
  filePath,
  "-filter_complex",
  `[0:v:0]split=2[v_color][v_scene];[v_color]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT},showinfo@clr[out_raw];[v_scene]select='gt(scene,0.2)',metadata@scn=print[out_null]`,
  "-map",
  "[out_raw]",
  "-fps_mode",
  "passthrough",
  "-an",
  "-sn",
  "-dn",
  "-c:v",
  "rawvideo",
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgb24",
  "-",
  "-map",
  "[out_null]",
  "-fps_mode",
  "passthrough",
  "-an",
  "-sn",
  "-dn",
  "-f",
  "null",
  "-",
]);

os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);

ffmpeg.stdout.on("data", (data) => {
  stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
  processFrames();
});

ffmpeg.stderr.on("data", (data) => {
  const str = data.toString();
  if (str.includes("Error") || str.includes("error")) console.error(`[color-layout][error] ${str}`);
  stderrBuffer += str;
  const lines = stderrBuffer.split("\n");
  stderrBuffer = lines.pop() ?? "";

  for (const line of lines) {
    parseStderrLine(line);
  }
  processFrames();
});

ffmpeg.on("close", async (code) => {
  if (code !== 0) console.error(`[color-layout][error] ffmpeg exited with code ${code}`);

  if (stderrBuffer) {
    parseStderrLine(stderrBuffer);
    processFrames();
  }

  await sql`
    UPDATE files
    SET
      updated = now(),
      frame_count = ${code === 0 ? frameData.length : 0},
      color_layout = ${await zstdCompress(JSON.stringify(code === 0 ? frameData : []), {
        params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
      })},
      scene_changes = ${code === 0 ? sceneChanges : []}
    WHERE
      id = ${id}
  `;

  await sql.end();

  console.info(`[color-layout][done]  ${filePath}`);
});
