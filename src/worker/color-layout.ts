import os from "node:os";
import child_process from "node:child_process";
import { workerData } from "node:worker_threads";
import zlib from "node:zlib";
import sql from "../../sql.ts";
import colorLayout from "../lib/color-layout.ts";

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
      vector: colorLayout(frameBuffer, VIDEO_WIDTH, VIDEO_HEIGHT),
    });
  }
};

const ffmpeg = child_process.spawn("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "info",
  "-nostats",
  "-i",
  filePath,
  "-fps_mode",
  "passthrough",
  "-an",
  "-vf",
  `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT},showinfo`,
  "-c:v",
  "rawvideo",
  "-f",
  "rawvideo",
  "-pix_fmt",
  "rgb24",
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
  let match;
  const timecodeRegex = /pts_time:\s*(\d+\.?\d*)/g;
  while ((match = timecodeRegex.exec(str))) timeCodes.push(parseFloat(match[1]));
  processFrames();
});

ffmpeg.on("close", async (code) => {
  if (code !== 0) return console.error(`[color-layout][error] ffmpeg exited with code ${code}`);

  await sql`
    UPDATE files
    SET
      updated = now(),
      frame_count = ${frameData.length},
      color_layout = ${zlib.zstdCompressSync(JSON.stringify(frameData), {
        params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
      })}
    WHERE
      id = ${id}
  `;

  await sql.end();

  console.info(`[color-layout][done]  ${filePath}`);
});
