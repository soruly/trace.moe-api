import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import sql from "../../sql.js";

const { TRACE_ALGO = "cl", VIDEO_PATH, HASH_PATH } = process.env;

const { id, filePath } = workerData;
parentPort.postMessage(`[${threadId}] Hashing ${filePath}`);

const videoFilePath = path.join(VIDEO_PATH, filePath);
try {
  await fs.access(path.join(VIDEO_PATH, filePath));
} catch {
  parentPort.postMessage(`[${threadId}] Error: No such file ${videoFilePath}`);
  process.exit(1);
}
if (
  !["cl", "eh", "jc", "oh", "ph", "ac", "ad", "ce", "fc", "fo", "jh", "sc"].includes(TRACE_ALGO)
) {
  parentPort.postMessage(`[${threadId}] Error: Unsupported image descriptor "${TRACE_ALGO}"`);
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
  timeCodeList.push(parseFloat(temp[1]).toFixed(4));
}
parentPort.postMessage(`[${threadId}] Extracted ${timeCodeList.length} timecode`);

const thumbnailList = await fs.readdir(tempPath);
parentPort.postMessage(`[${threadId}] Extracted ${thumbnailList.length} thumbnails`);

const thumbnailListPath = path.join(tempPath, "frames.txt");
await fs.writeFile(
  thumbnailListPath,
  thumbnailList
    .slice(0, timeCodeList.length)
    .map((each) => path.join(tempPath, each))
    .join("\n"),
);

parentPort.postMessage(`[${threadId}] Analyzing frames`);
const lireSolrXMLPath = path.join(tempPath, "output.xml");
const analyzeStart = performance.now();
const { stdout, stderr } = child_process.spawnSync(
  "java",
  [
    "-cp",
    "jar/*",
    "net.semanticmetadata.lire.solr.indexing.ParallelSolrIndexer",
    "-i",
    thumbnailListPath,
    "-o",
    lireSolrXMLPath,
    "-f", // force to overwrite output file
    // "-a", // use both BitSampling and MetricSpaces
    // "-l", // disable bitSampling and use MetricSpaces instead
    "-n", // number of threads
    16,
    "-y", // defines which feature classes are to be extracted, comma separated
    TRACE_ALGO, // cl,eh,jc,oh,ph,ac,ad,ce,fc,fo,jh,sc
  ],
  { encoding: "utf-8", maxBuffer: 1024 * 1024 * 100 },
);
parentPort.postMessage(`[${threadId}] ${stdout.trim()}`);
if (stderr.trim()) parentPort.postMessage(`[${threadId}] ${stderr.trim()}`);

// replace frame numbers with time code
// and sort by time code in ascending order
const hashList = (await fs.readFile(lireSolrXMLPath, "utf-8"))
  .split("\n")
  .map((line) => {
    const match = line.match(
      /<doc><field name="id">.*\/(\d+\.jpg)<\/field><field name="cl_hi">(.+?)<\/field><field name="cl_ha">(.+?)<\/field><\/doc>/,
    );
    if (!match) return;
    return {
      time: parseFloat(timeCodeList[thumbnailList.indexOf(match[1])]),
      cl_hi: match[2],
      cl_ha: match[3],
    };
  })
  .filter((e) => e)
  .sort((a, b) => a.time - b.time);

// await fs.writeFile("hashList.json", JSON.stringify(hashList, null, 2));
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
const hashFilePath = `${path.join(HASH_PATH, filePath)}.json.zst`;
parentPort.postMessage(`[${threadId}] Compressing ${hashFilePath}`);
await fs.mkdir(path.dirname(hashFilePath), { recursive: true });
await fs.writeFile(
  hashFilePath,
  zlib.zstdCompressSync(JSON.stringify(hashList), {
    params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
  }),
);
parentPort.postMessage(
  `[${threadId}] Compressing done in ${(performance.now() - compressStart).toFixed(0)} ms`,
);
parentPort.postMessage(`[${threadId}] Saved  ${hashFilePath}`);
