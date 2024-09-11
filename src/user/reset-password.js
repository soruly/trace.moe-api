import crypto from "node:crypto";

const { TRACE_API_SALT } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

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
  if (!req.body?.password || req.body.password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long",
    });
  }
  await knex("user")
    .where("id", rows[0].id)
    .update(
      "password",
      crypto.scryptSync(req.body.password, TRACE_API_SALT, 64).toString("base64"),
    );

  return res.json({});
};
