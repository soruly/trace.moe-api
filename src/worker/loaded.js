import fetch from "node-fetch";
import sendWorkerJobs from "./send-worker-jobs.js";

const { TRACE_ALGO, DISCORD_URL, TELEGRAM_ID, TELEGRAM_URL } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const { anilistID, filename } = req.params;
  console.log(`Loaded ${anilistID}/${filename}`);
  await knex(TRACE_ALGO).where("path", `${anilistID}/${filename}`).update({ status: "LOADED" });
  await sendWorkerJobs(req.app.locals.knex, req.app.locals.workerPool);
  res.sendStatus(204);

  if (TELEGRAM_ID && TELEGRAM_URL) {
    fetch(TELEGRAM_URL, {
      method: "POST",
      body: new URLSearchParams([
        ["chat_id", TELEGRAM_ID],
        ["parse_mode", "Markdown"],
        ["text", "`" + filename + "`"],
      ]),
    });
  }

  if (DISCORD_URL) {
    fetch(DISCORD_URL, {
      method: "POST",
      body: new URLSearchParams([["content", filename]]),
    });
  }
};
