import generateAPIKey from "../../lib/generate-api-key.js";

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
  const key = generateAPIKey(rows[0].id);
  await knex("user").where("id", rows[0].id).update("api_key", key);

  return res.json({
    key,
  });
};
