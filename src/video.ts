import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import sql from "../sql.ts";
import detectScene from "./lib/detect-scene.ts";
import generateVideoPreview from "./lib/generate-video-preview.ts";

const { VIDEO_PATH, TRACE_API_SALT, MEDIA_QUEUE = Infinity } = process.env;

export default async (req, res) => {
  const [fileId, time, expire, hash] = req.app.locals.sqids.decode(req.params.id);
  const buf = Buffer.from(TRACE_API_SALT);
  buf.writeUInt32LE(Math.abs(time ^ expire ^ fileId));
  const token = crypto.createHash("sha1").update(buf).digest("binary");
  if (Buffer.from(token).readUInt32LE() !== hash) return res.status(403).send("Forbidden");

  if (((Date.now() / 1000) | 0) - expire > 300) return res.status(410).send("Gone");

  const [row] = await sql`
    SELECT
      path
    FROM
      files
    WHERE
      id = ${fileId}
  `;
  if (!row) return res.status(404).send("Not found");

  const videoFilePath = path.join(VIDEO_PATH, row.path);
  if (!videoFilePath.startsWith(VIDEO_PATH)) return res.status(403).send("Forbidden");

  try {
    await fs.access(videoFilePath);
  } catch {
    return res.status(404).send("Not found");
  }
  const size = req.query.size || "m";
  if (!["l", "m", "s"].includes(size)) {
    return res.status(400).send("Bad Request. Invalid param: size");
  }

  const ifNoneMatch = req.header("If-None-Match");
  if (
    ifNoneMatch &&
    ifNoneMatch
      .split(",")
      .map((tag) => tag.trim())
      .includes("v0")
  ) {
    return res.status(304).end(); // Not Modified
  }

  if (req.app.locals.mediaQueue > MEDIA_QUEUE) return res.status(503).send("Service Unavailable");
  req.app.locals.mediaQueue++;

  try {
    const scene = await detectScene(
      videoFilePath,
      time / 10000,
      Math.min(Math.max(Number(req.query.minDuration) || 0, 0.5), 2), // default: 0.5s before and after t, range: 0.5s ~ 2.0s
      Math.min(Math.max(Number(req.query.maxDuration) || 5, 0.5), 5), // default: 5.0s before and after t, range: 0.5s ~ 5.0s
    );
    if (scene === null) {
      return res.status(500).send("Internal Server Error");
    }

    const muted = "mute" in req.query;

    res.set("Cache-Control", "max-age=86400");
    res.set("Content-Type", "video/mp4");
    res.set("ETag", "v0");
    res.set("x-video-start", scene.start);
    res.set("x-video-end", scene.end);
    res.set("x-video-duration", scene.duration);
    res.set("Access-Control-Expose-Headers", "x-video-start, x-video-end, x-video-duration");

    const ffmpeg = generateVideoPreview(videoFilePath, scene.start, scene.end, size, muted);

    ffmpeg.stdout.pipe(res);

    await new Promise<void>((resolve) => {
      ffmpeg.on("close", () => resolve());
      ffmpeg.on("error", (err) => {
        console.log(err);
        res.end(); // terminate the stream to signal error to client
        resolve();
      });
    });
  } catch (e) {
    console.log(e);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
  req.app.locals.mediaQueue--;
};
