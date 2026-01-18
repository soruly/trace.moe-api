import sql from "../../sql.ts";
import createNewUser from "../lib/create-new-user.ts";

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
  if (rows[0].id >= 1000) {
    return res.status(403).json({
      error: "Forbidden",
    });
  }

  const result = await createNewUser(
    req.body.email,
    req.body.tier,
    req.body.email.split("@").shift(),
  );

  if (result) {
    return res.status(400).json({
      error: result,
    });
  }

  return res.json({});
};
