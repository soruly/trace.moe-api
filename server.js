import "dotenv/config";
import WebSocket, { WebSocketServer } from "ws";
import fs from "fs-extra";
import Knex from "knex";
import { createClient } from "redis";

import sendWorkerJobs from "./src/worker/send-worker-jobs.js";
import app from "./src/app.js";

import v8 from "v8";
console.log(
  `${(v8.getHeapStatistics().total_available_size / 1024 / 1024).toFixed(0)} MB Available Memory`
);

const {
  TRACE_ALGO,
  TRACE_API_SECRET,
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SERVER_PORT,
  REDIS_HOST,
  REDIS_PORT,
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

app.locals.redis = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
});
await app.locals.redis.connect();
await app.locals.redis.flushAll();

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
  fs.readFileSync("sql/structure.sql", "utf8").replace("TRACE_ALGO", TRACE_ALGO)
);
await app.locals.knex.raw(fs.readFileSync("sql/data.sql", "utf8"));

const wss = new WebSocketServer({ noServer: true, path: "/ws" });
const server = app.listen(SERVER_PORT, "0.0.0.0", () =>
  console.log(`API server listening on port ${SERVER_PORT}`)
);

server.on("upgrade", (request, socket, head) => {
  if (request.headers["x-trace-secret"] !== TRACE_API_SECRET) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});

app.locals.workerPool = new Map();

wss.on("connection", async (ws, request) => {
  const type = request.headers["x-trace-worker-type"];
  ws.on("message", async (data) => {
    app.locals.workerPool.set(ws, { status: "READY", type, file: "" });
    await sendWorkerJobs(app.locals.knex, app.locals.workerPool);
  });
  ws.on("close", (code) => {
    app.locals.workerPool.delete(ws);
  });
});

setInterval(() => {
  for (const client of Array.from(wss.clients).filter((e) => e.readyState === WebSocket.OPEN)) {
    client.ping();
  }
}, 30000); // prevent cloudflare timeout
