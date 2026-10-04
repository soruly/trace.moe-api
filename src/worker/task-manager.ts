import fs from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { Worker } from "node:worker_threads";

import aniep from "aniep";

import sql from "../../sql.ts";
import { parseEpisodeRange } from "../lib/parse-episode.ts";

const VIDEO_PATH = path.normalize(process.env.VIDEO_PATH);
const MAX_WORKER = Number(process.env.MAX_WORKER) || 1;

export default class TaskManager {
  scanTimer: NodeJS.Timeout;

  isScanTaskRunning = false;

  isFullScanPending = false;

  pendingAnilistIds = new Set<number>();

  scanInterval = Number(process.env.SCAN_INTERVAL ?? 60);

  async runScanTask(interval?: number, anilistId?: number) {
    if (interval !== undefined && Number.isFinite(interval) && interval >= 0) {
      this.scanInterval = interval;
    }
    if (this.isScanTaskRunning) {
      if (anilistId) {
        this.pendingAnilistIds.add(anilistId);
      } else {
        this.isFullScanPending = true;
      }
      return;
    }
    this.isScanTaskRunning = true;
    try {
      const targetDir = anilistId ? path.join(VIDEO_PATH, String(anilistId)) : VIDEO_PATH;
      console.info(`[scan][doing] ${targetDir}`);

      let fileList: string[] = [];
      let dbSet: Set<string>;

      if (anilistId) {
        try {
          const stat = await fs.stat(targetDir);
          if (stat.isDirectory()) {
            const [dbSetResult, entries] = await Promise.all([
              sql`
                SELECT
                  path
                FROM
                  files
                WHERE
                  anilist_id = ${anilistId}
              `.then((e) => new Set(e.map((e) => e.path))),
              fs.readdir(targetDir, { withFileTypes: true }),
            ]);
            dbSet = dbSetResult;
            fileList = entries
              .filter(
                (e) =>
                  e.isFile() && [".webm", ".mkv", ".mp4", ".ts"].includes(path.extname(e.name)),
              )
              .map((e) => path.join(String(anilistId), e.name));
          } else {
            dbSet = new Set();
          }
        } catch {
          console.warn(`[scan][skip] Directory does not exist: ${targetDir}`);
          dbSet = new Set();
        }
      } else {
        const [dbSetResult, fullList] = await Promise.all([
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
                    [".webm", ".mkv", ".mp4", ".ts"].includes(path.extname(e.name)),
                )
                .map((e) => path.join(path.relative(VIDEO_PATH, e.parentPath), e.name)),
            ),
        ]);
        dbSet = dbSetResult;
        fileList = fullList;
      }

      const newFileList = fileList.filter((e) => !dbSet.has(e));

      for (let i = 0; i < newFileList.length; i += 10000) {
        await sql`
          INSERT INTO
            files ${sql(
              newFileList.slice(i, i + 10000).map((e) => {
                const { episode_start, episode_end } = parseEpisodeRange(aniep(path.basename(e)));
                return {
                  anilist_id: Number(path.parse(e).dir),
                  episode_start,
                  episode_end,
                  path: e,
                };
              }),
            )}
        `;
      }

      console.info(`[scan][done]  ${targetDir}`);

      this.runAnilistTask();
      this.runCrc32Task();
      this.runMediaInfoTask();
      this.runColorLayoutTask();
      this.runMilvusLoadTask();
    } catch (error) {
      console.error(error);
    } finally {
      this.isScanTaskRunning = false;
      if (this.isFullScanPending) {
        this.isFullScanPending = false;
        this.pendingAnilistIds.clear();
        this.runScanTask();
      } else if (this.pendingAnilistIds.size > 0) {
        const nextId = this.pendingAnilistIds.values().next().value;
        this.pendingAnilistIds.delete(nextId);
        this.runScanTask(undefined, nextId);
      } else if (!anilistId && this.scanInterval > 0 && Number.isFinite(this.scanInterval)) {
        clearTimeout(this.scanTimer);
        this.scanTimer = setTimeout(() => this.runScanTask(), this.scanInterval * 1000);
      }
    }
  }

  stopScanTask() {
    clearTimeout(this.scanTimer);
  }

  isAnilistTaskRunning = false;

  async runAnilistTask() {
    try {
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
    } catch (error) {
      console.error(error);
    }
  }

  mediaInfoTaskList = new Map<number, any>();
  mediaInfoTaskListMax = MAX_WORKER;

  async runMediaInfoTask() {
    if (this.mediaInfoTaskList.size >= this.mediaInfoTaskListMax) return;
    try {
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
    } catch (error) {
      console.error(error);
    }
  }

  colorLayoutTaskList = new Map<number, any>();
  colorLayoutTaskListMax = MAX_WORKER;

  async runColorLayoutTask() {
    if (this.colorLayoutTaskList.size >= this.colorLayoutTaskListMax) return;
    try {
      for (const { id, path: relativePath } of await sql`
        SELECT
          id,
          path
        FROM
          files
        WHERE
          color_layout IS NULL
          OR scene_changes IS NULL
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
    } catch (error) {
      console.error(error);
    }
  }

  milvusLoadTaskList = new Map<number, any>();
  milvusLoadTaskListMax = MAX_WORKER;

  async runMilvusLoadTask() {
    if (this.milvusLoadTaskList.size >= this.milvusLoadTaskListMax) return;
    try {
      for (const { id, path: relativePath } of await sql`
        SELECT
          id,
          path
        FROM
          files
        WHERE
          loaded IS NULL
          AND media_info IS NOT NULL
          AND scene_changes IS NOT NULL
          AND color_layout IS NOT NULL
          AND anilist_id IN (
            SELECT
              id
            FROM
              anilist
          )
        ORDER BY
          id DESC
        LIMIT
          ${this.milvusLoadTaskListMax}
      `) {
        const filePath = path.join(VIDEO_PATH, relativePath);
        if (this.milvusLoadTaskList.has(id)) continue;
        const worker = new Worker("./src/worker/milvus-load.ts", {
          workerData: { id, filePath },
        });
        worker.on("error", (error) => console.error(error));
        worker.on("exit", () => {
          this.milvusLoadTaskList.delete(id);
          this.publish();
          this.runMilvusLoadTask();
        });
        this.milvusLoadTaskList.set(id, { id, filePath, worker });
        this.publish();
      }
    } catch (error) {
      console.error(error);
    }
  }

  crc32TaskList = new Map<number, any>();
  crc32TaskListMax = MAX_WORKER;

  async runCrc32Task() {
    if (this.crc32TaskList.size >= this.crc32TaskListMax) return;
    try {
      for (const { id, path: relativePath } of await sql`
        SELECT
          id,
          path
        FROM
          files
        WHERE
          crc32 IS NULL
        ORDER BY
          id DESC
        LIMIT
          ${this.crc32TaskListMax}
      `) {
        const filePath = path.join(VIDEO_PATH, relativePath);
        if (this.crc32TaskList.has(id)) continue;
        const worker = new Worker("./src/worker/crc32.ts", {
          workerData: { id, filePath },
        });
        worker.on("error", (error) => console.error(error));
        worker.on("exit", () => {
          this.crc32TaskList.delete(id);
          this.publish();
          this.runCrc32Task();
        });
        this.crc32TaskList.set(id, { id, filePath, worker });
        this.publish();
      }
    } catch (error) {
      console.error(error);
    }
  }

  sseClients = new Set<ServerResponse>();

  subscribe(res) {
    res.on("close", () => {
      this.sseClients.delete(res);
    });
    res.on("error", () => {
      this.sseClients.delete(res);
    });
    this.sseClients.add(res);
    this.publish();
  }

  publishTimer: NodeJS.Timeout;

  publish() {
    clearTimeout(this.publishTimer);
    const tasks = {
      crc32TaskList: Array.from(this.crc32TaskList.values()).map((e) => e.filePath),
      mediaInfoTaskList: Array.from(this.mediaInfoTaskList.values()).map((e) => e.filePath),
      colorLayoutTaskList: Array.from(this.colorLayoutTaskList.values()).map((e) => e.filePath),
      milvusLoadTaskList: Array.from(this.milvusLoadTaskList.values()).map((e) => e.filePath),
    };
    for (const client of this.sseClients) {
      client.write(`data: ${JSON.stringify(tasks)}\n\n`);
    }
    this.publishTimer = setTimeout(() => this.publish(), 30000); // keep alive to prevent cloudflare timeout
  }
}
