import { performance } from "node:perf_hooks";

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";

import getMe from "./get-me.ts";
import getStats from "./get-stats.ts";
import getStatus from "./get-status.ts";
import image from "./image.ts";
import scan from "./scan.ts";
import search from "./search.ts";
import tasks from "./tasks.ts";
import create from "./user/create.ts";
import login from "./user/login.ts";
import resetKey from "./user/reset-key.ts";
import resetPassword from "./user/reset-password.ts";
import video from "./video.ts";
import github from "./webhook/github.ts";
import patreon from "./webhook/patreon.ts";

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
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: true,
    ipv6Subnet: 64,
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
app.all("/tasks", tasks);
app.all("/webhook/github", github);
app.all("/webhook/patreon", patreon);
app.all(
  "/search",
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).any(),
  search,
);
app.get("/video/:id", video);
app.get("/image/:id", image);

const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: true,
  ipv6Subnet: 64,
});

app.all("/user/login", userRateLimiter, login);
app.all("/user/create", userRateLimiter, create);
app.all("/user/reset-key", userRateLimiter, resetKey);
app.all("/user/reset-password", userRateLimiter, resetPassword);
app.all("/", async (req, res) => {
  res.send("ok");
});

export default app;
