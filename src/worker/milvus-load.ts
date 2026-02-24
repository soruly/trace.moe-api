import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { workerData } from "node:worker_threads";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import sql from "../../sql.ts";

const zstdDecompress = promisify(zlib.zstdDecompress);

const { MILVUS_ADDR, MILVUS_TOKEN, DISCORD_URL, TELEGRAM_ID, TELEGRAM_URL } = process.env;

const { id, filePath } = workerData;
console.info(`[milvus-load][doing] ${filePath}`);

const [row] = await sql`
  SELECT
    color_layout
  FROM
    files
  WHERE
    id = ${id}
`;

const hashList = JSON.parse((await zstdDecompress(row.color_layout)).toString()).sort(
  (a, b) => a.time - b.time,
);

const dedupedHashList = [];
for (const currentFrame of hashList) {
  if (
    !dedupedHashList
      .slice(-50) // search in last 50 frames
      .filter((frame) => currentFrame.time - frame.time < 2) // which is within 2 sec
      .some((frame) => frame.vector.every((value, i) => value === currentFrame.vector[i])) // skip frames with exact hash
  ) {
    dedupedHashList.push(currentFrame);
  }
}

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

try {
  await milvus.insert({
    collection_name: "frame_color_layout",
    data: dedupedHashList.map(({ time, vector }) => ({ file_id: id, time, vector })),
  });
  await sql`
    UPDATE files
    SET
      loaded = true
    WHERE
      id = ${id}
  `;
} catch (error) {
  console.error(`[milvus-load][error] ${error}`);
  await sql`
    UPDATE files
    SET
      loaded = false
    WHERE
      id = ${id}
  `;
}

await milvus.closeConnection();

await sql.end();

console.info(`[milvus-load][done]  ${filePath}`);

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
