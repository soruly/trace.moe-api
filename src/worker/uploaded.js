import sendWorkerJobs from "./send-worker-jobs.js";

const { TRACE_ALGO } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const { anilistID, filename } = req.params;
  console.log(`Uploaded ${anilistID}/${filename}`);
  await knex.raw(
    knex(TRACE_ALGO)
      .insert({
        path: `${anilistID}/${filename}`,
        status: "UPLOADED",
      })
      .toString()
      .replace(/^insert/i, "insert ignore")
  );
  await sendWorkerJobs(req.app.locals.knex, req.app.locals.workerPool);
  res.sendStatus(204);
};
