import { Worker } from "node:worker_threads";
import sql from "../../sql.js";

const { MAX_WORKER = 1 } = process.env;

// NEW => ANALYZING => ANALYZED => HASHING => HASHED => LOADING => LOADED
export default async (app) => {
  const createWorker = async () => {
    while (app.locals.mutex) await new Promise((resolve) => setTimeout(resolve, 0));
    app.locals.mutex = true;

    const [row] = await sql`
      SELECT
        id,
        anilist_id,
        path,
        status
      FROM
        files
      WHERE
        status IN ('NEW', 'ANALYZED', 'HASHED')
      ORDER BY
        created DESC
      LIMIT
        1
    `;

    if (!row) {
      app.locals.workerCount--;
    } else if (row.status === "NEW") {
      await sql`
        UPDATE files
        SET
          status = 'ANALYZING',
          updated = now()
        WHERE
          path = ${row.path}
      `;
      const worker = new Worker("./src/worker/analyze.js", {
        workerData: { anilist_id: row.anilist_id, filePath: row.path },
      });
      worker.on("message", (message) => console.log(message));
      worker.on("error", (error) => console.error(error));
      worker.on("exit", async (code) => {
        await sql`
          UPDATE files
          SET
            status = 'ANALYZED',
            updated = now()
          WHERE
            path = ${row.path}
        `;
        await createWorker();
      });
    } else if (row.status === "ANALYZED") {
      await sql`
        UPDATE files
        SET
          status = 'HASHING',
          updated = now()
        WHERE
          path = ${row.path}
      `;
      const worker = new Worker("./src/worker/hash.js", {
        workerData: { id: row.id, filePath: row.path },
      });
      worker.on("message", (message) => console.log(message));
      worker.on("error", (error) => console.error(error));
      worker.on("exit", async (code) => {
        await sql`
          UPDATE files
          SET
            status = 'HASHED',
            updated = now()
          WHERE
            path = ${row.path}
        `;
        await createWorker();
      });
    } else if (row.status === "HASHED") {
      await sql`
        UPDATE files
        SET
          status = 'LOADING',
          updated = now()
        WHERE
          path = ${row.path}
      `;
      const worker = new Worker("./src/worker/load.js", {
        workerData: {
          id: row.id,
          anilist_id: row.anilist_id,
          filePath: row.path,
        },
      });
      worker.on("message", (message) => console.log(message));
      worker.on("error", (error) => console.error(error));
      worker.on("exit", async (code) => {
        await sql`
          UPDATE files
          SET
            status = 'LOADED',
            updated = now()
          WHERE
            path = ${row.path}
        `;
        await createWorker();
      });
    }
    app.locals.mutex = false;
  };

  const unprocessed = (
    await sql`
      SELECT
        COUNT(*) AS count
      FROM
        files
      WHERE
        status IN ('NEW', 'ANALYZED', 'HASHED')
    `
  )[0].count;
  while (app.locals.workerCount < Math.min(unprocessed, Number(MAX_WORKER))) {
    app.locals.workerCount++;
    await createWorker();
  }
};
