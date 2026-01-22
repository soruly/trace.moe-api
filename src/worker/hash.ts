import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import readline from "node:readline";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import sql from "../../sql.ts";

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
  ["-i", videoFilePath, "-q:v", "2", "-an", "-vf", "scale=-2:180,showinfo", `${tempPath}/%08d.jpg`],
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

interface CL_HI_Result {
  file: string;
  vector: number[];
}

const hashList = (
  await Promise.all(
    Array.from({ length: threads }).map(
      (_, i): Promise<CL_HI_Result[]> =>
        new Promise((resolve, reject) => {
          const child = child_process.spawn("node", [
            "./src/worker/cl_hi.ts",
            tempPath,
            `${i}`,
            `${threads}`,
          ]);
          const results: CL_HI_Result[] = [];
          const rl = readline.createInterface({
            input: child.stdout,
            crlfDelay: Infinity,
          });
          child.stderr.on("data", (data) => {
            console.error(data.toString());
          });
          rl.on("line", (line) => {
            results.push(JSON.parse(line));
          });
          child.on("close", (code) => {
            if (code === 0) {
              resolve(results);
            } else {
              reject(new Error(`cl_hi.ts exited with code ${code}`));
            }
          });
        }),
    ),
  )
)
  .flat()
  .sort((a, b) => (a.file > b.file ? 1 : -1))
  .map(({ vector }, i) => ({ time: timeCodeList[i], vector }))
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
      ${zlib.zstdCompressSync(JSON.stringify(hashList), {
        params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
      })}
    )
`;

await sql.end();

parentPort.postMessage(
  `[${threadId}] Saved  ${filePath} in ${(performance.now() - saveStart).toFixed(0)} ms`,
);
