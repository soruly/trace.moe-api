import child_process from "node:child_process";

export default async (filePath) =>
  new Promise((resolve) => {
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
