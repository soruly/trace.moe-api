import sql from "../../sql.ts";
import hashPassword from "../lib/hash-password.ts";

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
  if (!req.body?.password || req.body.password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long",
    });
  }
  await sql`
    UPDATE users
    SET
      password = ${await hashPassword(req.body.password)}
    WHERE
      id = ${rows[0].id}
  `;

  return res.json({});
};
