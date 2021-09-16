import "dotenv/config";
import { performance } from "perf_hooks";
import WebSocket, { WebSocketServer } from "ws";
import express from "express";
import rateLimit from "express-rate-limit";
import rateLimitRedis from "rate-limit-redis";
import cors from "cors";
import multer from "multer";
import Knex from "knex";
import fs from "fs-extra";
import * as redis from "redis";
import util from "util";

import sendWorkerJobs from "./lib/send-worker-jobs.js";
import checkSecret from "./src/check-secret.js";
import getMe from "./src/get-me.js";
import getStatus from "./src/get-status.js";
import getStats from "./src/get-stats.js";
import search from "./src/search.js";
import uploaded from "./src/uploaded.js";
import putHash from "./src/put-hash.js";
import getHash from "./src/get-hash.js";
import getWorkers from "./src/get-workers.js";
import loaded from "./src/loaded.js";
import unload from "./src/unload.js";
import github from "./src/webhook/github.js";
import patreon from "./src/webhook/patreon.js";
import create from "./src/user/create.js";
import login from "./src/user/login.js";
import resetKey from "./src/user/reset-key.js";
import resetPassword from "./src/user/reset-password.js";
import rss from "./src/rss.js";

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
  REDIS_HOST,
  REDIS_PORT,
  SERVER_PORT,
} = process.env;

const client = redis.createClient({
  host: REDIS_HOST,
  port: REDIS_PORT,
});
const flushallAsync = util.promisify(client.flushall).bind(client);
await flushallAsync();

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

const knex = Knex({
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

const app = express();

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-trace-secret");
  res.set("Referrer-Policy", "no-referrer");
  res.set("X-Content-Type-Options", "nosniff");
  res.set(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "block-all-mixed-content",
    ].join("; ")
  );
  next();
});

app.use(
  new rateLimit({
    store: new rateLimitRedis({
      redisURL: `//${REDIS_HOST}:${REDIS_PORT}`,
      expiry: 60,
    }),
    max: 60, // limit each IP to 60 requests per 60 seconds
    delayMs: 0, // disable delaying - full speed until the max limit is reached
  })
);

app.use((req, res, next) => {
  const startTime = performance.now();
  console.log("=>", new Date().toISOString(), req.ip, req.path);
  res.on("finish", () => {
    console.log(
      "<=",
      new Date().toISOString(),
      req.ip,
      req.path,
      res.statusCode,
      `${(performance.now() - startTime).toFixed(0)}ms`
    );
  });
  next();
});

app.use(cors({ credentials: true, origin: true }));
app.use(express.urlencoded({ extended: false }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.get("/me", getMe);
app.get("/status", getStatus);
app.get("/stats", getStats);
app.get("/uploaded/:anilistID/:filename", checkSecret, uploaded);
app.put("/hash/:anilistID/:filename", checkSecret, putHash);
app.get("/hash/:anilistID/:filename", checkSecret, getHash);
app.get("/loaded/:anilistID/:filename", checkSecret, loaded);
app.get("/unload/:anilistID/:filename", checkSecret, unload);
app.get("/workers", checkSecret, getWorkers);
app.all("/webhook/github", github);
app.all("/webhook/patreon", patreon);
app.all("/search", upload.single("image"), search);
app.all("/user/login", login);
app.all("/user/create", create);
app.all("/user/reset-key", resetKey);
app.all("/user/reset-password", resetPassword);
app.all("/rss.xml", rss);
app.all("/", async (req, res) => {
  res.send("ok");
});

console.log("Creating SQL table if not exist");
await knex.raw(fs.readFileSync("sql/structure.sql", "utf8").replace("TRACE_ALGO", TRACE_ALGO));
await knex.raw(fs.readFileSync("sql/data.sql", "utf8"));

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
  console.log(`${type} worker: I'm ready`);
  app.locals.workerPool.set(ws, { status: "READY", type, file: "" });
  await sendWorkerJobs(app.locals.workerPool);
  ws.on("message", async (data) => {
    app.locals.workerPool.set(ws, { status: "READY", type, file: "" });
    await sendWorkerJobs(app.locals.workerPool);
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
