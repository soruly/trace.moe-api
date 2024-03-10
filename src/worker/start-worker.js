import { Worker } from "node:worker_threads";
import getSolrCoreList from "../lib/get-solr-core-list.js";

const { TRACE_ALGO, SOLA_SOLR_LIST, MAX_WORKER } = process.env;

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

export default async (app) => {
  const knex = app.locals.knex;
  const createWorker = async () => {
    while (app.locals.mutex) await new Promise((resolve) => setTimeout(resolve, 0));
    app.locals.mutex = true;

    const [row] = await knex(TRACE_ALGO)
      .whereIn("status", ["UPLOADED", "HASHED"])
      .select("path", "status")
      .orderBy("status", "desc")
      .limit(1);

    if (!row) {
      app.locals.workerCount--;
    } else if (row.status === "UPLOADED") {
      await knex(TRACE_ALGO).where("path", row.path).update({ status: "HASHING" });
      const worker = new Worker("./src/worker/hash.js", {
        workerData: { filePath: row.path },
      });
      worker.on("message", (message) => console.log(message));
      worker.on("error", (error) => console.error(error));
      worker.on("exit", async (code) => {
        if (!code) await knex(TRACE_ALGO).where("path", row.path).update({ status: "HASHED" });
        await createWorker();
      });
    } else if (row.status === "HASHED") {
      const size = (await knex(TRACE_ALGO).where("status", "HASHED").count())[0]["count(*)"];
      await knex(TRACE_ALGO).where("path", row.path).update({ status: "LOADING" });
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
        if (!code) await knex(TRACE_ALGO).where("path", row.path).update({ status: "LOADED" });
        await createWorker();
      });
    }
    app.locals.mutex = false;
  };
  const unprocessed = (await knex(TRACE_ALGO).whereIn("status", ["UPLOADED", "HASHED"]).count())[0][
    "count(*)"
  ];
  while (app.locals.workerCount < Math.min(unprocessed, Number(MAX_WORKER))) {
    app.locals.workerCount++;
    await createWorker();
  }
};
