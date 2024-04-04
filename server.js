import "dotenv/config";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import Knex from "knex";
import Database from "better-sqlite3";

import app from "./src/app.js";

import v8 from "v8";
console.log(
  `${(v8.getHeapStatistics().total_available_size / 1024 / 1024).toFixed(0)} MB Available Memory`,
);

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SERVER_PORT,
  SERVER_ADDR,
} = process.env;

console.log("Creating SQL database if not exist");
if (SOLA_DB_HOST) {
  await Knex({
    client: "mysql",
    connection: {
      host: SOLA_DB_HOST,
      port: SOLA_DB_PORT,
      user: SOLA_DB_USER,
      password: SOLA_DB_PWD,
    },
  }).raw(
    `CREATE DATABASE IF NOT EXISTS ${SOLA_DB_NAME} CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  );
} else {
  await fs.mkdir("db", { recursive: true });
  const db = new Database("db/sola.sqlite3");
  db.pragma("journal_mode = WAL");
  db.close();
  await Knex({
    client: "better-sqlite3",
    connection: {
      filename: "./db/sola.sqlite3",
    },
    useNullAsDefault: false,
  });
}

const knex = SOLA_DB_HOST
  ? Knex({
      client: "mysql",
      connection: {
        host: SOLA_DB_HOST,
        port: SOLA_DB_PORT,
        user: SOLA_DB_USER,
        password: SOLA_DB_PWD,
        database: SOLA_DB_NAME,
        multipleStatements: true,
      },
    })
  : Knex({
      client: "better-sqlite3",
      connection: {
        filename: "./db/sola.sqlite3",
      },
      useNullAsDefault: false,
    });

console.log("Creating SQL table if not exist");
if (SOLA_DB_HOST) {
  await knex.raw(await fs.readFile("sql/structure.sql", "utf8"));
  await knex.raw(await fs.readFile("sql/data.sql", "utf8"));
} else {
  await Promise.all([
    knex.schema.hasTable("file").then(
      (exists) =>
        exists ||
        knex.schema.createTable("file", function (table) {
          table.increments("id").unsigned().notNullable().primary();
          table.string("path", 768).notNullable().unique();
          table.enu("status", ["UPLOADED", "HASHING", "HASHED", "LOADING", "LOADED"]).notNullable();
          table.timestamp("created").notNullable().defaultTo(knex.fn.now());
          table.timestamp("updated").notNullable().defaultTo(knex.fn.now());
          table.index(["status", "created", "updated"]);
        }),
    ),
    knex.schema.hasTable("log").then(
      (exists) =>
        exists ||
        knex.schema.createTable("log", function (table) {
          table.timestamp("time").notNullable().defaultTo(knex.fn.now());
          table.string("uid", 45).notNullable();
          table.smallint("status").unsigned().notNullable();
          table.integer("search_time", 6).unsigned().nullable();
          table.float("accuracy", 20).unsigned().nullable();
          table.index(["time", "uid", "status"], "time_uid_status");
        }),
    ),
    knex.schema.hasTable("search_count").then(
      (exists) =>
        exists ||
        knex.schema.createTable("search_count", function (table) {
          table.string("uid", 45).notNullable().primary();
          table.integer("count").unsigned().notNullable();
        }),
    ),
    knex.schema.createViewOrReplace("user_quota", function (view) {
      view.columns(["uid", "count"]);
      view.as(knex("log").select("uid").count("* as count").where("status", 200).groupBy("uid"));
    }),
    knex.schema.hasTable("tier").then(
      (exists) =>
        exists ||
        knex.schema
          .createTable("tier", function (table) {
            table.increments("id").unsigned().primary();
            table.tinyint("priority").unsigned().notNullable();
            table.tinyint("concurrency").unsigned().notNullable();
            table.integer("quota").unsigned().notNullable();
            table.text("notes");
            table.integer("patreon_id").unsigned();
          })
          .then(() =>
            knex("tier").insert({
              id: 0,
              priority: 0,
              concurrency: 255,
              quota: 4294967295,
            }),
          ),
    ),
  ]);
}

await Promise.all([
  knex.schema.hasTable("scene_view_log").then(
    (exists) =>
      exists ||
      knex.schema.createTable("scene_view_log", function (table) {
        table.timestamp("time").notNullable().defaultTo(knex.fn.now());
        table.integer("file_id").nullable();
        table.float("start").notNullable();
        table.float("end").notNullable();
        table.float("duration").notNullable();
        table.float("time_code").notNullable();
        table.boolean("muted").notNullable();
        table.string("size", 1).notNullable();
      }),
  ),
  knex.schema.hasTable("scene_thumbnail_view_log").then(
    (exists) =>
      exists ||
      knex.schema.createTable("scene_thumbnail_view_log", function (table) {
        table.timestamp("time").notNullable().defaultTo(knex.fn.now());
        table.integer("file_id").nullable();
        table.float("time_code").notNullable();
        table.string("size", 1).notNullable();
      }),
  ),
]);

console.log("Cleaning up previous states");
await Promise.all(
  (await fs.readdir(os.tmpdir()))
    .filter((e) => e.startsWith("trace.moe-"))
    .map((e) => fs.rm(path.join(os.tmpdir(), e), { recursive: true, force: true })),
);
await knex("file").where("status", "LOADING").update({ status: "HASHED" });
await knex("file").where("status", "HASHING").update({ status: "UPLOADED" });

app.locals.knex = knex;
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
