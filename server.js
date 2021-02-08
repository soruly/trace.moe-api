import "dotenv/config.js";
import express from "express";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import multer from "multer";
import Knex from "knex";
import WebSocket from "ws";
import { createProxyMiddleware } from "http-proxy-middleware";

import checkSecret from "./src/check-secret.js";
import getMe from "./src/get-me.js";
import getStatus from "./src/get-status.js";
import search from "./src/search.js";
import uploaded from "./src/uploaded.js";
import putHash from "./src/put-hash.js";
import getHash from "./src/get-hash.js";
import getWorkers from "./src/get-workers.js";
import createCore from "./src/create-core.js";
import getSolrCoreList from "./lib/get-solr-core-list.js";
import loaded from "./src/loaded.js";

const {
  TRACE_ALGO,
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SOLA_SOLR_LIST,
  SERVER_PORT,
  SERVER_ADDR,
  SERVER_WS_PORT,
  TRACE_API_SECRET,
} = process.env;

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

app.set("trust proxy", 1);
app.use(
  rateLimit({
    max: 60, // 60 requests per IP address (per node.js process)
    windowMs: 60 * 1000, // per 1 minute
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ storage: multer.memoryStorage() });

app.get("/me", getMe);
app.get("/status", getStatus);
app.get("/create-core", checkSecret, createCore);
app.get("/uploaded/:anilistID/:filename", checkSecret, uploaded);
app.put("/hash/:anilistID/:filename", checkSecret, putHash);
app.get("/hash/:anilistID/:filename", checkSecret, getHash);
app.get("/loaded/:anilistID/:filename", checkSecret, loaded);
app.get("/workers", checkSecret, getWorkers);
app.all("/search", upload.single("image"), search);
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
app.locals.coreList = await getSolrCoreList();
console.log(
  `Loaded ${app.locals.coreList.length} cores from ${SOLA_SOLR_LIST.split(",").length} solr servers`
);
