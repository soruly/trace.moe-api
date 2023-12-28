import { performance } from "perf_hooks";
import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import multer from "multer";

import checkSecret from "./worker/check-secret.js";
import getMe from "./get-me.js";
import getStatus from "./get-status.js";
import getStats from "./get-stats.js";
import search from "./search.js";
import uploaded from "./worker/uploaded.js";
import putHash from "./worker/put-hash.js";
import getHash from "./worker/get-hash.js";
import getWorkers from "./worker/get-workers.js";
import loaded from "./worker/loaded.js";
import unload from "./worker/unload.js";
import github from "./webhook/github.js";
import patreon from "./webhook/patreon.js";
import create from "./user/create.js";
import login from "./user/login.js";
import resetKey from "./user/reset-key.js";
import resetPassword from "./user/reset-password.js";
import rss from "./rss.js";

const app = express();

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-trace-secret");
  next();
});

const { TRACE_IMPORT_MODE = false } = process.env;

if (!TRACE_IMPORT_MODE) {
  app.use(
    rateLimit({
      max: 60, // limit each IP to 60 requests per 60 seconds
      delayMs: 0 // disable delaying - full speed until the max limit is reached
    })
  );
} else {
  console.warn('Import mode is enabled; rate limiting and searching is disabled');
}

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
      `${(performance.now() - startTime).toFixed(0)}ms`,
    );
  });
  next();
});

app.use(cors({ credentials: true, origin: true }));
app.use(
  express.raw({
    type: ["application/octet-stream", "application/x-www-form-urlencoded", "image/*", "video/*"],
    limit: 25 * 1024 * 1024,
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

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
app.all(
  "/search",
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).any(),
  search,
);
app.all("/user/login", login);
app.all("/user/create", create);
app.all("/user/reset-key", resetKey);
app.all("/user/reset-password", resetPassword);
app.all("/rss.xml", rss);
app.all("/", async (req, res) => {
  res.send("ok");
});

export default app;
