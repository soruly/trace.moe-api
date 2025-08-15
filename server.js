import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import Sqids from "sqids";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import sql from "./sql.js";
import app from "./src/app.js";

import v8 from "v8";
console.log(
  `${(v8.getHeapStatistics().total_available_size / 1024 / 1024).toFixed(0)} MB Available Memory`,
);

const { SERVER_PORT, SERVER_ADDR, MILVUS_ADDR, MILVUS_TOKEN } = process.env;

console.log("Checking postgres database");
const [tables] = await sql`
  SELECT
    COUNT(*)
  FROM
    information_schema.tables
  WHERE
    table_schema = 'public';
`;

if (!Number(tables.count)) {
  console.log("Creating postgres database");
  await sql.file("./sql/1.init.sql");
}

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

console.log("Checking milvus collection");
const milvusCollection = await milvus.listCollections();
if (milvusCollection.collection_names.includes("frame_color_layout")) {
  console.log("Using milvus collection frame_color_layout");
} else {
  console.log("Creating milvus collection frame_color_layout");
  console.log(
    await milvus.createCollection({
      collection_name: "frame_color_layout",
      fields: [
        {
          name: "id",
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: "anilist_id",
          data_type: DataType.Int32,
        },
        {
          name: "file_id",
          data_type: DataType.Int32,
        },
        {
          name: "time",
          data_type: DataType.Float,
        },
        {
          name: "vector",
          data_type: DataType.Float16Vector,
          dim: 33,
        },
      ],
      index_params: [
        {
          field_name: "id",
          index_type: "AUTOINDEX",
        },
        {
          field_name: "anilist_id",
          index_type: "AUTOINDEX",
        },
        {
          field_name: "file_id",
          index_type: "AUTOINDEX",
        },
        {
          field_name: "vector",
          index_type: "IVF_SQ8",
          metric_type: "L2",
          params: { nlist: 16384 },
        },
      ],
      shards_num: 1,
    }),
  );
}
await milvus.closeConnection();

console.log("Cleaning up previous temp folders");
// rm -rf /tmp/trace.moe-*
await Promise.all(
  (await fs.readdir(os.tmpdir()))
    .filter((e) => e.startsWith("trace.moe-"))
    .map((e) => fs.rm(path.join(os.tmpdir(), e), { recursive: true, force: true })),
);

console.log("Cleaning up previous worker states");
// NEW => ANALYZING => ANALYZED => HASHING => HASHED => LOADING => LOADED
await sql`
  UPDATE files
  SET
    status = 'NEW'
  WHERE
    status = 'ANALYZING'
`;
await sql`
  UPDATE files
  SET
    status = 'ANALYZED'
  WHERE
    status = 'HASHING'
`;
await sql`
  UPDATE files
  SET
    status = 'HASHED'
  WHERE
    status = 'LOADING'
`;

app.locals.sqids = new Sqids({
  alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    .split("")
    .sort(() => (Math.random() > 0.5 ? 1 : -1))
    .join(""),
  minLength: 0,
  blocklist: new Set(),
});
app.locals.workerCount = 0;
app.locals.mutex = false;
app.locals.mediaQueue = 0;
app.locals.searchQueue = [];
app.locals.searchConcurrent = new Map();
setInterval(() => (app.locals.mediaQueue = 0), 15 * 60 * 1000);
setInterval(() => (app.locals.searchQueue = []), 15 * 60 * 1000);
setInterval(() => app.locals.searchConcurrent.clear(), 15 * 60 * 1000);

const server = app.listen(SERVER_PORT, SERVER_ADDR, () =>
  console.log(`API server listening on port ${server.address().port}`),
);

// check for new files every minute
setInterval(async () => await fetch(`http://localhost:${server.address().port}/scan`), 60 * 1000);
setTimeout(async () => await fetch(`http://localhost:${server.address().port}/scan`), 3 * 1000);
