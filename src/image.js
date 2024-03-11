import path from "node:path";
import fs from "fs-extra";
import crypto from "node:crypto";
import child_process from "node:child_process";

const { VIDEO_PATH, TRACE_API_SALT, MEDIA_QUEUE = Infinity } = process.env;

const generateImagePreview = async (filePath, t, size = "m") =>
  new Promise((resolve) => {
    const ffmpeg = child_process.spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostats",
      "-y",
      "-ss",
      t - 10,
      "-i",
      filePath,
      "-ss",
      "10",
      "-vf",
      `scale=${{ l: 640, m: 320, s: 160 }[size]}:-2`,
      "-c:v",
      "mjpeg",
      "-vframes",
      "1",
      "-f",
      "image2pipe",
      "pipe:1",
    ]);
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
  const videoFilePath = path.join(
    VIDEO_PATH,
    req.params.anilistID,
    req.params.filename.replace(/\.jpg$/, ""),
  );
  if (!videoFilePath.startsWith(VIDEO_PATH)) {
    return res.status(403).send("Forbidden");
  }
  if (!(await fs.exists(videoFilePath))) {
    return res.status(404).send("Not found");
  }
  const size = req.query.size || "m";
  if (!["l", "m", "s"].includes(size)) {
    return res.status(400).send("Bad Request. Invalid param: size");
  }
  if (req.app.locals.mediaQueue > MEDIA_QUEUE) return res.status(503).send("Service Unavailable");
  req.app.locals.mediaQueue++;
  try {
    const image = await generateImagePreview(videoFilePath, t, size);
    res.set("Content-Type", "image/jpg");
    res.send(image);
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
  req.app.locals.mediaQueue--;
};
