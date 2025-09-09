import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import sql from "../../sql.js";
import * as hashStorage from "../lib/hash-storage.js";

const { VIDEO_PATH } = process.env;

const { id, filePath } = workerData;
parentPort.postMessage(`[${threadId}] Hashing ${filePath}`);

const videoFilePath = path.join(VIDEO_PATH, filePath);
try {
  await fs.access(path.join(VIDEO_PATH, filePath));
} catch {
  parentPort.postMessage(`[${threadId}] Error: No such file ${videoFilePath}`);
  process.exit(1);
}

const tempPath = path.join(os.tmpdir(), `trace.moe-${process.pid}-${threadId}`);
parentPort.postMessage(`[${threadId}] Creating temp directory ${tempPath}`);
await fs.rm(tempPath, { recursive: true, force: true });
await fs.mkdir(tempPath, { recursive: true });

parentPort.postMessage(`[${threadId}] Extracting thumbnails`);
const extractStart = performance.now();
const { stderr: ffmpegLog } = child_process.spawnSync(
  "ffmpeg",
  ["-i", videoFilePath, "-q:v", 2, "-an", "-vf", "scale=-2:180,showinfo", `${tempPath}/%08d.jpg`],
  { encoding: "utf-8", maxBuffer: 1024 * 1024 * 100 },
);
parentPort.postMessage(
  `[${threadId}] Extracting thumbnails done in ${(performance.now() - extractStart).toFixed(0)} ms`,
);

const myRe = /pts_time:\s*(\d+\.?\d*)\s*/g;
let temp = [];
const timeCodeList = [];
while ((temp = myRe.exec(ffmpegLog)) !== null) {
  timeCodeList.push(parseFloat(temp[1]));
}
parentPort.postMessage(`[${threadId}] Extracted ${timeCodeList.length} timecode`);

const fileList = await fs.readdir(tempPath);
parentPort.postMessage(`[${threadId}] Extracted ${fileList.length} thumbnails`);

parentPort.postMessage(`[${threadId}] Analyzing frames`);
const analyzeStart = performance.now();

const threads = Math.min(os.availableParallelism(), 16);

const hashList = (
  await Promise.all(
    Array.from({ length: threads }).map(
      (_, i) =>
        new Promise((resolve) => {
          const child = child_process.spawn(
            "node",
            ["./src/worker/cl_hi.js", tempPath, i, threads],
            {
              maxBuffer: 1024 * 1024 * 100,
            },
          );
          let chunks = "";
          child.stderr.on("data", (data) => {
            console.error(data.toString());
          });
          child.stdout.on("data", (data) => {
            chunks += data.toString();
          });
          child.on("close", () => {
            resolve(JSON.parse(chunks));
          });
        }),
    ),
  )
)
  .flat()
  .sort((a, b) => (a.file > b.file ? 1 : -1))
  .map(({ cl_hi }, i) => ({ time: timeCodeList[i], cl_hi }))
  .filter((e) => e.time >= 0);

await fs.rm(tempPath, { recursive: true, force: true });

parentPort.postMessage(
  `[${threadId}] Analyzing frames done in ${(performance.now() - analyzeStart).toFixed(0)} ms`,
);

await sql`
  UPDATE files
  SET
    frame_count = ${hashList.length}
  WHERE
    id = ${id}
`;
await sql.end();

const compressStart = performance.now();
const hashFilePath = hashStorage.getFilePath(filePath);
parentPort.postMessage(`[${threadId}] Compressing ${hashFilePath}`);
await hashStorage.write(filePath, hashList);

parentPort.postMessage(
  `[${threadId}] Compressing done in ${(performance.now() - compressStart).toFixed(0)} ms`,
);
parentPort.postMessage(`[${threadId}] Saved  ${hashFilePath}`);
