import { Worker } from "node:worker_threads";
import sql from "../../sql.js";
import getSolrCoreList from "../lib/get-solr-core-list.js";

const { SOLA_SOLR_LIST, MAX_WORKER = 1 } = process.env;

const selectCore = (function* (arr) {
  let index = 0;
  while (true) {
    yield arr[index % arr.length];
    index++;
  }
})(getSolrCoreList());

const getLeastPopulatedCore = async () =>
  (
    await Promise.all(
      SOLA_SOLR_LIST.split(",").map((solrUrl) =>
        fetch(`${solrUrl}admin/cores?wt=json`)
          .then((res) => res.json())
          .then(({ status }) => {
            return Object.values(status).map((e) => ({
              name: `${solrUrl}${e.name}`,
              numDocs: e.index.numDocs,
            }));
          }),
      ),
    )
  )
    .flat()
    .sort((a, b) => a.numDocs - b.numDocs)[0].name;

// NEW => ANALYZING => ANALYZED => HASHING => HASHED => LOADING => LOADED
export default async (app) => {
  const createWorker = async () => {
    while (app.locals.mutex) await new Promise((resolve) => setTimeout(resolve, 0));
    app.locals.mutex = true;

    const [row] = await sql`
      SELECT
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
        workerData: { filePath: row.path },
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
        workerData: { filePath: row.path },
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
      const size = (
        await sql`
          SELECT
            COUNT(*) AS count
          FROM
            files
          WHERE
            status = 'HASHED'
        `
      )[0].count;
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
          filePath: row.path,
          coreUrl:
            size < getSolrCoreList().length
              ? await getLeastPopulatedCore()
              : selectCore.next().value,
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
