import child_process from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { workerData } from "node:worker_threads";
import zlib from "node:zlib";

import sql from "../../sql.ts";
import colorLayout from "../lib/color-layout.ts";

const zstdCompress = promisify(zlib.zstdCompress);

const { id, filePath } = workerData;

console.info(`[video-analysis][doing] ${filePath}`);

interface FrameData {
  time: number;
  vector: number[];
}

type StreamHash = {
  index: number;
  type: string;
  algo: string;
  hash: string;
};

const frameData: FrameData[] = [];
const sceneChanges: [number, number][] = [];

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

const ffmpeg = child_process.spawn(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "info",
    "-nostats",
    "-i",
    filePath,
    "-fps_mode",
    "passthrough",
    "-an",
    "-sn",
    "-dn",
    "-filter_complex",
    `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT},showinfo[scaled];[scaled]split=2[c_out][v_scene];[v_scene]select='gt(scene,0.2)',metadata=print[s_out]`,
    "-map",
    "[s_out]",
    "-f",
    "null",
    "-",
    "-map",
    "[c_out]",
    "-c:v",
    "rawvideo",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "pipe:1",
    "-map",
    "0",
    "-c",
    "copy",
    "-f",
    "streamhash",
    "-hash",
    "sha256",
    "pipe:3",
  ],
  {
    stdio: ["pipe", "pipe", "pipe", "pipe"],
  },
);

os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);

let stderrBuffer = "";
let currentPtsTime: number | null = null;
let streamHashData = "";

ffmpeg.stdout.on("data", (data) => {
  stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
  processFrames();
});

ffmpeg.stdio[3]?.on("data", (data) => {
  streamHashData += data.toString();
});

ffmpeg.stderr.on("data", (data) => {
  const str = data.toString();
  if (str.includes("Error") || str.includes("error"))
    console.error(`[video-analysis][error] ${str}`);
  stderrBuffer += str;
  const lines = stderrBuffer.split("\n");
  stderrBuffer = lines.pop() ?? "";

  for (const line of lines) {
    if (line.includes("Parsed_showinfo")) {
      const match = line.match(/pts_time:\s*(\d+\.?\d*)/);
      if (match) timeCodes.push(parseFloat(match[1]));
    } else {
      const ptsMatch = line.match(/pts_time:\s*(\d+\.?\d*)/);
      if (ptsMatch) {
        currentPtsTime = parseFloat(ptsMatch[1]);
      }
      const scoreMatch = line.match(/scene_score\s*=\s*(\d+\.?\d*)/);
      if (scoreMatch && currentPtsTime !== null) {
        sceneChanges.push([currentPtsTime, parseFloat(scoreMatch[1])]);
        currentPtsTime = null;
      }
    }
  }
  processFrames();
});

ffmpeg.on("close", async (code) => {
  if (code !== 0) console.error(`[video-analysis][error] ffmpeg exited with code ${code}`);

  const streamHashes: StreamHash[] =
    code === 0
      ? streamHashData
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [index, type, hashEntry] = line.split(",");
            const [algo, hash] = hashEntry ? hashEntry.split("=") : ["", ""];
            return { index: Number(index), type, algo, hash };
          })
      : [];

  await sql`
    UPDATE files
    SET
      updated = now(),
      frame_count = ${code === 0 ? frameData.length : 0},
      scene_changes = ${code === 0 ? sceneChanges : []},
      stream_hash = ${code === 0 && streamHashes.length > 0 ? sql.json(streamHashes) : null},
      color_layout = ${await zstdCompress(JSON.stringify(code === 0 ? frameData : []), {
        params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
      })}
    WHERE
      id = ${id}
  `;

  await sql.end();

  console.info(`[video-analysis][done]  ${filePath}`);
});
