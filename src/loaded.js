import Knex from "knex";
import fetch from "node-fetch";
import sendWorkerJobs from "../lib/send-worker-jobs.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_ALGO,
  DISCORD_URL,
  TELEGRAM_ID,
  TELEGRAM_URL,
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

export default async (req, res) => {
  const { anilistID, filename } = req.params;
  console.log(`Loaded ${anilistID}/${filename}`);
  await knex(TRACE_ALGO).where("path", `${anilistID}/${filename}`).update({ status: "LOADED" });
  await sendWorkerJobs(req.app.locals.workerPool);
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
