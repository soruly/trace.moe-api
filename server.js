import "dotenv/config";
import { performance } from "perf_hooks";
import express from "express";
import rateLimit from "express-rate-limit";
import rateLimitRedis from "rate-limit-redis";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
import Knex from "knex";
import WebSocket from "ws";
import fs from "fs-extra";
import { createProxyMiddleware } from "http-proxy-middleware";
import * as redis from "redis";
import util from "util";

import checkSecret from "./src/check-secret.js";
import getMe from "./src/get-me.js";
import getStatus from "./src/get-status.js";
import getStats from "./src/get-stats.js";
import search from "./src/search.js";
import uploaded from "./src/uploaded.js";
import putHash from "./src/put-hash.js";
import getHash from "./src/get-hash.js";
import getWorkers from "./src/get-workers.js";
import createCore from "./src/create-core.js";
import getSolrCoreList from "./lib/get-solr-core-list.js";
import loaded from "./src/loaded.js";
import unload from "./src/unload.js";
import putAnilistChinese from "./src/put-anilist-chinese.js";
import github from "./src/webhook/github.js";
import patreon from "./src/webhook/patreon.js";
import login from "./src/user/login.js";
import resetKey from "./src/user/reset-key.js";
import resetPassword from "./src/user/reset-password.js";

import v8 from "v8";
console.log(
  `${(v8.getHeapStatistics().total_available_size / 1024 / 1024).toFixed(0)} MB Available Memory`
);

const {
  TRACE_ALGO,
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SOLA_SOLR_LIST,
  REDIS_HOST,
  REDIS_PORT,
  SERVER_PORT,
  SERVER_ADDR,
  SERVER_WS_PORT,
  TRACE_API_SECRET,
} = process.env;

const client = redis.createClient({
  host: REDIS_HOST,
  port: REDIS_PORT,
});
const flushallAsync = util.promisify(client.flushall).bind(client);
await flushallAsync();

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
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
app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
const upload = multer({ storage: multer.memoryStorage() });

app.get("/me", getMe);
app.get("/status", getStatus);
app.get("/stats", getStats);
app.get("/create-core", checkSecret, createCore);
app.get("/uploaded/:anilistID/:filename", checkSecret, uploaded);
app.put("/hash/:anilistID/:filename", checkSecret, putHash);
app.get("/hash/:anilistID/:filename", checkSecret, getHash);
app.get("/loaded/:anilistID/:filename", checkSecret, loaded);
app.get("/unload/:anilistID/:filename", checkSecret, unload);
app.put("/anilist_chinese/:anilistID", checkSecret, putAnilistChinese);
app.get("/workers", checkSecret, getWorkers);
app.all("/webhook/github", github);
app.all("/webhook/patreon", patreon);
app.all("/search", upload.single("image"), search);
app.all("/user/login", login);
app.all("/user/reset-key", resetKey);
app.all("/user/reset-password", resetPassword);
app.all("/", async (req, res) => {
  res.send("ok");
});

console.log("Creating SQL table if not exist");
await knex.raw(`CREATE TABLE IF NOT EXISTS ${TRACE_ALGO} (
    path varchar(768) COLLATE utf8mb4_unicode_ci NOT NULL,
    status enum('UPLOADED','HASHING','HASHED','LOADING','LOADED') COLLATE utf8mb4_unicode_ci NOT NULL,
    created datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (path),
    KEY status (status),
    KEY created (created),
    KEY updated (updated)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

const server = app.listen(SERVER_PORT, SERVER_ADDR, () =>
  console.log(`API server listening on port ${SERVER_PORT}`)
);

const wsProxy = createProxyMiddleware({ target: `ws://127.0.0.1:${SERVER_WS_PORT}` });

app.use("/ws", wsProxy);

server.on("upgrade", (request, socket) => {
  if (request.headers["x-trace-secret"] !== TRACE_API_SECRET) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wsProxy.upgrade(request, socket);
});

let ws;
const closeHandle = async () => {
  ws = new WebSocket(`ws://127.0.0.1:${SERVER_WS_PORT}`, {
    headers: { "x-trace-secret": TRACE_API_SECRET, "x-trace-worker-type": "master" },
  });
  app.locals.ws = ws;
  ws.on("close", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    closeHandle();
  });
};
closeHandle();

console.log("Loading solr core list...");
let coreList = [];
if (fs.existsSync("core-list.json")) {
  coreList = JSON.parse(fs.readFileSync("core-list.json", "utf8"));
} else {
  coreList = await getSolrCoreList();
  fs.outputFileSync("core-list.json", JSON.stringify(coreList, null, 2));
}
app.locals.coreList = coreList;
console.log(
  `Loaded ${app.locals.coreList.length} cores from ${SOLA_SOLR_LIST.split(",").length} solr servers`
);
