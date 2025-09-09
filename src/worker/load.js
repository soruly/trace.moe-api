import path from "node:path";
import { parentPort, threadId, workerData } from "node:worker_threads";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import * as hashStorage from "../lib/hash-storage.js";

const { MILVUS_ADDR, MILVUS_TOKEN, DISCORD_URL, TELEGRAM_ID, TELEGRAM_URL } = process.env;

const { id, anilist_id, filePath } = workerData;
parentPort.postMessage(`[${threadId}] Loading ${filePath}`);

let hashList = [];

try {
  hashList = await hashStorage.read(filePath);
} catch {
  parentPort.postMessage(`[${threadId}] Error: No such file ${hashStorage.getFilePath(filePath)}`);
  process.exit(1);
}

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

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

await milvus.insert({
  collection_name: "frame_color_layout",
  data: dedupedHashList.map(({ time, cl_hi }) => ({
    anilist_id,
    file_id: id,
    time,
    vector: Array.from(Uint8Array.from(Buffer.from(cl_hi, "base64").subarray(2))),
  })),
});

await milvus.closeConnection();

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
