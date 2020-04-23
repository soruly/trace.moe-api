require("dotenv").config();
const child_process = require("child_process");
const path = require("path");
const fs = require("fs-extra");

module.exports = async (ctx) => {
  const file = path.join(
    "/mnt/data/anilist/",
    ctx.params.anilistID,
    ctx.params.file
  );
  if (!fs.existsSync(file)) {
    ctx.body = "404 Not Found";
    return;
  }
  ctx.body = Number(
    JSON.parse(
      child_process.spawnSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-print_format",
          "json",
          file,
        ],
        { encoding: "utf-8" }
      ).stdout
    ).format.duration
  );
};
