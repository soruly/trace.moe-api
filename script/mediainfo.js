import "dotenv/config";
import path from "node:path";
import child_process from "node:child_process";
import cluster from "node:cluster";
import fs from "node:fs/promises";
import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_ALGO,
  VIDEO_PATH,
} = process.env;

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
  },
});

if (cluster.isPrimary) {
  console.log("Cleaning up deleted files");
  for (const media of await knex("mediainfo")) {
    try {
      await fs.access(path.join(VIDEO_PATH, media.path));
    } catch {
      await knex("mediainfo").where("path", media.path).del();
      console.log(`Deleted: ${media.path}`);
    }
  }

  console.log("Reading file list...");
  const fileList = (
    await knex(TRACE_ALGO)
      .leftJoin("mediainfo", `${TRACE_ALGO}.path`, "mediainfo.path")
      .whereNull("mediainfo.json")
      .select(`${TRACE_ALGO}.path`)
  ).map((e) => e.path);

  let finished = 0;
  const concurrency = 8;
  const displayInterval = 500; // ms
  let speedRecord = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let time = 0;
  let mark = fileList.length;
  let total = fileList.length;

  for (let i = 0; i < concurrency; i++) {
    const worker = cluster.fork();
    worker.on("message", async (message) => {
      if (message) {
        const { filePath, result } = JSON.parse(message);
        const { mtime, ctime } = await fs.lstat(path.join(VIDEO_PATH, filePath));
        await knex.raw(
          knex("mediainfo")
            .insert({
              path: filePath,
              json: result,
              created: ctime,
              updated: mtime,
            })
            .toString()
            .replace(/^insert/i, "insert ignore"),
        );
        if (Date.now() - time > displayInterval) {
          const speed = (mark - fileList.length) / (displayInterval / 1000);
          speedRecord.push(speed);
          speedRecord = speedRecord.slice(1);
          const averageSpeed = speedRecord.reduce((a, b) => a + b, 0) / speedRecord.length;
          const ETA = fileList.length / averageSpeed;
          const completed = total - fileList.length;
          const percentage = ((completed / total) * 100).toFixed(2);
          console.log(
            `${completed}/${total}`,
            `(${percentage}%)`,
            `[${averageSpeed.toFixed(1)} tasks/s, ETA ${ETA.toFixed(0)}s]`,
          );
          time = Date.now();
          mark = fileList.length;
        }
      }
      if (fileList.length === 0) {
        worker.kill();
      } else {
        worker.send(fileList.pop());
      }
    });

    worker.on("exit", (code) => {
      finished += 1;
      if (finished === concurrency) {
        console.log("all done");
        process.exit();
      }
    });
  }
} else {
  process.send("");
  process.on("message", (message) => {
    try {
      const result = child_process
        .execSync(
          [
            "ffprobe",
            "-show_format",
            "-show_streams",
            "-v quiet",
            "-print_format json=compact=1",
            `'${path.join(VIDEO_PATH, message).replace(/'/g, "'\\''")}'`,
          ].join(" "),
        )
        .toString();
      process.send(JSON.stringify({ filePath: message, result: result }));
    } catch (e) {
      console.log(e, message);
    }
  });
}
