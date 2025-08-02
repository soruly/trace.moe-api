import { performance } from "node:perf_hooks";
import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import multer from "multer";

import getMe from "./get-me.js";
import getStatus from "./get-status.js";
import getStats from "./get-stats.js";
import search from "./search.js";
import scan from "./scan.js";
import video from "./video.js";
import image from "./image.js";
import github from "./webhook/github.js";
import patreon from "./webhook/patreon.js";
import create from "./user/create.js";
import login from "./user/login.js";
import resetKey from "./user/reset-key.js";
import resetPassword from "./user/reset-password.js";
import rss from "./rss.js";

const app = express();

app.disable("x-powered-by");

app.set("trust proxy", 2);

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-trace-secret");
  next();
});

app.use(
  rateLimit({
    max: 100, // limit each IP to max requests per 60 seconds
    delayMs: 0, // disable delaying - full speed until the max limit is reached
  }),
);

app.use((req, res, next) => {
  const startTime = performance.now();
  console.log("=>", new Date().toISOString(), req.ip, req.url);
  res.on("finish", () => {
    console.log(
      "<=",
      new Date().toISOString(),
      req.ip,
      req.url,
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
app.get("/scan", scan);
app.all("/webhook/github", github);
app.all("/webhook/patreon", patreon);
app.all(
  "/search",
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).any(),
  search,
);
app.get("/video/:id", video);
app.get("/image/:id", image);
app.all("/user/login", login);
app.all("/user/create", create);
app.all("/user/reset-key", resetKey);
app.all("/user/reset-password", resetPassword);
app.all("/rss.xml", rss);
app.all("/", async (req, res) => {
  res.send("ok");
});

export default app;
