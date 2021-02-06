import "dotenv/config.js";
import url from "url";
import querystring from "querystring";
import WebSocket from "ws";
import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SERVER_WS_PORT,
  TRACE_API_URL,
  TRACE_API_SECRET,
  TRACE_MEDIA_URL,
  TRACE_MEDIA_SECRET,
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

const wss = new WebSocket.Server({ host: "127.0.0.1", port: SERVER_WS_PORT });

const STATE = { READY: "READY", BUSY: "BUSY" };

const workerPool = new Map();

const lookForJobs = async (ws) => {
  if (workerPool.get(ws).type === "hash") {
    const rows = await knex("files").where("status", "UPLOADED");
    if (rows.length) {
      const file = rows[0].path;
      await knex("files").where("path", file).update({ status: "HASHING" });
      workerPool.set(ws, { status: STATE.BUSY, type: "hash", file });
      ws.send(
        JSON.stringify({
          input: `${TRACE_MEDIA_URL}/${file}?token=${TRACE_MEDIA_SECRET}&algo=cl`,
          output: `${TRACE_API_URL}/hashed/${file}?token=${TRACE_API_SECRET}`,
        })
      );
    } else {
      workerPool.set(ws, { status: STATE.READY, type: "hash", file: "" });
    }
  } else if (workerPool.get(ws).type === "load") {
    const rows = await knex("files").where("status", "HASHED");
    if (rows.length) {
      const file = rows[0].path;
      await knex("files").where("path", file).update({ status: "LOADING" });
      workerPool.set(ws, { status: STATE.BUSY, type: "load", file });
      ws.send(
        JSON.stringify({
          input: `${TRACE_MEDIA_URL}/${file}?token=${TRACE_MEDIA_SECRET}`,
          output: `${TRACE_API_URL}/hashed/${file}?token=${TRACE_API_SECRET}`,
        })
      );
    } else {
      workerPool.set(ws, { status: STATE.READY, type: "load", file: "" });
    }
  }
  console.log(
    Array.from(workerPool)
      .filter(([_, { status, type, file }]) => type !== "master")
      .map(([_, { status, type, file }]) => `${type},${status},${file}`)
  );
};

wss.on("connection", async (ws, request) => {
  const { query } = url.parse(request.url);
  const { type } = querystring.parse(query);
  if (type === "hash" || type === "load") {
    const ip = request.headers["x-forwarded-for"]?.split(/\s*,\s*/)?.[0];
    workerPool.set(ws, { status: STATE.READY, type, file: "", ip });
    await lookForJobs(ws);
    ws.on("message", async (message) => {
      const { input, output } = JSON.parse(message);
      console.log(`Completed ${input}`);
      await lookForJobs(ws);
    });
  }
  if (type === "master") {
    ws.on("message", async (message) => {
      if (message === "getWorkerPool") {
        ws.send(JSON.stringify(Array.from(workerPool)));
      }
      if (message === "checkDB") {
        for (const [ws] of Array.from(workerPool).filter(
          ([_, { status, type, file }]) => type !== "master" && status === STATE.READY
        )) {
          await lookForJobs(ws);
        }
      }
    });
  }
  ws.on("close", (code, reason) => {
    console.log("close:", code, reason);
    workerPool.delete(ws);
  });
});

setInterval(() => {
  for (const client of Array.from(wss.clients).filter((e) => e.readyState === WebSocket.OPEN)) {
    client.ping();
  }
}, 30000); // prevent cloudflare timeout
