import fs from "node:fs";
import { workerData } from "node:worker_threads";
import { crc32 } from "node:zlib";

import sql from "../../sql.ts";

const { id, filePath } = workerData;

console.info(`[crc32][doing] ${filePath}`);

try {
  const stream = fs.createReadStream(filePath);
  let crc = 0;
  for await (const chunk of stream) {
    crc = crc32(chunk, crc);
  }

  await sql`
    UPDATE files
    SET
      crc32 = ${crc >>> 0},
      updated = now()
    WHERE
      id = ${id}
  `;
  console.info(`[crc32][done]  ${filePath}`);
} catch (error) {
  console.error(`[crc32][error] ${filePath}:`, error);
} finally {
  await sql.end();
}
