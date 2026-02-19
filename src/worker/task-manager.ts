import fs from "node:fs/promises";
import { Worker } from "node:worker_threads";
import path from "node:path";
import sql from "../../sql.ts";
import type { ServerResponse } from "node:http";

const VIDEO_PATH = path.normalize(process.env.VIDEO_PATH);
const MAX_WORKER = Number(process.env.MAX_WORKER) || 1;

export default class TaskManager {
  scanTimer: NodeJS.Timeout;

  isScanTaskRunning = false;

  async runScanTask(interval: number) {
    if (this.isScanTaskRunning) return;
    this.isScanTaskRunning = true;
    clearTimeout(this.scanTimer);
    console.info(`[scan][doing] ${VIDEO_PATH}`);

    const [dbSet, fileList] = await Promise.all([
      sql`
        SELECT
          path
        FROM
          files
      `.then((e) => new Set(e.map((e) => e.path))),
      fs
        .readdir(VIDEO_PATH, { recursive: true, withFileTypes: true })
        .then((e) =>
          e
            .filter(
              (e) =>
                e.isFile() &&
                path.relative(VIDEO_PATH, e.parentPath).match(/^\d+$/) &&
                [".webm", ".mkv", ".mp4"].includes(path.extname(e.name)),
            )
            .map((e) => path.join(path.relative(VIDEO_PATH, e.parentPath), e.name)),
        ),
    ]);

    const newFileList = fileList.filter((e) => !dbSet.has(e));

    for (let i = 0; i < newFileList.length; i += 10000) {
      await sql`
        INSERT INTO
          files ${sql(
            newFileList
              .slice(i, i + 10000)
              .map((e) => ({ anilist_id: Number(path.parse(e).dir), path: e, status: "NEW" })),
          )}
      `;
    }

    console.info(`[scan][done]  ${VIDEO_PATH}`);

    this.runAnilistTask();
    this.runMediaInfoTask();
    this.runSceneChangesTask();
    this.runColorLayoutTask();
    this.runMilvusLoadTask();

    this.isScanTaskRunning = false;
    if (interval) this.scanTimer = setTimeout(() => this.runScanTask(interval), interval * 1000);
  }

  stopScanTask() {
    clearTimeout(this.scanTimer);
  }

  isAnilistTaskRunning = false;

  async runAnilistTask() {
    const rows = await sql`
      SELECT DISTINCT
        anilist_id
      FROM
        files
      WHERE
        anilist_id NOT IN (
          SELECT
            id
          FROM
            anilist
        )
    `;
    if (rows.length === 0 || this.isAnilistTaskRunning) return;
    this.isAnilistTaskRunning = true;
    const worker = new Worker("./src/worker/anilist.ts", {
      workerData: { ids: rows.map((e) => e.anilist_id) },
    });
    worker.on("error", (error) => console.error(error));
    worker.on("exit", () => {
      this.isAnilistTaskRunning = false;
      this.runAnilistTask();
      this.runMilvusLoadTask();
    });
  }

  mediaInfoTaskList = new Map<number, any>();
  mediaInfoTaskListMax = MAX_WORKER;

  async runMediaInfoTask() {
    if (this.mediaInfoTaskList.size >= this.mediaInfoTaskListMax) return;
    for (const { id, path: relativePath } of await sql`
      SELECT
        id,
        path
      FROM
        files
      WHERE
        media_info IS NULL
      ORDER BY
        id DESC
      LIMIT
        ${this.mediaInfoTaskListMax}
    `) {
      const filePath = path.join(VIDEO_PATH, relativePath);
      if (this.mediaInfoTaskList.has(id)) continue;
      const worker = new Worker("./src/worker/media-info.ts", {
        workerData: { id, filePath },
      });
      worker.on("error", (error) => console.error(error));
      worker.on("exit", () => {
        this.mediaInfoTaskList.delete(id);
        this.publish();
        this.runMediaInfoTask();
        this.runMilvusLoadTask();
      });
      this.mediaInfoTaskList.set(id, { id, filePath, worker });
      this.publish();
    }
  }

  sceneChangesTaskList = new Map<number, any>();
  sceneChangesTaskListMax = MAX_WORKER;

  async runSceneChangesTask() {
    if (this.sceneChangesTaskList.size >= this.sceneChangesTaskListMax) return;
    for (const { id, path: relativePath } of await sql`
      SELECT
        id,
        path
      FROM
        files
      WHERE
        scene_changes IS NULL
      ORDER BY
        id DESC
      LIMIT
        ${this.sceneChangesTaskListMax}
    `) {
      const filePath = path.join(VIDEO_PATH, relativePath);
      if (this.sceneChangesTaskList.has(id)) continue;
      const worker = new Worker("./src/worker/scene-changes.ts", {
        workerData: { id, filePath },
      });
      worker.on("error", (error) => console.error(error));
      worker.on("exit", () => {
        this.sceneChangesTaskList.delete(id);
        this.publish();
        this.runSceneChangesTask();
        this.runMilvusLoadTask();
      });
      this.sceneChangesTaskList.set(id, { id, filePath, worker });
      this.publish();
    }
  }

  colorLayoutTaskList = new Map<number, any>();
  colorLayoutTaskListMax = MAX_WORKER;

  async runColorLayoutTask() {
    if (this.colorLayoutTaskList.size >= this.colorLayoutTaskListMax) return;
    for (const { id, path: relativePath } of await sql`
      SELECT
        id,
        path
      FROM
        files
      WHERE
        id NOT IN (
          SELECT
            id
          FROM
            files_color_layout
        )
      ORDER BY
        id DESC
      LIMIT
        ${this.colorLayoutTaskListMax}
    `) {
      const filePath = path.join(VIDEO_PATH, relativePath);
      if (this.colorLayoutTaskList.has(id)) continue;
      const worker = new Worker("./src/worker/color-layout.ts", {
        workerData: { id, filePath },
      });
      worker.on("error", (error) => console.error(error));
      worker.on("exit", () => {
        this.colorLayoutTaskList.delete(id);
        this.publish();
        this.runColorLayoutTask();
        this.runMilvusLoadTask();
      });
      this.colorLayoutTaskList.set(id, { id, filePath, worker });
      this.publish();
    }
  }

  milvusLoadTaskList = new Map<number, any>();
  milvusLoadTaskListMax = MAX_WORKER;

  async runMilvusLoadTask() {
    if (this.milvusLoadTaskList.size >= this.milvusLoadTaskListMax) return;
    for (const { id, anilist_id, path: relativePath } of await sql`
      SELECT
        id,
        anilist_id,
        path
      FROM
        files
      WHERE
        status != 'LOADED'
        AND media_info IS NOT NULL
        AND scene_changes IS NOT NULL
        AND anilist_id IN (
          SELECT
            id
          FROM
            anilist
        )
        AND id IN (
          SELECT
            id
          FROM
            files_color_layout
        )
      ORDER BY
        id DESC
      LIMIT
        ${this.milvusLoadTaskListMax}
    `) {
      const filePath = path.join(VIDEO_PATH, relativePath);
      if (this.milvusLoadTaskList.has(id)) continue;
      const worker = new Worker("./src/worker/milvus-load.ts", {
        workerData: { id, anilist_id, filePath },
      });
      worker.on("error", (error) => console.error(error));
      worker.on("exit", () => {
        this.milvusLoadTaskList.delete(id);
        this.publish();
        this.runMilvusLoadTask();
      });
      this.milvusLoadTaskList.set(id, { id, anilist_id, filePath, worker });
      this.publish();
    }
  }

  sseClients = new Set<ServerResponse>();

  subscribe(res) {
    res.on("close", () => {
      this.sseClients.delete(res);
    });
    this.sseClients.add(res);
    this.publish();
  }

  publishTimer: NodeJS.Timeout;

  publish() {
    clearTimeout(this.publishTimer);
    const tasks = {
      mediaInfoTaskList: Array.from(this.mediaInfoTaskList.values()).map((e) => e.filePath),
      sceneChangesTaskList: Array.from(this.sceneChangesTaskList.values()).map((e) => e.filePath),
      colorLayoutTaskList: Array.from(this.colorLayoutTaskList.values()).map((e) => e.filePath),
      milvusLoadTaskList: Array.from(this.milvusLoadTaskList.values()).map((e) => e.filePath),
    };
    for (const client of this.sseClients) {
      client.write(`data: ${JSON.stringify(tasks)}\n\n`);
    }
    this.publishTimer = setTimeout(() => this.publish(), 30000); // keep alive to prevent cloudflare timeout
  }
}
