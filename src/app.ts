import { performance } from "node:perf_hooks";
import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import multer from "multer";

import getMe from "./get-me.ts";
import getStatus from "./get-status.ts";
import getStats from "./get-stats.ts";
import search from "./search.ts";
import scan from "./scan.ts";
import video from "./video.ts";
import image from "./image.ts";
import github from "./webhook/github.ts";
import patreon from "./webhook/patreon.ts";
import create from "./user/create.ts";
import login from "./user/login.ts";
import resetKey from "./user/reset-key.ts";
import resetPassword from "./user/reset-password.ts";

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
    limit: 100, // limit each IPv4 (or IPv6 /56 subnet) to 100 requests per 60 seconds
    windowMs: 60 * 1000,
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
app.all("/", async (req, res) => {
  res.send("ok");
});

export default app;
