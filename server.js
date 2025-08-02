import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import sql from "./sql.js";
import app from "./src/app.js";
import Sqids from "sqids";

import v8 from "v8";
console.log(
  `${(v8.getHeapStatistics().total_available_size / 1024 / 1024).toFixed(0)} MB Available Memory`,
);

const { SERVER_PORT, SERVER_ADDR } = process.env;

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
