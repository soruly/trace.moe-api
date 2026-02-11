import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import sql from "../../sql.ts";
import colorLayout from "../lib/color-layout.ts";

const { VIDEO_PATH } = process.env;

const { id, filePath } = workerData;
parentPort.postMessage(`[${threadId}] Hashing ${filePath}`);

const videoFilePath = path.join(VIDEO_PATH, filePath);

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

const start = performance.now();

const ffmpeg = child_process.spawn("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "info",
  "-nostats",
  "-i",
  videoFilePath,
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
  if (str.includes("Error") || str.includes("error")) {
    parentPort.postMessage(`[${threadId}] ${str}`);
  }
  let match;
  const timecodeRegex = /pts_time:\s*(\d+\.?\d*)/g;
  while ((match = timecodeRegex.exec(str))) timeCodes.push(parseFloat(match[1]));
  processFrames();
});

ffmpeg.on("close", async () => {
  if (!frameData.length) return;

  parentPort.postMessage(
    `[${threadId}] Hashed  ${filePath} in ${(performance.now() - start).toFixed(0)} ms`,
  );

  await sql`
    UPDATE files
    SET
      frame_count = ${frameData.length}
    WHERE
      id = ${id}
  `;

  parentPort.postMessage(`[${threadId}] Saving ${filePath}`);
  const saveStart = performance.now();

  await sql`
    DELETE FROM files_color_layout
    WHERE
      id = ${id}
  `;
  await sql`
    INSERT INTO
      files_color_layout
    VALUES
      (
        ${id},
        ${zlib.zstdCompressSync(JSON.stringify(frameData), {
          params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
        })}
      )
  `;

  await sql.end();

  parentPort.postMessage(
    `[${threadId}] Saved  ${filePath} in ${(performance.now() - saveStart).toFixed(0)} ms`,
  );
});
