import sql from "../../sql.js";
import generateAPIKey from "../lib/generate-api-key.js";

export default async (req, res) => {
  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (!apiKey) {
    return res.status(403).json({
      error: "Missing API key",
    });
  }
  const rows = await sql`
    SELECT
      id
    FROM
      users
    WHERE
      api_key = ${apiKey}
    LIMIT
      1
  `;
  if (rows.length === 0) {
    return res.status(403).json({
      error: "Invalid API key",
    });
  }
  const key = generateAPIKey(rows[0].id);
  await sql`
    UPDATE users
    SET
      api_key = ${key}
    WHERE
      id = ${rows[0].id}
  `;

  return res.json({
    key,
  });
};
