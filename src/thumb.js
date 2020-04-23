require("dotenv").config();
const child_process = require("child_process");
const path = require("path");
const fs = require("fs-extra");

module.exports = async ctx => {
  const file = path.join(
    "/mnt/data/anilist/",
    ctx.params.anilistID,
    ctx.params.file
  );
  if (!fs.existsSync(file)) {
    ctx.body = "404 Not Found";
    return;
  }
  const ffmpeg = child_process.spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-y",
    "-ss",
    Number(ctx.query.t),
    "-i",
    file,
    "-vf",
    "scale=320:-2",
    "-c:v",
    "mjpeg",
    "-vframes",
    "1",
    "-f",
    "image2pipe",
    "pipe:1"
  ]);
  if (ffmpeg.stderr.length) {
    console.log(ffmpeg.stderr.toString());
  }
  ctx.type = "image/jpeg";
  ctx.body = ffmpeg.stdout;
};
