import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import child_process from "node:child_process";
import { Buffer } from "node:buffer";

import detectScene from "./lib/detect-scene.js";

const { VIDEO_PATH, TRACE_API_SALT, MEDIA_QUEUE = Infinity } = process.env;

const generateVideoPreview = async (filePath, start, end, size = "m", mute = false) =>
  new Promise((resolve) => {
    const ffmpeg = child_process.spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostats",
        "-y",
        "-ss",
        start - 10,
        "-i",
        filePath,
        "-ss",
        "10",
        "-t",
        end - start,
        mute ? "-an" : "-y",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        `scale=${{ l: 640, m: 320, s: 160 }[size]}:-2`,
        "-c:v",
        "libx264",
        "-crf",
        "25",
        "-profile:v",
        "high",
        "-preset",
        "veryfast",
        "-bf",
        "8",
        "-r",
        "24000/1001",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ac",
        "2",
        "-b:a",
        "64k",
        "-max_muxing_queue_size",
        "1024",
        "-movflags",
        "empty_moov+faststart",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-f",
        "mp4",
        "-",
      ],
      { timeout: 10000 },
    );
    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    let chunks = Buffer.alloc(0);
    ffmpeg.stdout.on("data", (data) => {
      chunks = Buffer.concat([chunks, data]);
    });
    ffmpeg.on("close", () => {
      resolve(chunks);
    });
  });

export default async (req, res) => {
  if (
    req.query.token !==
    crypto
      .createHash("sha1")
      .update(
        [
          req.params.anilistID,
          req.params.filename,
          req.query.t,
          req.query.now,
          TRACE_API_SALT,
        ].join(""),
      )
      .digest("base64")
      .replace(/[^0-9A-Za-z]/g, "")
  ) {
    return res.status(403).send("Forbidden");
  }
  if (((Date.now() / 1000) | 0) - Number(req.query.now) > 300) return res.status(410).send("Gone");
  const t = parseFloat(req.query.t);
  if (isNaN(t) || t < 0) {
    return res.status(400).send("Bad Request. Invalid param: t");
  }
  const fileFile = path.join(req.params.anilistID, req.params.filename);
  const videoFilePath = path.join(VIDEO_PATH, fileFile);
  if (!videoFilePath.startsWith(VIDEO_PATH)) {
    return res.status(403).send("Forbidden");
  }
  try {
    await fs.access(videoFilePath);
  } catch {
    return res.status(404).send("Not found");
  }
  const size = req.query.size || "m";
  if (!["l", "m", "s"].includes(size)) {
    return res.status(400).send("Bad Request. Invalid param: size");
  }
  if (req.app.locals.mediaQueue > MEDIA_QUEUE) return res.status(503).send("Service Unavailable");
  req.app.locals.mediaQueue++;

  try {
    const scene = await detectScene(
      videoFilePath,
      t,
      Math.min(Math.max(Number(req.query.minDuration) || 0, 0.5), 2), // default: 0.5s before and after t, range: 0.5s ~ 2.0s
      Math.min(Math.max(Number(req.query.maxDuration) || 5, 0.5), 5), // default: 5.0s before and after t, range: 0.5s ~ 5.0s
    );
    if (scene === null) {
      return res.status(500).send("Internal Server Error");
    }

    const muted = "mute" in req.query;
    const video = await generateVideoPreview(videoFilePath, scene.start, scene.end, size, muted);

    res.set("Content-Type", "video/mp4");
    res.set("x-video-start", scene.start);
    res.set("x-video-end", scene.end);
    res.set("x-video-duration", scene.duration);
    res.set("Access-Control-Expose-Headers", "x-video-start, x-video-end, x-video-duration");
    res.send(video);
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
  req.app.locals.mediaQueue--;
};
