import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import lzma from "lzma-native";

const { TRACE_ALGO = "cl", VIDEO_PATH, HASH_PATH } = process.env;

const { filePath } = workerData;
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
  [
    "-i",
    videoFilePath,
    "-q:v",
    2,
    "-an",
    "-vf",
    "fps=12,scale=-2:180,showinfo",
    `${tempPath}/%08d.jpg`,
  ],
  { encoding: "utf-8", maxBuffer: 1024 * 1024 * 100 },
);
const extractEnd = performance.now();
const extractTimeTaken = extractEnd - extractStart;
parentPort.postMessage(
  `[${threadId}] Extracting thumbnails done in ${extractTimeTaken.toFixed(0)} ms`,
);

const myRe = /pts_time:\s*((\d|\.)+?)\s*pos/g;
let temp = [];
const timeCodeList = [];
while ((temp = myRe.exec(ffmpegLog)) !== null) {
  timeCodeList.push(parseFloat(temp[1]).toFixed(4));
}
parentPort.postMessage(`[${threadId}] Extracted ${timeCodeList.length} timecode`);

const thumbnailList = await fs.readdir(tempPath);
parentPort.postMessage(`[${threadId}] Extracted ${thumbnailList.length} thumbnails`);

parentPort.postMessage(`[${threadId}] Preparing frame files for analysis`);
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
const analyseStart = performance.now();
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

const analyseEnd = performance.now();
const analyseTimeTaken = analyseEnd - analyseStart;
parentPort.postMessage(`[${threadId}] Analyzing frames done in ${analyseTimeTaken.toFixed(0)} ms`);

parentPort.postMessage(`[${threadId}] Post-Processing XML`);
const processingXmlStart = performance.now();
// replace frame numbers with timecode
// and sort by timecode in ascending order
const parsedXML = [
  "<add>",
  (await fs.readFile(lireSolrXMLPath, "utf-8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.indexOf("<doc>") === 0)
    .map((line) =>
      line.replace(
        /<field name="id">.*\/(.*?\.jpg)<\/field>/g,
        (match, p1) => `<field name="id">${timeCodeList[thumbnailList.indexOf(p1)]}</field>`,
      ),
    )
    .sort(
      (a, b) =>
        parseFloat(a.match(/<field name="id">(.*?)<\/field>/)[1]) -
        parseFloat(b.match(/<field name="id">(.*?)<\/field>/)[1]),
    )
    .join("\n"),
  "</add>",
].join("\n");

const processingXmlEnd = performance.now();
const processingXmlTimeTaken = processingXmlEnd - processingXmlStart;
parentPort.postMessage(
  `[${threadId}] Post-Processing done in ${processingXmlTimeTaken.toFixed(0)} milliseconds`,
);

// await fs.writeFile("debug.xml", parsedXML);
await fs.rm(tempPath, { recursive: true, force: true });

const hashFilePath = `${path.join(HASH_PATH, filePath)}.xml.xz`;
parentPort.postMessage(`[${threadId}] Saving ${hashFilePath}`);
await fs.mkdir(path.dirname(hashFilePath), { recursive: true });
await fs.writeFile(hashFilePath, await lzma.compress(parsedXML, { preset: 6 }));
parentPort.postMessage(`[${threadId}] Saved  ${hashFilePath}`);
