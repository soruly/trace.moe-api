require("dotenv").config();
const os = require("os");
const child_process = require("child_process");
const path = require("path");
const fs = require("fs-extra");

module.exports = async (ctx) => {
  const file = path.join("/mnt/data/anilist/", ctx.params.anilistID, ctx.params.file);
  if (!fs.existsSync(file)) {
    ctx.body = "404 Not Found";
    return;
  }
  const tempPath = path.join(os.tmpdir(), `videoPreview${process.hrtime().join("")}.mp4`);
  const start = Number(ctx.query.t) - 0.1;
  const end = Number(ctx.query.t) + 0.1;
  const a = child_process.spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-nostats",
      "-y",
      "-ss",
      start,
      "-i",
      file,
      "-t",
      end - start,
      "-an",
      "-vf",
      "scale=320:-2",
      "-crf",
      "23",
      "-preset",
      "faster",
      "-f",
      "mp4",
      tempPath,
    ],
    { encoding: "utf-8" }
  );
  console.log(a.stderr);
  const videoBuffer = fs.readFileSync(tempPath);
  fs.removeSync(tempPath);
  ctx.type = "video/mp4";
  ctx.body = videoBuffer;
};
