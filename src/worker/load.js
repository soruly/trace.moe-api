import path from "node:path";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import { parentPort, threadId, workerData } from "node:worker_threads";

const { HASH_PATH, DISCORD_URL, TELEGRAM_ID, TELEGRAM_URL } = process.env;

const { filePath, coreUrl } = workerData;
parentPort.postMessage(`[${threadId}] Loading ${filePath}`);

const hashFilePath = `${path.join(HASH_PATH, filePath)}.json.zst`;
try {
  await fs.access(hashFilePath);
} catch {
  parentPort.postMessage(`[${threadId}] Error: No such file ${hashFilePath}`);
  process.exit(1);
}

const hashList = JSON.parse(zlib.zstdDecompressSync(await fs.readFile(hashFilePath))).sort(
  (a, b) => a.time - b.time,
);

const dedupedHashList = [];
for (const currentFrame of hashList) {
  if (
    !dedupedHashList
      .slice(-50) // search in last 50 frames
      .filter((frame) => currentFrame.time - frame.time < 2) // which is within 2 sec
      .some((frame) => frame.cl_hi === currentFrame.cl_hi) // skip frames with exact hash
  ) {
    dedupedHashList.push(currentFrame);
  }
}

await new Promise((resolve) => setTimeout(resolve, 500));
parentPort.postMessage(`[${threadId}] Uploading hash to ${coreUrl}`);
await fetch(`${coreUrl}/update?wt=json&commit=true`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(
    dedupedHashList.map(({ time, cl_hi, cl_ha }) => ({
      id: `${filePath}/${time.toFixed(2)}`,
      cl_hi,
      cl_ha,
    })),
  ),
});

parentPort.postMessage(`[${threadId}] Loaded ${filePath}`);

if (TELEGRAM_ID && TELEGRAM_URL) {
  fetch(TELEGRAM_URL, {
    method: "POST",
    body: new URLSearchParams([
      ["chat_id", TELEGRAM_ID],
      ["parse_mode", "Markdown"],
      ["text", "`" + path.basename(filePath) + "`"],
    ]),
  });
}

if (DISCORD_URL) {
  fetch(DISCORD_URL, {
    method: "POST",
    body: new URLSearchParams([["content", path.basename(filePath)]]),
  });
}
