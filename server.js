import "dotenv/config.js";
import express from "express";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import multer from "multer";
import fetch from "node-fetch";
import checkSecret from "./src/check-secret.js";
import getMe from "./src/get-me.js";
import getStatus from "./src/get-status.js";
import search from "./src/search.js";
import uploading from "./src/uploading.js";
import uploaded from "./src/uploaded.js";
import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SOLA_SOLR_LIST,
  SERVER_PORT,
  SERVER_ADDR,
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
    max: 30, // 30 requests per IP address (per node.js process)
    windowMs: 60 * 1000, // per 1 minute
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
const upload = multer({ storage: multer.memoryStorage() });

app.get("/me", getMe);
app.get("/status", getStatus);
app.get("/uploading/:anilistID/:filename", checkSecret, uploading);
app.get("/uploaded/:anilistID/:filename", checkSecret, uploaded);
app.all("/search", upload.single("image"), search);
app.all("/", async (req, res) => {
  res.send("ok");
});

console.log("Creating SQL table if not exist");
await knex.raw(`CREATE TABLE IF NOT EXISTS files (
    path varchar(768) COLLATE utf8mb4_unicode_ci NOT NULL,
    status enum('UPLOADING','UPLOADED','HASHING','HASHED','LOADING','LOADED','UNLOADING') COLLATE utf8mb4_unicode_ci NOT NULL,
    created datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (path),
    KEY status (status),
    KEY created (created),
    KEY updated (updated)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

console.log("Loading solr core list...");
const coreList = (
  await Promise.all(
    SOLA_SOLR_LIST.split(",").map((solrUrl) =>
      fetch(`${solrUrl}admin/cores?wt=json`)
        .then((res) => res.json())
        .then(({ status }) => Object.keys(status).map((coreName) => `${solrUrl}${coreName}`))
    )
  )
).flat();

app.locals.coreList = coreList;

console.log(
  `Loaded ${coreList.length} cores from ${SOLA_SOLR_LIST.split(",").length} solr servers`
);

app.listen(SERVER_PORT, SERVER_ADDR, () =>
  console.log(`API server listening on port ${SERVER_PORT}`)
);
