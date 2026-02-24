import child_process from "node:child_process";
import os from "node:os";
import { workerData } from "node:worker_threads";

import sql from "../../sql.ts";

const { id, filePath } = workerData;

console.info(`[media-info][doing] ${filePath}`);

const ffprobe = child_process.spawn("ffprobe", [
  "-v",
  "error",
  "-show_format",
  "-show_streams",
  "-print_format",
  "json=compact=1",
  filePath,
]);

os.setPriority(ffprobe.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);

let data = "";
ffprobe.stdout.on("data", async (chunk) => {
  data += chunk.toString();
});

ffprobe.stderr.on("data", (data) => console.error(`[media-info][error] ${data.toString()}`));

ffprobe.on("close", async (code) => {
  if (code !== 0) console.error(`[media-info][error] ffprobe exited with code ${code}`);

  await sql`
    UPDATE files
    SET
      media_info = ${code === 0 ? JSON.parse(data) : {}},
      updated = now()
    WHERE
      id = ${id}
  `;

  await sql.end();

  console.info(`[media-info][done]  ${filePath}`);
});
