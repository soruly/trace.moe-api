import "dotenv/config";
import fs from "node:fs/promises";
import Knex from "knex";

import app from "./src/app.js";

import v8 from "v8";
console.log(
  `${(v8.getHeapStatistics().total_available_size / 1024 / 1024).toFixed(0)} MB Available Memory`,
);

const {
  TRACE_ALGO,
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SERVER_PORT,
  SERVER_ADDR,
} = process.env;

console.log("Creating SQL database if not exist");
await Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
  },
}).raw(`CREATE DATABASE IF NOT EXISTS ${SOLA_DB_NAME} CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

app.locals.knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
    multipleStatements: true,
  },
});

console.log("Creating SQL table if not exist");
await app.locals.knex.raw(
  (await fs.readFile("sql/structure.sql", "utf8")).replace("TRACE_ALGO", TRACE_ALGO),
);
await app.locals.knex.raw(await fs.readFile("sql/data.sql", "utf8"));

app.locals.workerCount = 0;
app.locals.mutex = false;
app.locals.mediaQueue = 0;
app.locals.searchQueue = [];
app.locals.searchConcurrent = new Map();
setInterval(() => app.locals.searchConcurrent.clear(), 60 * 60 * 1000);
setInterval(() => (app.locals.searchQueue = []), 60 * 60 * 1000);

const server = app.listen(SERVER_PORT, SERVER_ADDR, () =>
  console.log(`API server listening on port ${server.address().port}`),
);

// check for new files every minute
setInterval(async () => await fetch(`http://localhost:${server.address().port}/scan`), 60 * 1000);
