import child_process from "node:child_process";

const { VIDEO_PATH } = process.env;

export default async (filePath, knex) =>
  new Promise(async (resolve) => {
    const rows = await knex("file")
      .where("path", filePath.replace(VIDEO_PATH, ""))
      .select("duration")
      .first();

    if (rows?.duration) {
      return resolve(rows.duration);
    }

    const ffprobe = child_process.spawn(
      "ffprobe",
      ["-i", filePath, "-show_entries", "format=duration", "-v", "quiet"],
      { timeout: 10000 },
    );
    let stdLog = "";
    ffprobe.stdout.on("data", (data) => {
      stdLog += data.toString();
    });
    ffprobe.on("close", () => {
      const result = /duration=((\d|\.)+)/.exec(stdLog);
      if (result === null) {
        resolve(null);
      }
      resolve(parseFloat(result[1]));
    });
  });
