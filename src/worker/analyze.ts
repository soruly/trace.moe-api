import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import child_process from "node:child_process";
import { parentPort, threadId, workerData } from "node:worker_threads";
import sql from "../../sql.ts";

const { VIDEO_PATH } = process.env;

const { anilist_id, filePath } = workerData;
parentPort.postMessage(`[${threadId}] Analyzing ${filePath}`);

const videoFilePath = path.join(VIDEO_PATH, filePath);
try {
  await fs.access(path.join(VIDEO_PATH, filePath));
} catch {
  parentPort.postMessage(`[${threadId}] Error: No such file ${videoFilePath}`);
  process.exit(1);
}

const rows = await sql`
  SELECT
    id
  FROM
    anilist
  WHERE
    id = ${anilist_id}
`;
if (!rows.length) {
  console.log(`Fetching anime info ID ${anilist_id} from anilist`);
  const res = await fetch("https://graphql.anilist.co/", {
    method: "POST",
    body: JSON.stringify({
      query: await fs.readFile(
        path.join(import.meta.dirname, "../../script/anilist.graphql"),
        "utf8",
      ),
      variables: { id: anilist_id },
    }),
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 200) {
    const anime = (await res.json()).data.Page.media[0];
    console.log(`Saving anime info ID ${anime.id} (${anime.title.native ?? anime.title.romaji})`);
    await sql`
      INSERT INTO
        anilist (id, updated, json)
      VALUES
        (
          ${Number(anime.id)},
          now(),
          ${anime}
        )
    `;
  }
}

const start = performance.now();

const { stdout, stderr } = child_process.spawnSync("ffprobe", [
  "-v",
  "error",
  "-show_format",
  "-show_streams",
  "-print_format",
  "json=compact=1",
  videoFilePath,
]);
if (stderr.length) console.log(stderr.toString());
if (stdout.length) {
  await sql`
    UPDATE files
    SET
      media_info = ${JSON.parse(stdout.toString())},
      updated = now()
    WHERE
      path = ${filePath}
  `;
}

const sceneList: [number, number][] = await new Promise((resolve) => {
  const list = [];
  const ffmpeg = child_process.spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "info",
    "-nostats",
    "-y",
    "-i",
    `${videoFilePath}`,
    "-filter_complex",
    "select='gt(scene,0.2)',metadata=print",
    "-an",
    "-vsync",
    "vfr",
    "-f",
    "null",
    "-",
  ]);
  os.setPriority(ffmpeg.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  ffmpeg.stderr.on("data", (data) => {
    const match = data.toString().match(/pts_time:(\d+\.\d+).*scene_score=(\d+\.\d+)/s);
    if (!match) return;
    const [_, pts_time, scene_score] = match;
    list.push([Number(pts_time), Number(scene_score)]);
  });
  ffmpeg.on("close", async (code) => {
    resolve(list);
  });
});

await sql`
  UPDATE files
  SET
    scene_changes = ${sceneList},
    updated = now()
  WHERE
    path = ${filePath}
`;

await sql.end();

parentPort.postMessage(
  `[${threadId}] Analyzed ${filePath} in ${(performance.now() - start).toFixed(0)} ms`,
);
