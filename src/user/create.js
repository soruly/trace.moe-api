import Knex from "knex";
import createNewUser from "../../lib/create-new-user.js";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME } = process.env;

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
  if (rows[0].id >= 1000) {
    return res.status(403).json({
      error: "Forbidden",
    });
  }

  const result = await createNewUser(
    req.body.email,
    req.body.tier,
    req.body.email.split("@").shift()
  );

  if (result) {
    return res.status(400).json({
      error: result,
    });
  }

  return res.json({});
};
