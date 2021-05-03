import Knex from "knex";
import crypto from "crypto";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_API_SALT,
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
  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (!apiKey) {
    return res.status(403).json({
      error: "Missing API key",
    });
  }
  const rows = await knex("user").select("id").where("api_key", apiKey);
  if (rows.length === 0) {
    return res.status(403).json({
      error: "Invalid API key",
    });
  }
  const hmac = crypto.createHmac("sha256", TRACE_API_SALT);
  const key = hmac.update(`${Math.random() * 10000}`).digest("hex");
  await knex("user").where("id", rows[0].id).update("api_key", key);

  return res.json({
    key,
  });
};
