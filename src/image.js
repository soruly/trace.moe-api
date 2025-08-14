import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import child_process from "node:child_process";
import sql from "../sql.js";

const { VIDEO_PATH, TRACE_API_SALT, MEDIA_QUEUE = Infinity } = process.env;

const generateImagePreview = async (filePath, t, format = "jpeg", size = "m") =>
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
      { jxl: "libjxl", webp: "libwebp", jpeg: "mjpeg" }[format],
      "-q:v",
      { jxl: "80", webp: "85", jpeg: "6" }[format],
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
  const format =
    (req.headers["accept"] ?? "")
      .split(",")
      .filter((e) => e.startsWith("image/"))
      .map((e) => e.split(";").shift().replace("image/", ""))
      .reduce((acc, cur) => (!acc && ["jxl", "webp"].includes(cur) ? cur : acc), "") || "jpeg";

  const size = req.query.size || "m";
  if (!["l", "m", "s"].includes(size)) {
    return res.status(400).send("Bad Request. Invalid param: size");
  }
  if (req.app.locals.mediaQueue > MEDIA_QUEUE) return res.status(503).send("Service Unavailable");
  req.app.locals.mediaQueue++;
  try {
    const image = await generateImagePreview(videoFilePath, time / 10000, format, size);
    res.set("Content-Type", `image/${format}`);
    res.send(image);
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
  req.app.locals.mediaQueue--;
};
