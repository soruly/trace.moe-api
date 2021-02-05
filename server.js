import "dotenv/config.js";
import express from "express";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import multer from "multer";
import fetch from "node-fetch";
import getMe from "./src/get-me.js";
import getStatus from "./src/get-status.js";
import search from "./src/search.js";

const { SOLA_SOLR_LIST, SERVER_PORT, SERVER_ADDR } = process.env;

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
app.all("/search", upload.single("image"), search);
app.all("/", async (req, res) => {
  res.send("ok");
});

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
